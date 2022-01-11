import {
  IContext,
  IReader,
  ReaderEventHandler,
  ReaderEventType,
  SmartCardException,
} from "../card-reader.ts";
import {
  DWORD,
  SCARD_SCOPE_SYSTEM,
  SCARD_STATE_CHANGED,
  SCARDCONTEXT,
  INFINITE
} from "../pcsc-types/mod.ts";
import { Reader } from "./reader.ts";

import * as native from "./pcsc-ffi.ts";
import { CSTR } from "./ffi-utils.ts";

export class Context implements IContext {
  #context?: SCARDCONTEXT;
  #readers: Map<string, Reader>;
  #eventHandlers: ReaderEventHandler[] = [];
  #readerPromise?: Promise<void> = undefined;

  protected constructor(context: SCARDCONTEXT) {
    this.#context = context;
    this.#readers = new Map();
  }

  get context() {
    return this.#context;
  }

  static establishContext(scope: DWORD = SCARD_SCOPE_SYSTEM): Context {
    const context: SCARDCONTEXT = native.SCardEstablishContext(scope);

    return new Context(context);
  }

  isValidContext(context?: SCARDCONTEXT): context is SCARDCONTEXT {
    return context !== undefined;
  }

  releaseContext() {
    if (this.isValidContext(this.#context)) {
      native.SCardReleaseContext(this.#context);
    }

    this.#context = undefined;
  }

  onReaderEvent(handler: ReaderEventHandler): () => void {
    this.#eventHandlers.push(handler);

    this.#setupReaderPromise();

    return () => {
      this.#eventHandlers = this.#eventHandlers.filter((h) => (h != handler));
    };
  }

  shutdown() {
    this.#readers.forEach( (rdr) => { rdr.shutdown(); } );
    this.#readers = new Map();
    this.#eventHandlers = [];
    try {
      this.cancel();

      this.releaseContext();
    } catch (e) {
      // fail silently .. we're shutting down
    }
  }

  listReaderNames(): string[] {
    this.#updateReaders();

    return Array.from(this.#readers.keys());
  }

  listReaders(): Reader[] {
    this.#updateReaders();

    return Array.from(this.#readers.values());
  }

  cancel() {
    if (this.isValidContext(this.#context)) {
      native.SCardCancel(this.#context);
    }
  }

  waitForChange(readers: IReader[], timeout: number): Promise<IReader[]> {
    function areMyReaders(readers: IReader[]): readers is Reader[] {
      return (readers.every((r) => (r instanceof Reader)));
    }

    if (!areMyReaders(readers)) {
      throw new SmartCardException("Invalid class");
    }

    if (!this.isValidContext(this.#context)) {
      return Promise.resolve([]);
    }

    const states: native.SCARDREADERSTATE[] = readers.map(
      (reader) => reader.readerState,
    );

    return native.SCardGetStatusChange(this.#context, timeout, states)
      .then((res) => {
        if (res == 0) {
          return readers.filter((r) =>
            r.readerState.eventState & SCARD_STATE_CHANGED
          );
        } else {
          // timeout/error with no change
          return [];
        }
      });
  }

  #updateReaders() {
    if (this.isValidContext(this.#context)) {
      const readerNamesString = CSTR.alloc(
        native.SCardListReaders(this.#context, null, null),
      );

      native.SCardListReaders(this.#context, null, readerNamesString);

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
              readerNamesString.buffer.slice(val, array[index + 1]),
            )
            : []
        );

      const names = readerNames.map((r) => r.toString());

      this.#updateReaderList(names);
    }
  }

  #updateReaderList(names: string[]) {
    const actualNames = Array.from(this.#readers.keys());

    const addedNames = names.filter((n) => !actualNames.includes(n));
    const removedNames = actualNames.filter((n) => !names.includes(n));

    removedNames.forEach((name) => {
      const reader = this.#readers.get(name);

      if (reader) {
        reader.shutdown();

        this.#readers.delete(name);

        this.#notifyListeners("reader-removed", reader);
      }
    });

    addedNames.forEach((name) => {
      const reader = new Reader(this, name);

      this.#readers.set(name, reader);

      this.#notifyListeners("reader-inserted", reader);
    });
  }

  #notifyListeners(event: ReaderEventType, reader: Reader) {
    this.#eventHandlers.forEach(
      (handler: ReaderEventHandler) => {
        handler(event, reader);
      },
    );
  }

  #setupReaderPromise() {
    if (
      this.#readerPromise === undefined && this.isValidContext(this.#context)
    ) {
      const r = new Reader(this, "\\?PnP?\Notification");

      this.#readerPromise = native.SCardGetStatusChange(
        this.#context,
        INFINITE,
        [
          r.readerState,
        ],
      ).then((res) => {
        this.#readerPromise = undefined;

        if (res == 0 && this.isValidContext(this.#context)) {
          this.#updateReaders();
        }
      }).finally(() => {
        // rerun async
        // if (this.isValidContext(this.#context)) {
        //   this.#setupReaderPromise();
        // }
      });
    }
  }
}
