import { CommandAPDU, Context, PCSC } from "../mod.ts";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((e) => ("00" + e.toString(16).toUpperCase()).slice(-2))
    .join(" ");

const context = Context.establishContext();
console.log(context);

context.onReaderEvent((event, _reader) => {
  console.log("Event:", event);
});

console.log(`Readers:[ ${context.listReaderNames().join(",")} ]`);

const readers = context.listReaders();
if (readers.length > 0) {
  const reader = readers[0];

  for (let i = 0; i < 1; ++i) {
    await context.waitForChange([reader], 100).then(
      (rds) => {
        console.log(rds);

        //if (rds.length)
        console.log(reader.readerState.eventState.toString(16));
      },
    );
  }

  if (!await reader.isPresent) {
    console.log("not present");
  } else {
    console.log(reader.readerState);

    const card = reader.connect();
    console.log(card);

    const selectFile = new CommandAPDU(
      0x00,
      0xA4,
      0x04,
      0x00,
      new Uint8Array([0xA0, 0x00, 0x00, 0x01, 0x54, 0x44, 0x42]),
    );

    console.log(hex(selectFile.toBytes()));
    const rapdu = card.transmit(Uint8Array.from(selectFile.toBytes()), 256);

    console.log(hex(rapdu));

    card.reconnect(PCSC.SCARD_SHARE_EXCLUSIVE);
    console.log("reconnected");

    card.disconnect(PCSC.SCARD_UNPOWER_CARD);
    console.log("disconnected");
  }
}

context.shutdown();
