import { Card, Context, Reader, ReaderStatusChangeHandler } from '../pcsc/context.ts';
import { SCARD_ERROR_TIMEOUT, SCARDCONTEXT, Scope, StateFlag } from '../pcsc/pcsc.ts';

import * as native from './pcsc-ffi.ts';
import { CSTR } from './ffi-utils.ts';

import { FFIReader } from './reader.ts';

/**
 * Context for Deno FFI PC/SC wrapper
 */
export class FFIContext implements Context {
  #context?: SCARDCONTEXT;
  #readers: Map<string, FFIReader>;
  #pnpReader: FFIReader;

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

    const res = await native.SCardGetStatusChange(this.#context, timeout, states);

    if (res == 0) {
      return readers.filter((r) =>
        r.readerState.eventState & StateFlag.Changed
      );
    } else {
      if (res == SCARD_ERROR_TIMEOUT) {
        // timeout/error with no change
        return [];
      } else {
        //TODO: Error
        return [];
      }
    }

  }

  #updating = false;
  async #listReaders() {
    if (!this.#updating && FFIContext.isValidContext(this.#context)) {
      const readerNamesString = CSTR.alloc(
        native.SCardListReaders(this.#context, null, null),
      );

      native.SCardListReaders(this.#context, null, readerNamesString);

      // got a multi-string - a double-null terminated list of null-terminated strings
      // parse and map to array of CSTR
      const readerNames = readerNamesString.buffer
        // find \0 terminators
        .reduce<number[]>(
          (acc, cur, curIdx) => (cur == 0) ? [...acc, curIdx] : acc,
          [0],
        )
        // remove final "double" terminator
        .slice(0, -1)
        // and map to zero-copy CSTR
        .flatMap<CSTR>((val, index, array) =>
          (index < array.length - 1)
            ? CSTR.fromNullTerminated(
              readerNamesString.buffer.subarray(val, 1 + array[index + 1]),
            )
            : []
        );

      this.#updating = true;
      try {
        await this.#updateReaderList(readerNames);
      } finally {
        this.#updating = false;
      }
    }
  }

  async #updateReaderList(readerNames: CSTR[]) {
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
    await this.#waitForChange(addedReaders, 0);

    // and notify ...
    for (const reader of addedReaders) {
      this.#notifyListeners(reader);
    }
  }

  #notifyListeners(reader: FFIReader) {
    this.#onStatusChange?.(reader, reader.status);
  }

  protected constructor(context: SCARDCONTEXT) {
    this.#context = context;
    this.#readers = new Map();
    this.#pnpReader = new FFIReader(this, CSTR.from("\\\\?PnP?\\Notification"));
  }

  async getReaders(rescan = false): Promise<Reader[]> {
    if (rescan) {
      await this.#listReaders();
    }

    return Array.from(this.#readers.values());
  }

  async waitForChange(
    readers?: Reader[],
    timeout = 0,
    rescan = false,
  ): Promise<Reader[]> {
    readers = readers ?? await this.getReaders();

    const readersReq = (rescan) ? [this.#pnpReader, ...readers] : readers;

    const changed = await this.#waitForChange(readersReq, timeout);

    if (rescan && changed.includes(this.#pnpReader)) {
      const [_, ...readers] = changed;

      await this.#updateReaderList(
        readers.map((reader) => reader.readerState.name),
      );

      return readers;
    } else {
      return changed;
    }
  }

  get context() {
    return this.#context;
  }

  static establishContext(scope: Scope = Scope.System): FFIContext {
    const context: SCARDCONTEXT = native.SCardEstablishContext(scope);

    return new FFIContext(context);
  }

  static isValidContext(context?: SCARDCONTEXT): context is SCARDCONTEXT {
    return context !== undefined;
  }

  releaseContext() {
    if (FFIContext.isValidContext(this.#context)) {
      native.SCardReleaseContext(this.#context);
    }

    this.#context = undefined;
  }

  #onStatusChange?: ReaderStatusChangeHandler<Card, Reader>;

  get onStatusChange() {
    return this.#onStatusChange;
  }

  set onStatusChange(
    handler: ReaderStatusChangeHandler<Card, Reader> | undefined,
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

      this.releaseContext();
    } catch (_) {
      // fail silently .. we're shutting down
    }

    return Promise.resolve();
  }

  cancel() {
    if (FFIContext.isValidContext(this.#context)) {
      native.SCardCancel(this.#context);
    }
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

