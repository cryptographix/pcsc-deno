import { CardContext as IContext, Reader as IReader} from '../card-reader.ts';
import { DWORD, SCARDCONTEXT, SCARD_SCOPE_SYSTEM } from "../pcsc-types/mod.ts";
import { Reader } from "./reader.ts";
import * as native from "./pcsc-ffi.ts";
import { CSTR } from "./ffi-utils.ts";

export class Context implements IContext {
  #context: SCARDCONTEXT;
  #readers: Map<string, IReader>;

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

  shutdown() {
    // TODO(@sean)

    // native.SCardReleaseContext( this.#context );
    // this.#context = 0;
    // this.#readers = new Map();
  }

  listReaders(): Map<string, IReader> {
    if (this.#context !== 0) {
      this.updateReaders();
    }

    return this.#readers;
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
