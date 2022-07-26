import { Context, Reader, Protocol,  SCARDCONTEXT, ShareMode, StateFlag, Scope } from '../pcsc/pcsc.ts';
import { ReaderStatusChangeHandler } from '../pcsc/context.ts';

import { SmartCardException } from '../iso7816/iso7816.ts';

import * as native from './pcsc-ffi-wrapper.ts';
import { CSTR } from './ffi-utils.ts';

//import { SCARDCONTEXT, Scope, StateFlag, ShareMode, Protocol } from '../pcsc/pcsc.ts';

import { FFIReader, FFI_SCARDREADERSTATE } from './reader.ts';
import { SCardIsValidContext } from "./pcsc-ffi-wrapper.ts";

/**
 * Context for Deno FFI PC/SC wrapper
 */
export class FFIContext implements Context {
  #context?: SCARDCONTEXT;

  #readers: Map<string, FFIReader>;

  #pnpReader: FFIReader;

  #onStatusChange?: ReaderStatusChangeHandler;

  #updating = false;

  //#readerPromise?: Promise<void> = undefined;

  async #waitForChange(readers: Reader[], timeout: number): Promise<FFIReader[]> {
    if (!FFIContext.isValidContext(this.#context)) {
      return [];
    }

    if (!FFIReader.isValidReaders(readers)) {
      return [];
    }

    const states = readers.map(
      (reader) => reader.readerState,
    );

    const changed = await native.SCardGetStatusChange(this.#context, timeout, states);

    // return all Readers[] that signalled state-change
    return changed.flatMap(
      chg => ( readers[ chg ].readerState.eventState & StateFlag.Changed ) ? readers[ chg ] : [] 
    );
  }

  #getReaderStatus(readers: Reader[]): FFIReader[] {
    if (!FFIContext.isValidContext(this.#context)) {
      return [];
    }

    if (!FFIReader.isValidReaders(readers)) {
      return [];
    }

    const states = readers.map(
      (reader) => reader.readerState,
    );

    const changed = native.SCardGetStatusChangeSync(this.#context, 0, states);

    // return all Readers[] that signalled state-change
    return changed.flatMap(
      chg => ( readers[ chg ].readerState.eventState & StateFlag.Changed ) ? readers[ chg ] : [] 
    );
  }

  #listReaders() {
    if (!this.#updating && FFIContext.isValidContext(this.#context)) {
      const readerNamesString = CSTR.alloc(
        native.SCardListReaders(this.#context, null, null),
      );

      native.SCardListReaders(this.#context, null, readerNamesString);

      // got a multi-string - a double-null terminated list of null-terminated strings
      // parse and map to array of CSTR
      const readerNames = FFIContext.readerNamesToArray(readerNamesString.buffer);

      this.#updating = true;
      try {
        this.#updateReaderList(readerNames);
      } finally {
        this.#updating = false;
      }
    }
  }

  #updateReaderList(readerNames: CSTR[]) {
    const actualNames = Array.from(this.#readers.keys());

    const names = readerNames.map((r) => r.toString());

    // identify and delete any recently "removed" readers
    // ... notify
    actualNames
      .filter((n) => !names.includes(n))
      .forEach(name => {
        const reader = this.#readers.get(name);

        if (reader) {
          reader.shutdown();

          this.#readers.delete(name);

          this.#notifyListeners(reader);
        }
      });

    // identify and instantiate any newly inserted readers
    const addedReaders = readerNames
      .filter((n) => !actualNames.includes(n.toString()))
      .map(name => {
        const reader = new FFIReader(this, name);

        this.#readers.set(name.toString(), reader);

        return reader;
      });

    // get initial status
    this.#getReaderStatus(addedReaders);

    // and notify ...
    for (const reader of addedReaders) {
      this.#notifyListeners(reader);
    }
  }

  #releaseContext() {
    if (FFIContext.isValidContext(this.#context)) {
      native.SCardReleaseContext(this.#context);
    }

    this.#context = undefined;
  }

  #notifyListeners(reader: FFIReader) {
    this.#onStatusChange?.(reader, reader.status);
  }

  protected constructor(context: SCARDCONTEXT) {
    this.#context = context;
    this.#readers = new Map();
    this.#pnpReader = new FFIReader(this, CSTR.from("\\\\?PnP?\\Notification"));
  }

  listReaders(rescan = false): FFIReader[] {
    if (rescan || this.#readers.size == 0) {
      this.#listReaders();
    }

    return Array.from(this.#readers.values());
  }

  async waitForChange(
    readers?: Reader[],
    timeout = 0,
    rescan = true,
  ): Promise<FFIReader[]> {
    readers = readers ?? this.listReaders();

    const readersReq = (rescan) ? [this.#pnpReader, ...readers] : readers;

    const changed = await this.#waitForChange(readersReq, timeout);

    if (rescan && changed.includes(this.#pnpReader)) {
      const [_, ...readers] = changed;

      this.#updateReaderList(
        readers.map((reader) => reader.readerState.name),
      );

      return readers;
    } else {
      return changed;
    }
  }

  get onStatusChange() {
    return this.#onStatusChange;
  }

  set onStatusChange(
    handler: ReaderStatusChangeHandler | undefined,
  ) {
    this.#onStatusChange = handler;

    // if (handler !== undefined) {
    //   this.#setupReaderPromise();
    // }
  }

  shutdown(): Promise<void> {
    this.#readers.forEach((reader) => {
      reader.shutdown();
    });

    this.#readers = new Map();
    this.#onStatusChange = undefined;

    try {
      this.cancel();

      this.#releaseContext();
    } catch (_) {
      // fail silently .. we're shutting down
    }

    return Promise.resolve();
  }

  // FFI-specific methods
  isValid(): boolean {
    return FFIContext.isValidContext(this.#context);
  }

  connect(name: CSTR,
    shareMode: ShareMode,
    supportedProtocols: Protocol) {

    if (!this.isValid()) {
      throw new SmartCardException("SmartCard context is shutdown");
    }
   
    // Connect to Card
    return native.SCardConnect(
      this.#context!,
      name,
      shareMode,
      supportedProtocols,
    );
  }
  /*get context() {
    return this.#context;
  }*/

  static establishContext(scope: Scope = Scope.System): FFIContext {
    const context: SCARDCONTEXT = native.SCardEstablishContext(scope);

    return new FFIContext(context);
  }

  static isValidContext(context?: SCARDCONTEXT): context is SCARDCONTEXT {
    return (context !== undefined) && SCardIsValidContext(context);
  }
  cancel() {
    if (FFIContext.isValidContext(this.#context)) {
      native.SCardCancel(this.#context);
    }
  }

  // parse PC/SC multi-string - a double-null terminated list of null-terminated strings
  // and map to array of CSTR
  static readerNamesToArray(readerNames: Uint8Array): CSTR[] {
    return readerNames
      // find \0 terminators
      .reduce<number[]>(
        (acc, cur, curIdx) => (cur == 0) ? [...acc, curIdx + 1] : acc,
        [0],
      )
      // remove final "double" terminator
      .slice(0, -1)
      // and map to zero-copy CSTR
      .flatMap<CSTR>((val, index, array) =>
        (index < array.length - 1)
          ? CSTR.fromNullTerminated(
            readerNames.subarray(val, 1 + array[index + 1]),
          )
          : []
      );

  }


  // #setupReaderPromise() {
  //   if (
  //     this.#readerPromise === undefined && Context.isValidContext(this.#context)
  //   ) {
  //     const readers = [
  //       new Reader(this, "\\?PnP?\Notification"),
  //       ...Array.from(this.#readers.values()),
  //     ];

  //     /*      this.#readerPromise = native.SCardGetStatusChange(
  //       this.#context,
  //       INFINITE,
  //       [
  //         r.readerState,
  //       ],
  //     )*/
  //     this.#readerPromise = this.#waitForChange(readers, INFINITE)
  //       .then(async (_res) => {
  //         this.#readerPromise = undefined;

  //         if (/*res == 0 && */ Context.isValidContext(this.#context)) {
  //           await this.#updateReaders();
  //         }
  //       }).finally(async () => {
  //         // rerun async
  //         if (
  //           Context.isValidContext(this.#context) &&
  //           this.#onStatusChange !== undefined
  //         ) {
  //           await this.#setupReaderPromise();
  //         }
  //       });
  //   }
  // }
}

