import { Logger } from './utils/logger.ts';
import { FFIContext, FFIReader, PCSC, CommandAPDU, Reader, HEX } from '../mod.ts';

const context = FFIContext.establishContext();

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
  await testReader(reader);
}

async function testReader(reader: Reader): Promise<void> {
  reader.onStatusChange = (reader, status) => {
    Logger.info(`${reader.name} changed to ${status}`);

    Logger.detail((reader as FFIReader).readerState.currentState.toString(16));
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

//context.shutdown();
