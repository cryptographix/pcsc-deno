import { ContextProvider, PCSC, CommandAPDU, Reader, HEX, Context, Card } from '../mod.ts';
import { Disposition, Protocol, ShareMode, StateFlag } from "../pcsc/scard.ts";
import { Logger } from './utils/logger.ts';

import { assert, assertEquals, assertExists } from 'https://deno.land/std@0.146.0/testing/asserts.ts';
import { FFIContext, FFIReader } from "../deno-pcsc-ffi/deno-pcsc-ffi.ts";

/*async function testReader(reader: Reader): Promise<void> {
  let statusCalledCount = 0;

  reader.onStatusChange = (reader, status) => {
    Logger.info(`${reader.name} changed to ${status}`);

    Logger.detail(reader.state.toString(16));

    statusCalledCount++;
  }

  while (reader.isPresent) {
    const isPresent = reader.isPresent;

    Logger.detail(`${reader.name} present=${isPresent}`);
    if (!isPresent) {
      break;
    }

    const card = await reader.connect();
    Logger.detail(card);

    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    Logger.detail(HEX.toString(selectMF.toBytes()));
    let rapdu = await card.transmitAPDU(selectMF);

    Logger.detail(HEX.toString(rapdu.toBytes()));

    rapdu = await card.transmitAPDU(
      CommandAPDU.from([0x00, 0xC0, 0x00, 0x00, rapdu.SW & 0xff]),
    );
    Logger.detail(HEX.toString(rapdu.toBytes()));

    await card.reconnect(PCSC.ShareMode.Exclusive);
    Logger.detail("reconnected");

    await card.disconnect(PCSC.Disposition.UnpowerCard);
    Logger.detail("disconnected");

    break;
  }
}

Deno.test({
  name: "Test Context",
  //ignore: (await findCards()).readersWithCard.length == 0,
  fn: async ({ step }) => {
    const context = ContextProvider.establishContext();

    context.onStatusChange = (reader, status) => {
      Logger.info(`Event ${status} for reader ${reader.name}`);
    
      Logger.detail(
        `Readers: [${(context.listReaders()).map((reader) => reader.name).join(",")
        }]`,
      );
    
      // if (status == "setup" || status=="present") {
      //   await testReader(reader);
      // }
    };
    
    if (context.listReaders(true).length == 0) {
      Logger.info("Attach Reader");
      await context.waitForChange([], 10000, true);
    }
    
    Logger.info(`Readers:[ ${(context.listReaders(true)).map((r) => r.name).join(", ")} ]`);

    for (const reader of context.listReaders()) {
      await step({
        name: `Test reader: ${reader}`,

        fn: async () => {

          await testReader(reader);
        }
      });
    }
  }
});*/

function getContext() {
  const context = ContextProvider.establishContext() as FFIContext;

  return { 
    context, 
    readers: context.listReaders()
  }
}

function findCards() {
  const { context, readers } = getContext();

  const readersWithCard = readers.filter(rdr => rdr.isPresent);

  return { 
    context, 
    readers,
    readersWithCard
  }
}

Deno.test("Can establish context and list readers", () => {
  const { context, readers } = getContext();

  Logger.info("Readers:", readers.map((r) => r.name.toString()).join(", "));

  context.shutdown();
});

Deno.test("Correctly handles waitForChange", async ({step}) => {
  const { context, readers } = getContext();

  for (const reader of readers) {
    await step(`Test reader: ${reader.name}`, async () => {
      const status = await reader.waitForChange();

      assertEquals(status, "no-change", "No change in status");
    });
  }

  context.shutdown();
});

Deno.test({
  name: "Tests with card present",
  ignore: (await findCards()).readersWithCard.length == 0,
  fn: async ({ step }) => {
    const { context, readersWithCard } = findCards();

    for (const reader of readersWithCard) {
      await step({
        name: `Test reader: ${reader.name}`,
        ignore: !reader.isPresent,

        fn: async ({ step }) => {
          //
          await step("Can connect, reconnect and disconnect", async () => {
            await testReaderConnectDisconnect(reader);
          });

          //
          await step("Can detect state changes", async () => {
            await testReaderStatusChange(context, reader);
          });

          // Connect
          const card = await reader.connect(
            ShareMode.Shared,
            Protocol.Any,
          );

          await step("Can select MF", async () => {
            await testCardSelectMF(card);
          });
        }
      });
    }

    context.shutdown();
  }
});

