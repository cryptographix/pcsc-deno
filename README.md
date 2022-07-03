Deno FFI bindings to the PC/SC API. 

This module offers both [Low Level](#low-level-and-legacy-usage) and [Application Level](#application-level-usage-example) abstractions of the PC/SC API for accessing ISO-7816/ISO-14433 smartcards as used in Banking (EMV / Chip-and-PIN) cards, ID cards and Passports.

The [Low Level](#low-level-and-legacy-usage) API exports `SCard*` methods that are lightweight wrappers over the standard [PC/SC] API calls.

2. [Application Level](#application-level-usage-example) abstractions offer a user-friendly API based on the objects such as `Context`, `Reader`, `Card`, `CommandAPDU` and `ResponseAPDU`.

3. WIP: OpenMobileAPI [OMAPI]

## Status
Requires Deno 1.23.2 or greater, along with `--unstable` and `--allow-ffi` flags.

Currently tested on MAC (M1) and Windows 10 64bits. Should work on linux.
Any problems, please raise issue at (https://github.com/cryptographix/pcsc-deno). PRs welcome.

# Introduction

# Application-level usage example
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

Contains a number of utility classes for parsing/building APDUs (the base command/response structures)
`CommandAPDU` and `ResponseAPDU`, as well as TLVs `BerTLV`.


# Low-level and legacy usage
Using FFI for low-level access to PC/SC, via 

| Function                | Description |
| ----------------------- | ----------- |
| `SCardEstablishContext` | Establish connection to PC/SC resource manager |
| `SCardReleaseContext`   | Release connection with PC/SC resource manager |
| `SCardCancel`           | Cancel ongoing card transaction |
| `SCardIsValidContext`   | Check if context still valid |
| `SCardListReaders`      | List connected Smart card readers |
| `SCardGetReaderStatus`  | ASYNC - Wait for status change on reader(s) |
| `SCardConnect`          | Connect to card |
| `SCardStatus`           | Verify card status |
| `SCardReconnect`        | Reconnect to card |
| `SCardDisconnect`       | Disconnect from card |
| `SCardTransmit`         | Send command and wait for response from card |

# links

[PC/SC] https://pcscworkgroup.com/specifications/

[OMAPI]
https://globalplatform.org/wp-content/uploads/2016/11/GPD_Open_Mobile_API_Spec_v3.3_PublicRelease.pdf
