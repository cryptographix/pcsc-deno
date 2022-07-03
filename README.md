Deno FFI bindings to the PC/SC API. 

`pcsc` provides both [Application Level](#application-level-usage-example) and [Low Level](#low-level-and-legacy-usage) abstraction of the PC/SC API for accessing ISO-7816/ISO-14433 smartcards as used in Banking (EMV / Chip-and-PIN) cards, ID cards and Passports.

The [Application Level](#application-level-usage-example) abstraction offers a dev-friendly API based on concepts and objects such as `Context`, `Reader`, `Card`, `CommandAPDU` and `ResponseAPDU`. The [Low Level](#low-level-and-legacy-usage) API exists as a lightweight wrapper over the standard [PC/SC] API calls, useful when porting existing code.

A third layer, OpenMobileAPI [OMAPI], is still work-in-progress.

## Status
Requires Deno 1.23.2 or greater, along with `--unstable` and `--allow-ffi` flags.

Currently tested on MAC (M1) and Windows 10 64bits. Should work on linux.
Any problems, please raise issue at (https://github.com/cryptographix/pcsc-deno). PRs welcome.

# Application-level API
Use the `ContextProvider` to establish a `Context` (connection) with PC/SC, list `Readers`, connect to and communicate with `Cards`.
On Deno, `ContextProvider` defaults to the FFI implementation that requires `--unstable` and `--allow-ffi` flags to be added to `deno run` or `deno test` commands.

## Example
```typescript
import { ContextProvider, CommandAPDU, PCSC, ISO7816, HEX } from 'https://deno.land/x/pcsc/mod.ts';

const context = ContextProvider.establishContext();

const readers = context.listReaders();

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

===
## API

### Class: `ContextProvider`
The `ContextProvider` object is a singleton registry that provides access to the PCSC context.

#### method: `establishContext()`
`establishContext` connects to the PC/SC daemon and returns a valid `Context`. On Deno, an instance of `FFIContext` will be returned.

### Class: `Context`
The `Context` object lists the available Card Readers and notifies a listener of any changes. After use, 
the `shutdown` method should be called, to release any allocated resources. 

#### Method: `listReaders()`
`listReaders` scans PC/SC for a list of connected readers, and returns an array of `Reader` objects.

#### Method: `async waitForChange()`
`waitForChange` waits for a change - card insertion/removal or reader plug/unplug. If a notify handler 
has been registered, that will be called once for each change detected. A `timeout` (ms) may be specified
after which the method will automatically resolve.

#### Method: `shutdown()`
`shutdown` shutsdown all `Readers` and closed the connection to the PC/SC deamon

#### Property: `onStatusChange`
`onStatusChange` can be set to receive notifications for reader/card events.

### Class: `Reader`

===
# Low-level and legacy usage
`pcsc` also provides low-level access to PC/SC via the following methods:

| Function                | Description |
| ----------------------- | ----------- |
| `SCardEstablishContext` | Establish connection to PC/SC resource manager |
| `SCardReleaseContext`   | Release connection with PC/SC resource manager |
| `SCardCancel`           | Cancel ongoing card transaction |
| `SCardIsValidContext`   | Check if context still valid |
| `SCardListReaders`      | List connected Smart card readers |
| `SCardGetStatusChange`  | Wait for status change on reader(s) |
| `SCardConnect`          | Connect to card |
| `SCardStatus`           | Verify card status |
| `SCardReconnect`        | Reconnect to card |
| `SCardDisconnect`       | Disconnect from card |
| `SCardTransmit`         | Send command and wait for response from card |

Note: `SCardGetStatusChange` and `SCardTransmit` are `async` functions, but there are also synchronous versions 
that may be useful in certain circumstances.

| Function                | Description |
| ----------------------- | ----------- |
| `SCardGetStatusChangeSync`  | Immediately return status of reader(s) |
| `SCardTransmitSync`         | Send command and block while waiting for response from card |

# links

[PC/SC] https://pcscworkgroup.com/specifications/

[OMAPI]
https://globalplatform.org/wp-content/uploads/2016/11/GPD_Open_Mobile_API_Spec_v3.3_PublicRelease.pdf
