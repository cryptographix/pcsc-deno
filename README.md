# pcsc

[![npm](https://img.shields.io/npm/v/nfc-pcsc.svg)](https://www.npmjs.com/package/nfc-pcsc)
[![build status](https://img.shields.io/travis/pokusew/nfc-pcsc/master.svg)](https://travis-ci.org/pokusew/nfc-pcsc)

Deno FFI bindings to the PC/SC API, currently for OS/X, with (windows/linux)
coming soon

This mod offers a high-level abstraction over the PC/SC API, based on the
following classes: | Class | Description | | --------------------- | --- | |
SCardEstablishContext | x | | `Context` | | | `Reader` | | | `Card` | | |

Easy **reading and writing NFC tags and cards** in Node.js

Built-in support for auto-reading **card UIDs** and reading tags emulated with
[**Android HCE**](https://developer.android.com/guide/topics/connectivity/nfc/hce.html).

> **NOTE:** Reading tag UID and methods for writing and reading tag content
> **depend on NFC reader commands support**. It is tested to work with **ACR122
> USB reader** but it

# 

1. High-level classes `Context, Card, CommandAPDU/ResponseAPDU`
2. Low-level functions `SCardxx` that roughly map to standard [PC/SC]
3. TODO: OpenMobileAPI [OMAPI]

# High level usage

```typescript
import { CommandAPDU, Context, PCSC } from 'https://<pcsc-deno-repo>/mod.ts';

const context = Context.establishContext();

const readers = context.listReaders();
console.log(
  `Readers:[${readerNames.map((reader) => reader.name()).join(",")}]`,
);

for (const reader of readers) {
  if (await reader.isPresent) {
    const card = reader.connect();

    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    const resp = card.transmitAPDU(selectMF);

    if (resp.SW == 0x9000) {
      // success ..
      console.log(`Reader ${reader.name}: MF selected`);
      console.log(resp.data);
    } else {
      console.error(`Reader ${reader.name}: error ${resp.SW}`);
    }

    card.disconnect(PCSC.SCARD_RESET_CARD);
  }
}

context.shutdown();
```

# Low-level interface

Using ffi for low-level access to PC/SC,

| Function              | Description |
| --------------------- | ----------- |
| SCardEstablishContext | x           |
| SCardReleaseContext   | x           |
| SCardCancel           | x           |
| SCardIsValidContext   | x           |
| SCardListReaders      | x           |
| SCardGetReaderStatus  | x           |
| SCardConnect          | x           |
| SCardReonnect         | x           |
| SCardDisconnect       | x           |
| SCardTransmit         | x           |
| SCardStatus           | x           |

# High-level interface

## Basic Usage

# links

[PC/SC] https://pcscworkgroup.com/specifications/

[OMAPI]
https://globalplatform.org/wp-content/uploads/2016/11/GPD_Open_Mobile_API_Spec_v3.3_PublicRelease.pdf
