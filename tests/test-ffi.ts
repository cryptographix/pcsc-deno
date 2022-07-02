import { Logger } from './logger.ts';
import { CSTR, nativeDenoFFI as lib, PCSC, HEX } from '../mod.ts';
import { SCARDREADERSTATE_FFI } from '../src/deno-pcsc-ffi/pcsc-ffi.ts';
import { assert, assertEquals, assertExists } from 'https://deno.land/std@0.146.0/testing/asserts.ts';

function getContext(needReader = true) {
  const context = lib.SCardEstablishContext(PCSC.Scope.System);
  assert(context, "Invalid Context");

  const readerNameLen = lib.SCardListReaders(context, null, null);
  assert(readerNameLen > 0, "ReaderLen > 0");

  if (needReader && readerNameLen <= 1) {
    assert(readerNameLen > 1, "No reader found");
  }

  const readerNamesMultiString = CSTR.alloc(readerNameLen);
  lib.SCardListReaders(context, null, readerNamesMultiString);

  const readerNameOffsets = readerNamesMultiString.buffer.reduce<number[]>(
    (acc, cur, curIdx) => (cur == 0) ? [...acc, curIdx] : acc,
    [0],
  ).slice(0, -1);

  const readers = readerNameOffsets.flatMap<CSTR>((val, index, array) => {
    return (index < array.length - 1)
      ? CSTR.fromNullTerminated(readerNamesMultiString.buffer.slice(val, array[index + 1] + 1))
      : [];
  });

  return {
    context,
    readers
  }
}

async function findCards() {
  const { context, readers } = getContext();

  const readersWithCard: CSTR[] = [];

  for (const readerName of readers) {
    const state = new SCARDREADERSTATE_FFI(readerName);
    const changed = await lib.SCardGetStatusChange(context, 0, [state]);

    if (changed.length != 0) {
      const stateFlags = changed[0].currentState & (PCSC.StateFlag.Present|PCSC.StateFlag.Mute);

      // Ignore MUTE cards
      if (stateFlags == PCSC.StateFlag.Present) {
        readersWithCard.push(readerName);
      }
    }
  }

  return {
    context,
    readers,
    readersWithCard,
  }
}

Deno.test("Can establish context and list readers", () => {
  const { context, readers } = getContext();

  Logger.info("Readers:", readers.map((r) => r.toString()).join(","));
  Logger.detail("Context Handle", context.valueOf());

  lib.SCardReleaseContext(context);
});

Deno.test("Correctly handles initial GetStatusChange", async (test) => {
  const { context, readers } = getContext();

  for (const reader of readers) {
    await test.step(`Test reader: ${reader}`, async () => {
      const state = new SCARDREADERSTATE_FFI(reader);
      const changed = await lib.SCardGetStatusChange(context, 0, [state]);

      assertExists(changed, "returns SCARDREADERSTATE[]");
      assert(changed.length == 1, "Initially state=UNKNOWN");
      assert(changed[0].eventState & PCSC.StateFlag.Changed, "Signalled CHANGED");
    });
  }

  lib.SCardReleaseContext(context);
});

async function noReaderWithCardPresent() {
  const { context, readersWithCard } = await findCards();


  lib.SCardReleaseContext(context);

  return readersWithCard.length == 0;
}

Deno.test({
  name: "Tests with card present",
  ignore: await noReaderWithCardPresent(),
  fn: async ({ step }) => {
    const { context, readersWithCard } = await findCards();

    for (const reader of readersWithCard) {
      await step(`Test reader: ${reader}`, async ({ step }) => {
        //
        await step("Can connect, reconnect and disconnect", () => {
          testReaderConnectDisconnect(context, reader);
        });

        //
        await step("Can detect state changes", async () => {
          await testReaderStatusChange(context, reader);
        });

        // Connect
        const { handle: card } = lib.SCardConnect(
          context,
          reader,
          PCSC.ShareMode.Shared,
          PCSC.Protocol.Any,
        );

        await step("Can select MF", () => {
          testCardSelectMF(card);
        });


      });
    }

    lib.SCardReleaseContext(context);
  }
});

function testReaderConnectDisconnect(context: PCSC.SCARDCONTEXT, reader: CSTR) {
  // Connect
  const { handle: card, protocol } = lib.SCardConnect(
    context,
    reader,
    PCSC.ShareMode.Shared,
    PCSC.Protocol.Any,
  );

  assert(card, "connected");
  assert([1, 2].includes(protocol), "Protocol T=0/T=1")

  Logger.detail("Card Handle", card.valueOf(), "Protocol: ", protocol);

  // Reconnect with same protocol
  const { protocol: reconProtocol } = lib.SCardReconnect(
    card,
    PCSC.ShareMode.Shared,
    protocol,
    PCSC.Disposition.LeaveCard
  );

  assertEquals(protocol, reconProtocol, "Same protocol after RECONNECT+LEAVE")

  // Disconnect
  lib.SCardDisconnect(
    card,
    PCSC.Disposition.UnpowerCard
  );
}

