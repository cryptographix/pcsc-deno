import { StateFlag, ShareMode, Protocol, Disposition, SCARDCONTEXT, SCARDHANDLE, DWORD } from '../pcsc/pcsc.ts';
import { CSTR, libFFI, FFI_SCARDREADERSTATE } from '../deno-pcsc-ffi/deno-pcsc-ffi.ts';
import { HEX } from '../mod.ts';

import { getContext, findCards, isCardPresent } from './utils/scard-ffi-test-utils.ts';
import { Logger } from './utils/logger.ts';

import { assert, assertEquals, assertExists } from 'https://deno.land/std@0.146.0/testing/asserts.ts';


Deno.test("Can establish context and list readers", () => {
  const { context, readers } = getContext();

  Logger.info("Readers:", readers.map((r) => r.toString()).join(", "));
  Logger.detail("Context Handle", context.valueOf());

  libFFI.SCardReleaseContext(context);
});

Deno.test("Correctly handles initial GetStatusChange", async ({step}) => {
  const { context, readers } = getContext();

  for (const reader of readers) {
    await step(`Test reader: ${reader}`, () => {
      const state = new FFI_SCARDREADERSTATE(reader);
      const changed = libFFI.SCardGetStatusChangeSync(context, 0, [state]);

      assertExists(changed, "returns  changedIndex[]");
      assert(changed.length == 1, "changed length == 1");
      assert(changed[0] === 0, "changed[0] == 0");
      assert(state.eventState & StateFlag.Changed, "Signalled CHANGED");
    });
  }

  libFFI.SCardReleaseContext(context);
});

Deno.test({
  name: "Tests with card present",
  ignore: (await findCards()).readersWithCard.length == 0,
  fn: async ({ step }) => {
    const { context, readersWithCard } = findCards();

    for (const reader of readersWithCard) {
      await step({
        name: `Test reader: ${reader}`,
        ignore: !isCardPresent(reader),

        fn: async ({ step }) => {
          //
          await step("Can connect, reconnect and disconnect", () => {
            testReaderConnectDisconnect(context, reader);
          });

          //
          await step("Can detect state changes", () => {
            testReaderStatusChange(context, reader);
          });

          // Connect
          const { handle: card, protocol } = libFFI.SCardConnect(
            context,
            reader,
            ShareMode.Shared,
            Protocol.Any,
          );

          await step("Can select MF", () => {
            testCardSelectMF(card, protocol);
          });
        }
      });
    }

    libFFI.SCardReleaseContext(context);
  }
});

function testReaderConnectDisconnect(context: SCARDCONTEXT, reader: CSTR) {
  // Connect
  const { handle: card, protocol } = libFFI.SCardConnect(
    context,
    reader,
    ShareMode.Shared,
    Protocol.Any,
  );

  assert(card, "connected");
  assert([1, 2].includes(protocol), "Protocol T=0/T=1")

  Logger.detail("Card Handle", card.valueOf(), "Protocol: ", protocol);

  // Reconnect with same protocol
  const { protocol: reconProtocol } = libFFI.SCardReconnect(
    card,
    ShareMode.Shared,
    protocol,
    Disposition.LeaveCard
  );

  assertEquals(protocol, reconProtocol, "Same protocol after RECONNECT+LEAVE")

  // Disconnect
  libFFI.SCardDisconnect(
    card,
    Disposition.UnpowerCard
  );
}

function testReaderStatusChange(context: SCARDCONTEXT, reader: CSTR) {
  const state = new FFI_SCARDREADERSTATE(reader);

  const flagMask = StateFlag.Present | StateFlag.Inuse | StateFlag.Mute | StateFlag.Exclusive;

  libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("Initial state", state.eventState.toString(16));

  // Connect + POWER OFF
  const { handle: card1 } = libFFI.SCardConnect(
    context,
    reader,
    ShareMode.Shared,
    Protocol.Any,
  );

  // PRESENT + INUSE
  let changed = libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after initial CONNECT", state.currentState.toString(16));
  assertEquals(changed.length, 1, "GetStatusChange() returns index of changed READERSTATE");
//  assertEquals(changed[0], state, "GetStatusChange() returns state object");
  assertEquals(state.eventState & StateFlag.Changed, StateFlag.Changed, "GetStatusChange(): eventState includes CHANGED");
  assertEquals(state.currentState & StateFlag.Changed, 0, "GetStatusChange: currentState without CHANGED flag");

  // try again -> should be no changes
  changed = libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after no-change", state.currentState.toString(16));
  assertEquals(changed.length, 0, "NO CHANGE -> GetStatusChange() = timeout (changed = [])");

  // disconnect
  libFFI.SCardDisconnect(
    card1,
    Disposition.UnpowerCard
  );
  changed = libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after DISCONNECT:UNPOWER", state.currentState.toString(16));
  assertEquals(changed.length, 1, "DISCONNECT -> GetStatusChange() returns changed READERSTATE");
  assertEquals(state.eventState & StateFlag.Changed, StateFlag.Changed, "GetStatusChange(): eventState includes CHANGED");

  libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after no-change", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, StateFlag.Present, "POWEROFF ->  present and not in-use")

  // Connect (SHARED)
  const { handle: card, protocol } = libFFI.SCardConnect(
    context,
    reader,
    ShareMode.Shared,
    Protocol.Any,
  );

  libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after CONNECT+SHARED", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, StateFlag.Present | StateFlag.Inuse, "Connect(SHARED) -> present & in-use")

  // Reconnect (EXCLUSIVE)
  libFFI.SCardReconnect(
    card,
    ShareMode.Exclusive,
    protocol,
    Disposition.LeaveCard
  );

  // Windows includes "InUse" with Exclusive, OS/X does not!
  libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after RECONNECT+EXCLUSIVE", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask & ~StateFlag.Inuse, StateFlag.Present | StateFlag.Exclusive, "Reconnect(EXCLUSIVE) -> present & exclusive")

  // Disconnect
  libFFI.SCardDisconnect(
    card,
    Disposition.LeaveCard
  );

  libFFI.SCardGetStatusChangeSync(context, 0, [state]);
  Logger.detail("State after DISCONNECT+LEAVE", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, StateFlag.Present, "Disconnect(LEAVE) -> present");
}

function testCardSelectMF(card: SCARDHANDLE, protocol: DWORD) {
  const selectMF = [0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00];
  Logger.detail(`Transmit: Select MF (${HEX.toString(selectMF)})`);

  const rapdu = libFFI.SCardTransmitSync(card, Uint8Array.from(selectMF), 258, protocol);
  Logger.detail(`Received: (${HEX.toString(rapdu)})`);

  assertEquals(HEX.toString(rapdu), "90 00", "Select MF returns 0x9000");
}

