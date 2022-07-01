import { CommandAPDU, FFIContext, PCSC, Reader, HEX } from '../mod.ts';

const context = FFIContext.establishContext();
console.log(context);

context.onStatusChange = async (reader, status) => {
  console.log(`Event ${status} for reader ${reader.name}`);

  console.log(
    `Readers: [${(await context.getReaders()).map((reader) => reader.name).join(",")
    }]`,
  );

  // if (status == "setup" || status=="present") {
  //   await testReader(reader);
  // }
};

if ((await context.getReaders(true)).length == 0) {
  console.log("Attach Reader");
  await context.waitForChange([], 10000, true);
}

console.log(`Readers:[ ${(await context.getReaders(true)).map((r) => r.name).join(", ")} ]`);

for (const reader of await context.getReaders()) {
  await testReader(reader);
}

async function testReader(reader: Reader): Promise<void> {
  reader.onStatusChange = (reader, status) => {
    console.log(`${reader.name} changed to ${status}`);

    console.log(
      (reader as unknown as { readerState: { currentState: number } })
        .readerState.currentState,
    );
  }

  while (reader.isPresent) {
    const isPresent = reader.isPresent;

    console.log(`${reader.name} present=${isPresent}`);
    if (!isPresent) {
      break;
    }

    const card = await reader.connect();
    console.log(card);

    const selectFile = CommandAPDU.from([0x00, 0xA4, 0x04, 0x00])
      .setData([0xA0, 0x00, 0x00, 0x01, 0x54, 0x49, 0x44]);
    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    console.log(HEX.toString(selectFile.toBytes()));
    let rapdu = await card.transmitAPDU(selectFile);

    console.log(HEX.toString(rapdu.toBytes()));

    rapdu = await card.transmitAPDU(
      CommandAPDU.from([0x00, 0xC0, 0x00, 0x00, rapdu.SW & 0xff]),
    );
    console.log(HEX.toString(rapdu.toBytes()));

    await card.reconnect(PCSC.ShareMode.Exclusive);
    console.log("reconnected");

    await card.disconnect(PCSC.Disposition.UnpowerCard);
    console.log("disconnected");

    break;
  }
}

//context.shutdown();
