import { ContextProvider, PCSC, CommandAPDU, ISO7816, HEX } from '../mod.ts';

const context = ContextProvider.establishContext();

const readers = context.listReaders();

for (const reader of readers) {
  if (reader.isMute) {
    console.log(`Reader ${reader.name}: MUTE`)
  }
  else if (reader.isPresent) {
    const card = await reader.connect();

    const selectMF = CommandAPDU
      .parse([ISO7816.CLA.ISO, ISO7816.INS.SelectFile, 0x00, 0x00]) // ISO SELECT
      .setData([0x3f, 0x00]);         // #3F 00 = MF

    const resp = await card.transmitAPDU(selectMF);

    if (resp.SW == ISO7816.SW.SUCCESS) {
      // success ..
      console.log(`Reader ${reader.name}: MF successfully selected`);

      console.log(HEX.toString(resp.data));
    } else {
      // something went wrong .. 
      console.error(`Reader ${reader.name}: error SW=${resp.SW.toString(16)}`);
    }

    await card.disconnect(PCSC.Disposition.UnpowerCard);
  }
  else {
    console.log(`Reader ${reader.name}: NO CARD`)
  }
}

context.shutdown();