import { CommandAPDU, Context, PCSC } from "../mod.ts"; // "https://<pcsc-deno-repo>/mod.ts";

const context = Context.establishContext();

const readerNames = context.listReaderNames();
console.log(`Readers:[${readerNames.join(",")}]`);

const readers = context.listReaders();

for (const reader of readers) {
  if (await reader.isPresent) {
    const card = reader.connect();

    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    const resp = card.transmitAPDU(selectMF);

    if (resp.SW == 0x9000) {
      // success ..
      console.log(`Reader ${reader.name}: MF selected`);
    } else {
      console.error(`Reader ${reader.name}: error ${resp.SW}`);
    }

    card.disconnect(PCSC.SCARD_RESET_CARD);
  }
}

context.shutdown();