async function testReaderStatusChange(context: PCSC.SCARDCONTEXT, reader: CSTR) {
  const state = new SCARDREADERSTATE_FFI(reader);

  const flagMask = PCSC.StateFlag.Present | PCSC.StateFlag.Inuse | PCSC.StateFlag.Mute | PCSC.StateFlag.Exclusive;

  await lib.SCardGetStatusChange(context, 0, [state]);
  Logger.detail("Initial state", state.eventState.toString(16));

  // Connect + POWER OFF
  const { handle: card1 } = lib.SCardConnect(
    context,
    reader,
    PCSC.ShareMode.Shared,
    PCSC.Protocol.Any,
  );

  // PRESENT + INUSE
  let changed = await lib.SCardGetStatusChange(context, 0, [state]);
  Logger.detail("State after initial CONNECT", state.currentState.toString(16));
  assertEquals(changed.length, 1, "GetStatusChange() returns changed READERSTATE");
  assertEquals(changed[0], state, "GetStatusChange() returns state object");
  assertEquals(state.eventState & PCSC.StateFlag.Changed, PCSC.StateFlag.Changed, "GetStatusChange(): eventState includes CHANGED");
  assertEquals(state.currentState & PCSC.StateFlag.Changed, 0, "GetStatusChange: currentState without CHANGED flag");

  // try again -> should be TIMEOUT (no changeset)
  changed = await lib.SCardGetStatusChange(context, 100, [state]);
  Logger.detail("State after no-change", state.currentState.toString(16));
  assertEquals(changed.length, 0, "NO CHANGE -> GetStatusChange() = timeout (changed = [])");

  // disconnect
  lib.SCardDisconnect(
    card1,
    PCSC.Disposition.UnpowerCard
  );
  changed = await lib.SCardGetStatusChange(context, 100, [state]);
  Logger.detail("State after DISCONNECT:UNPOWER", state.currentState.toString(16));
  assertEquals(changed.length, 1, "DISCONNECT -> GetStatusChange() returns changed READERSTATE");
  assertEquals(state.eventState & PCSC.StateFlag.Changed, PCSC.StateFlag.Changed, "GetStatusChange(): eventState includes CHANGED");

  await lib.SCardGetStatusChange(context, 0, [state]);
  Logger.detail("State after no-change", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, PCSC.StateFlag.Present, "POWEROFF ->  present and not in-use")

  // Connect (SHARED)
  const { handle: card, protocol } = lib.SCardConnect(
    context,
    reader,
    PCSC.ShareMode.Shared,
    PCSC.Protocol.Any,
  );

  await lib.SCardGetStatusChange(context, 10, [state]);
  Logger.detail("State after CONNECT+SHARED", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, PCSC.StateFlag.Present | PCSC.StateFlag.Inuse, "Connect(SHARED) -> present & in-use")

  // Reconnect (EXCLUSIVE)
  lib.SCardReconnect(
    card,
    PCSC.ShareMode.Exclusive,
    protocol,
    PCSC.Disposition.LeaveCard
  );

  // Windows includes "InUse" with Exclusive, OS/X does not!
  await lib.SCardGetStatusChange(context, 10, [state]);
  Logger.detail("State after RECONNECT+EXCLUSIVE", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask & ~PCSC.StateFlag.Inuse, PCSC.StateFlag.Present | PCSC.StateFlag.Exclusive, "Reconnect(EXCLUSIVE) -> present & exclusive")

  // Disconnect
  lib.SCardDisconnect(
    card,
    PCSC.Disposition.LeaveCard
  );

  await lib.SCardGetStatusChange(context, 10, [state]);
  Logger.detail("State after DISCONNECT+LEAVE", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, PCSC.StateFlag.Present, "Disconnect(LEAVE) -> present");
}

function testCardSelectMF(card: PCSC.SCARDHANDLE) {
  const selectMF = [0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00];
  Logger.detail(`Transmit: Select MF (${HEX.toString(selectMF)})`);

  const rapdu = lib.SCardTransmit(card, Uint8Array.from(selectMF), 256);
  Logger.detail(`Received: (${HEX.toString(rapdu)})`);

  assertEquals(HEX.toString(rapdu), "90 00", "Select MF returns 0x9000");
}

