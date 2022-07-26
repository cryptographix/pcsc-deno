# Deno FFI bindings to the PC/SC API. 

`pcsc` provides both [Application Level](#application-level-usage-example) and [Low Level](#low-level-and-legacy-usage) abstraction of the PC/SC API for accessing ISO-7816/ISO-14433 smartcards as used in Banking (EMV / Chip-and-PIN) cards, ID cards and Passports.

The [Application Level](#application-level-usage-example) abstraction offers a dev-friendly API based on concepts and objects such as `Context`, `Reader`, `Card`, `CommandAPDU` and `ResponseAPDU`. The [Low Level](#low-level-and-legacy-usage) API exists as a lightweight wrapper over the standard [PC/SC] API calls, useful when porting existing code.

A third layer, OpenMobileAPI [OMAPI], is still work-in-progress.

## Status
Requires Deno 1.23.2 or greater, along with `--unstable` and `--allow-ffi` flags.

Currently tested on MAC (M1) and Windows 10 64bits. Should work on linux.
Any problems, please raise issue at (https://github.com/cryptographix/pcsc-deno). PRs welcome.

# Application-level API
Use the [`ContextProvider`](#class-contextprovider) to establish a [`Context`](#class-context) (connection) with PC/SC, list [`Reader`s](#class-reader)s, connect to and communicate with [`Card`s](#class-card).

On Deno, `ContextProvider` defaults to the FFI implementation that requires `--unstable` and `--allow-ffi` flags to be added to `deno run` or `deno test` commands.

## Example (see examples/selecf-mf.ts)
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

Then, to run:
```
deno run --unstable --allow-ffi https://deno.land/x/pcsc/examples/select-mf.ts
```


---
## API

### Class: `ContextProvider`
The `ContextProvider` object is a singleton registry that provides access to the PCSC context.

#### method: `establishContext()`
Connect to the PC/SC daemon and returns a valid [`Context`](#class-context). On Deno, an instance of `FFIContext` will be returned.


### Class: `Context`
Top level object that maintains a connection to the PC/SC daemon, providing a list of available Card [`Reader`](#class-reader)s, along with detection and notification of any changes in readers. After use, the `shutdown` method should be called, to release any allocated resources. 

#### Method: `listReaders(rescan?)`
`listReaders` scans PC/SC for a list of connected readers, and returns an array of [`Reader`](#class-reader)objects. When `rescan` is true, forces list to be reread from PC/SC, otherwise reader list will be cached (and automatically updated during calls to `waitForChange`).

#### Method: `async waitForChange()`
`waitForChange` waits for a change - card insertion/removal or reader plug/unplug. If a notify handler 
has been registered, that will be called once for each change detected. A `timeout` (ms) may be specified
after which the method will automatically resolve.

Returns an array of Readers that have changed, or [] when no change detected.

#### Method: `shutdown()`
`shutdown` shutsdown all `Reader`s and closed the connection to the PC/SC deamon

#### Property: `onStatusChange`
Set `onStatusChange` to receive notifications for reader/card events. The supplied callback will be called with a `reader` object and a `status` indicative of the motive (type of change).

| Status      | Description |
| ------------| ----------- |
| `setup`     | New reader detected (or plugged in) |
| `empty`     | No card present |
| `present`   | Card present but not connected |
| `connected` | Card present and connected |
| `mute`      | Non-responsive card present |
| `shutdown`  | Reader can no longer be used - unplugged or `shutdown`  |

Note: if `onStatusChange` is set before the first call to `waitForChange`, then the callback will be notified once for each
reader detected, with status `setup`. From that point on, further calls to `waitForChange` will automatically detect any 
newly inserted (plugged-in) or removed (unplugged) readers and notify with `setup` ou `shutdown` status's respectively.

### Class: `Reader`

#### Method: `async connect()`
Attempt to connect to a card, and if successful, returns a [`Card`](#class-card) object 
that will allow communication. A connection may be either SHARED or EXCLUSIVE.

#### Method: `shutdown()`
`shutdown` shutsdown and cleans up the reader object. 

#### Method: `async waitForChange()`
Waits for a change with this reader such as card insertion, removal, connection or disconnection, returning, 
on completion, the current reader [`status`](#property-status). An optional timeout value (in ms) may be supplied, defaulting to "immediate" if absent. Should no change be detected within the specified timeout, `no-change` is returned.

Upon successful completion, `waitforChange` will update internal state that can be inspected from class properties such as 
[`state`](#property-state), [`status`](#property-status), as well as `isPresent`, `isMute` and `isConnected`.

#### Property: `name`
Returns reader name as string.

#### Property: `state`
Return PC/SC `currentState` bits, a set of `StateFlag` bits, as seen during most recent call to `waitForChange`

#### Property: `status`
Returns the reader status as seen during most recent call to `waitForChange` on `Reader`/`Context`, see [Context.onStatusChange](#property-onstatuschange)


#### Property: `isPresent`
Returns true if a card is present (inserted or within contactless range). See `status` property.

#### Property: `isMute`
Returns true if a non-responsive card is detected. See `status` property.

#### Property: `isConnected`
Returns true if a card is present AND connected. See `status` property.

#### Property: `readerState` (only on FFIReader class)
Returns an instance of PC/SC `SCARDREADERSTATE` containing name, current state flags and ATR.

#### Property: `onStatusChange`
Set `onStatusChange` to receive notifications for reader/card events, for current reader only.


### Class: `Card`

#### Method: `async transmit()`
`transmit` sends a serialized APDU to the card and waits for a response. Both input and output APDUs are serialized
byte buffers (`Uint8Array`).

#### Method: `async transmitAPDU()`
`transmit` serializes an [`APDUCommand`](#class-apducommand) object, transmits it to the card, waits for a response and deserializes an [`APDUResponse`](#class-apduresponse)  object.

#### Method: `reconnect()`
`reconnect` reestablishes a connection to the card using a new set of communication parameters (protocol, shareMode), and optionally resetting 
or powering-off the card during the reconnect process. 

#### Method: `disconnect()`
`disconnect` closes this connection to the card, optionally resetting or powering-off the card. 

#### Property: `isConnected`
Returns true if this card object is connected (initially true, becomes false after a `disconnect`).


### Class: `APDUCommand`
Encapsulates an ISO7816 APDU command, allowing (de)serialization to/from byte buffers.

#### Constructor: `APDUCommand()`
Construct a new APDU command object, setting `CLA`, `INS`, `P1`, `P2`, optional DATA and LE, and extended options.
If DATA is supplied, it can be an `Uint8Array`, an array or iterator that maps to `Number[]`.

Additional options may be supplied:

| Option | Description |
| ----- | ------ |
| `isExtended` | Pass `true` to enable ISO extended-length APDUs |
| `description` | optional description (useful for logging and debugging) |


#### Method: `toBytes()`
Serialize APDU command to a byte-buffer, correctly encoding the different ISO APDU classes (1-4).

If `{ isExtended: true }` is passed to constructor, will serialize as extended-length (Lc/Le encoded on 3 bytes) when required,
otherwise will serialize as normal (short) APDU.

#### Method: `setCLA/setINS/setP1/setP2/setData/setLe`
Fluent (chainable) methods for building an APDU from it's constituent parts.

#### Method: `static from()`
Static decoder, parses a byte-like buffer into an `APDUCommand` object. Current only handles non-extended length APDUs.

#### Property: `cla/ins/p1/p2/data/le`
Public properties of the command APDU.


### Class: `APDUResponse`
Encapsulates an ISO7816 APDU response, allowing (de)serialization to/from byte buffers.

#### Constructor: `APDUResponse()`
Construct a new APDU response object, setting SW and DATA.
If DATA is supplied, it can be an `Uint8Array`, an array or iterator that maps to `Number[]`.

#### Method: `toBytes()`
Serialize APDU response to a byte-buffer. 

#### Method: `setSW/setSW1/setSW2/setData`
Fluent (chainable) methods for building a response APDU from it's constituent parts.

#### Method: `static from()`
Static decoder, parses a byte-like buffer into an `APDUResponse` object.

#### Property: `SW/data`
Public (readonly) properties of the response APDU.

---
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
| `SCardControl`          | Directly control reader |
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
