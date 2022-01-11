import { CommandAPDU, Context, IReader, PCSC } from "../mod.ts";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((e) => ("00" + e.toString(16).toUpperCase()).slice(-2))
    .join(" ");

const context = Context.establishContext();
console.log(context);

context.onReaderEvent((event, reader) => {
  console.log(`Event ${event} for reader ${reader.name}`);

  console.log(`Readers: [${context.listReaderNames().join(",")}]`);

  if (event != "reader-removed") {
    testReader(reader);
  }
});

console.log(`Readers:[ ${context.listReaderNames().join(",")}]`);

/*const readers = context.listReaders();
for (const reader of readers) {
  testReader(reader);
}*/

async function testReader(reader: IReader) {
  while (reader.isActive) {
    const isPresent = await reader.isPresent;

    console.log(`${reader.name} present=${isPresent}`);
    console.log((reader as unknown as { readerState: { currentState: number } }).readerState.currentState);

    if ( !isPresent ) {
      await context.waitForChange([reader], 1000 );
      continue;
    }

    const card = await reader.connect();
    console.log(card);

    const selectFile = CommandAPDU.from([0x00, 0xA4, 0x04, 0x00])
      .setData([0xA0, 0x00, 0x00, 0x01, 0x54, 0x49, 0x44]);
    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    console.log(hex(selectMF.toBytes()));
    let rapdu = await card.transmitAPDU(selectFile);

    console.log(hex(rapdu.toBytes()));

    rapdu = await card.transmitAPDU(
      CommandAPDU.from([0x00, 0xC0, 0x00, 0x00, rapdu.SW & 0xff]),
    );
    console.log(hex(rapdu.toBytes()));

    await card.reconnect(PCSC.SCARD_SHARE_EXCLUSIVE);
    console.log("reconnected");

    await card.disconnect(PCSC.SCARD_UNPOWER_CARD);
    console.log("disconnected");
  }
}

//context.shutdown();
