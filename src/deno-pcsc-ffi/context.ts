import { IContext, ReaderEventHandler } from "../card-reader.ts";
import {
  DWORD,
  SCARD_SCOPE_SYSTEM,
  SCARD_STATE_CHANGED,
  SCARDCONTEXT,
} from "../pcsc-types/mod.ts";
import { Reader } from "./reader.ts";

import * as native from "./pcsc-ffi.ts";
import { CSTR } from "./ffi-utils.ts";

export class Context implements IContext {
  #context: SCARDCONTEXT;
  #readers: Map<string, Reader>;
  #eventHandlers: ReaderEventHandler[] = [];

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

  releaseContext() {
    native.SCardReleaseContext(this.#context);
    this.#context = 0;
  }

  #readerPromise?: Promise<number> = undefined;
  #setupReaderPromise() {
    if (this.#readerPromise === undefined) {
      const r = new Reader(this, CSTR.from("\\?PnP?\Notification"));

      this.#readerPromise = native.SCardGetStatusChange(
        this.#context,
        0xFFFFFFFF,
        [
          r.readerState,
        ],
      ).finally(() => {
        this.#readerPromise = undefined;
      });

      this.#readerPromise.then((res) => {
        if (res == 0 && this.#context !== 0) {
          this.#eventHandlers.forEach(
            (h: ReaderEventHandler) => {
              h("reader-inserted", new Reader(this, CSTR.from("")));
            },
          );
        }
      }).finally(() => {
        // rerun async
        if (this.#context !== 0) {
          this.#setupReaderPromise();
        }
      });
    }
  }

  #addEventHandler(handler: ReaderEventHandler) {
    this.#eventHandlers.push(handler);

    this.#setupReaderPromise();
  }

  onReaderEvent(handler: ReaderEventHandler): () => void {
    this.#addEventHandler(handler);

    return () => {
      this.#eventHandlers = this.#eventHandlers.filter((h) => (h != handler));
    };
  }

  shutdown() {
    this.cancel();

    this.releaseContext();

    this.#readers = new Map();
    this.#eventHandlers = [];
  }

  listReaderNames(): string[] {
    this.updateReaders();

    return Array.from(this.#readers.keys());
  }

  listReaders(): Reader[] {
    this.updateReaders();

    return Array.from(this.#readers.values());
  }

  cancel() {
    native.SCardCancel(this.#context);
  }

  waitForChange(readers: Reader[], timeout: number): Promise<Reader[]> {
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

  private updateReaders() {
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

    this.#readers = readerNames
      .reduce(
        (map, name) => map.set(name.toString(), new Reader(this, name)),
        new Map<string, Reader>(),
      );
  }
}
