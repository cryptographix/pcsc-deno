import { CommandAPDU, FFIContext, PCSC } from '../mod.ts'; // "https://<pcsc-deno-repo>/mod.ts';

const context = FFIContext.establishContext();
await context.waitForChange();

const readers = await context.getReaders();
console.log(`Readers:[${readers.map(r=>r.name).join(",")}]`);

for (const reader of readers) {
  if (reader.isPresent) {
    const card = await reader.connect();

    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    const resp = await card.transmitAPDU(selectMF);

    if (resp.SW == 0x9000) {
      // success ..
      console.log(`Reader ${reader.name}: MF selected`);
    } else {
      console.error(`Reader ${reader.name}: error ${resp.SW}`);
    }

    card.disconnect(PCSC.Disposition.ResetCard);
  }
}

context.shutdown();