async function testReaderConnectDisconnect(reader: Reader) {
  // Connect
  const card = await reader.connect(
    ShareMode.Shared,
    Protocol.Any,
  );

  assert(card, "connected");
  const protocol = card.protocol;

  assert([1, 2].includes(card.protocol), "Protocol T=0/T=1")

  Logger.detail("Card Handle", card.valueOf(), "Protocol: ", protocol);

  // Reconnect with same protocol
  await card.reconnect(
    ShareMode.Shared,
    protocol,
    Disposition.LeaveCard
  );

  assertEquals(protocol, card.protocol, "Same protocol after RECONNECT+LEAVE")

  // Disconnect
  card.disconnect(
    Disposition.UnpowerCard
  );
}

async function testReaderStatusChange(context: FFIContext, reader: FFIReader) {
  const state = reader.readerState;

  const flagMask = StateFlag.Present | StateFlag.Inuse | StateFlag.Mute | StateFlag.Exclusive;

  assertEquals(await reader.waitForChange(), "no-change");
  Logger.detail("Initial state", state.eventState.toString(16));
  assertEquals(reader.status, "present")

  assertEquals(await reader.waitForChange(), "no-change");

  // Connect
  const card1 = await reader.connect(
    ShareMode.Shared,
    Protocol.Any,
  );

  // PRESENT + INUSE
  let changed = await context.waitForChange([reader]);
  Logger.detail("State after initial CONNECT", state.currentState.toString(16));
  assertEquals(changed.length, 1, "GetStatusChange() returns changed READERSTATE");
  assertEquals(changed[0].readerState, state, "GetStatusChange() returns state object");
  assertEquals(state.eventState & StateFlag.Changed, StateFlag.Changed, "GetStatusChange(): eventState includes CHANGED");
  assertEquals(state.currentState & StateFlag.Changed, 0, "GetStatusChange: currentState without CHANGED flag");

  assertEquals(reader.status, "connected")

  // try again -> should be no changes
  changed = await context.waitForChange([reader]) as FFIReader[];
  Logger.detail("State after no-change", state.currentState.toString(16));
  assertEquals(changed.length, 0, "NO CHANGE -> GetStatusChange() = timeout (changed = [])");

  // disconnect
  await card1.disconnect(
    Disposition.UnpowerCard
  );

  assertEquals(state.currentState & flagMask, StateFlag.Present, "POWEROFF ->  present and not in-use")

  // Connect (SHARED)
  const card = await reader.connect(
    ShareMode.Shared,
    Protocol.Any,
  );

  const protocol = card.protocol;

  assertEquals( (await context.waitForChange([reader])).length, 1);
  Logger.detail("State after CONNECT+SHARED", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, StateFlag.Present | StateFlag.Inuse, "Connect(SHARED) -> present & in-use")

  // Reconnect (EXCLUSIVE)
  card.reconnect(
    ShareMode.Exclusive,
    protocol,
    Disposition.LeaveCard
  );

  // Windows includes "InUse" with Exclusive, OS/X does not!
  assertEquals( (await context.waitForChange([reader])).length, 1);
  Logger.detail("State after RECONNECT+EXCLUSIVE", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask & ~StateFlag.Inuse, StateFlag.Present | StateFlag.Exclusive, "Reconnect(EXCLUSIVE) -> present & exclusive")

  // Disconnect
  card.disconnect(
    Disposition.LeaveCard
  );

  assertEquals( (await context.waitForChange([reader])).length, 1);
  Logger.detail("State after DISCONNECT+LEAVE", state.currentState.toString(16));
  assertEquals(state.currentState & flagMask, StateFlag.Present, "Disconnect(LEAVE) -> present");
}

async function testCardSelectMF(card: Card) {
  const selectMF = [0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00];
  Logger.detail(`Transmit: Select MF (${HEX.toString(selectMF)})`);

  const rapdu = await card.transmit(selectMF, 256);
  Logger.detail(`Received: (${HEX.toString(rapdu)})`);

  assertEquals(HEX.toString(rapdu), "90 00", "Select MF returns 0x9000");
}

