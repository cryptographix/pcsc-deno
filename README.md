Deno FFI bindings to the PC/SC API, currently for OS/X, with (windows/linux) coming soon

# Introduction
This module offers both low-level and high-level abstractions over the PC/SC API for accessing SMARTCARDs.

1. Low-level functions `SCardxx` that roughly map onto standard [PC/SC] API calls
2. High-level classes `FFIContext, Reader, Card, CommandAPDU, ResponseAPDU`
3. TODO: OpenMobileAPI [OMAPI]

# High level usage

```typescript
import { FFIContext, CommandAPDU, PCSC, ISO7816, HEX } from 'https://<pcsc-deno-repo>/mod.ts';

const context = FFIContext.establishContext();

const readers = await context.listReaders();

for (const reader of readers) {
  if (reader.isMute) {
    console.log(`Reader ${reader.name}: MUTE`)
  }
  else if (reader.isPresent) {
    const card = await reader.connect();

    const selectMF = CommandAPDU
      .from([ISO7816.CLA.ISO, ISO7816.INS.SelectFile, 0x00, 0x00]) // ISO SELECT
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
```

# Low-level interface

Using ffi for low-level access to PC/SC,

| Function              | Async | Description |
| --------------------- | ----- | ----------- |
| SCardEstablishContext | | "Establish connection to PC/SC resource manager |
| SCardReleaseContext   | | Release connection with PC/SC resource manager |
| SCardCancel           | | Cancel ongoing card transaction |
| SCardIsValidContext   | | Check if context still valid |
| SCardListReaders      | x | List connected Smart card readers |
| SCardGetReaderStatus  | x | Wait for status change on reader(s) |
| SCardConnect          | x | Connect to card |
| SCardStatus           |   | Verify card status |
| SCardReconnect        | x | Reconnect to card |
| SCardDisconnect       | x | Disconnect from card |
| SCardTransmit         | x | Send command and wait for response from card |

# links

[PC/SC] https://pcscworkgroup.com/specifications/

[OMAPI]
https://globalplatform.org/wp-content/uploads/2016/11/GPD_Open_Mobile_API_Spec_v3.3_PublicRelease.pdf
