import {
  Card as ICard,
  Context as IContext,
  Reader as IReader,
  ReaderStatus,
  ReaderStatusChangeHandler,
} from "../pcsc/context.ts";

import { CommandAPDU, ResponseAPDU } from "../iso7816/apdu.ts";

import {
  Disposition,
  DWORD,
  Protocol,
  SCARD_ERROR_TIMEOUT,
  SCARDCONTEXT,
  SCARDHANDLE,
  SCARDREADERSTATE,
  Scope,
  ShareMode,
  StateFlag,
} from "../pcsc/pcsc.ts";

import * as native from "./pcsc-ffi.ts";
import { CSTR } from "./ffi-utils.ts";
import { SmartCardException } from "../iso7816/apdu.ts";

/**
 * Context for Deno FFI PC/SC wrapper
 */
export class Context implements IContext<Card, Reader> {
  #context?: SCARDCONTEXT;
  #readers: Map<string, Reader>;
  #pnpReader: Reader;

  #readerPromise?: Promise<void> = undefined;

  protected constructor(context: SCARDCONTEXT) {
    this.#context = context;
    this.#readers = new Map();
    this.#pnpReader = new Reader(this, "");
  }

  getReaders(rescan = false): Promise<Reader[]> {
    const update = (rescan) ? this.#listReaders() : Promise.resolve();

    return update.then(() => Array.from(this.#readers.values()));
  }

  waitForChange(
    readers: Reader[],
    timeout = 0,
    rescan = false,
  ): Promise<Reader[]> {
    if (!readers.every((reader) => (reader instanceof Reader))) {
      throw new Error("Invalid param - reader");
    }

    const readersReq = (rescan) ? [this.#pnpReader, ...readers] : readers;

    return this.#waitForChange(readersReq, timeout).then(async (changed) => {
      if (rescan && changed.includes(this.#pnpReader)) {
        const [_, ...readers] = changed;

        await this.#updateReaderList(readers.map((reader) => reader.name));

        return readers;
      } else {
        return changed;
      }
    });
  }

  get context() {
    return this.#context;
  }

  static establishContext(scope: Scope = Scope.System): Context {
    const context: SCARDCONTEXT = native.SCardEstablishContext(scope);

    return new Context(context);
  }

  static isValidContext(context?: SCARDCONTEXT): context is SCARDCONTEXT {
    return context !== undefined;
  }

  releaseContext() {
    if (Context.isValidContext(this.#context)) {
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
    if (Context.isValidContext(this.#context)) {
      native.SCardCancel(this.#context);
    }
  }

  #waitForChange(readers: Reader[], timeout: number): Promise<Reader[]> {
    if (!Context.isValidContext(this.#context)) {
      return Promise.resolve([]);
    }

    const states = readers.map(
      (reader) => reader.readerState,
    );

    return native.SCardGetStatusChange(this.#context, timeout, states)
      .then((res) => {
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
      });
  }

  #updating = false;
  async #listReaders() {
    if (!this.#updating && Context.isValidContext(this.#context)) {
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
              readerNamesString.buffer.subarray(val, 1 + array[index + 1]),
            )
            : []
        );

      const names = readerNames.map((r) => r.toString());

      console.log(names);

      this.#updating = true;
      try {
        await this.#updateReaderList(names);
      } finally {
        this.#updating = false;
      }
    }
  }

  async #updateReaderList(names: string[]) {
    const actualNames = Array.from(this.#readers.keys());

    const addedNames = names.filter((n) => !actualNames.includes(n));
    const removedNames = actualNames.filter((n) => !names.includes(n));

    for (const name of removedNames) { //ach( async (name) => {
      const reader = this.#readers.get(name);

      if (reader) {
        reader.shutdown();

        this.#readers.delete(name);

        await this.#notifyListeners(reader);
      }
    }

    const addedReaders: Reader[] = [];
    for (const name of addedNames) {
      const reader = new Reader(this, name);

      this.#readers.set(name, reader);

      addedReaders.push(reader);
    }

    await this.#waitForChange(addedReaders, 0);

    for (const reader of addedReaders) {
      await this.#notifyListeners(reader);
    }
  }

  #notifyListeners(reader: Reader) {
    if (this.#onStatusChange !== undefined) {
      this.#onStatusChange(reader, reader.status);
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

/**
 * Reader for Deno FFI PC/SC wrapper
 */
export class Reader implements IReader<Card> {
  #state: native.SCARDREADERSTATE_FFI;
  #status: ReaderStatus;

  constructor(
    public readonly context: Context,
    readerName: string,
  ) {
    this.#state = new native.SCARDREADERSTATE_FFI(
      CSTR.from(readerName),
      null,
      () => { this.#updateState() },
    );
    this.#status = "setup";
  }

  shutdown() {
    this.#status = "shutdown";
  }

  onStatusChange?: ReaderStatusChangeHandler<Card, IReader<Card>>;

  get name() {
    return this.#state.name.toString();
  }

  get status(): ReaderStatus {
    return this.#status;
  }

  waitForChange(_timeout: DWORD = 0): Promise<ReaderStatus> {
    return this.context.waitForChange([this], 0)
      .then((_) => this.status);
  }

  get state(): StateFlag {
    return this.#state.currentState;
  }

  get isPresent(): boolean {
    return (this.#state.currentState & StateFlag.Present) != 0;
  }

  connect(
    shareMode = ShareMode.Shared,
    supportedProtocols = Protocol.Any,
  ): Promise<Card> {
    if (!Context.isValidContext(this.context.context)) {
      throw new SmartCardException("SmartCard context is shutdown");
    }

    const { handle, protocol } = native.SCardConnect(
      this.context.context,
      this.#state.name,
      shareMode,
      supportedProtocols,
    );

    return Promise.resolve(new Card(this, handle, protocol));
  }

  get readerState(): SCARDREADERSTATE<CSTR, null> {
    return this.#state;
  }

  #updateState(): void {
    const current = this.#state.currentState;
    const event = this.#state.eventState;
    const status = this.#status;

    console.log(`updateState: cur=${current.toString(16)} event=${event}` );

    if (this.#status == "shutdown") {
      // we're dead
      return;
    } else if (this.#status == "setup") {
      if (this.#state.currentState == StateFlag.Unknown) {
        // ignore 1st state change, so that listeners receive event with "setup"
        return;
      }
    }

    if (event & StateFlag.Present) {
      if (event & StateFlag.Inuse) {
        this.#status = "connected";
      }
      else if (event & StateFlag.Mute) {
        this.#status = "mute";
      }
      else {//if (event & StateFlag.Unpowered) {
        this.#status = "present";
      }
    }
    else if (event & StateFlag.Empty) {
      this.#status = "empty";
    }

    if (status != this.#status) {
      this.#notifyListeners();
    }
  }

  #notifyListeners() {
    if (this.onStatusChange !== undefined) {
      this.onStatusChange(this, this.status);
    }
  }

}

/**
 * Card for Deno FFI PC/SC wrapper
 */
export class Card implements ICard {
  #protocol: number;
  #handle: SCARDHANDLE;

  constructor(
    public readonly reader: Reader,
    handle: SCARDHANDLE,
    protocol: number,
  ) {
    this.#handle = handle;
    this.#protocol = protocol;
  }

  get isConnected(): boolean {
    return this.reader.status != "connected";
  }

  get protocol() {
    return this.#protocol;
  }

  get handle() {
    return this.#handle;
  }

  transmit(command: Uint8Array, expectedLen?: number): Promise<Uint8Array> {
    if (!this.#handle) {
      throw new SmartCardException("SmartCard disconected");
    }

    const response = native.SCardTransmit(
      this.handle,
      command,
      2 + (expectedLen ?? 256),
    );

    return Promise.resolve(response);
  }

  transmitAPDU(commandAPDU: CommandAPDU): Promise<ResponseAPDU> {
    const commandBytes = commandAPDU.toBytes({ protocol: this.#protocol });

    const response = native.SCardTransmit(
      this.handle,
      commandBytes,
      2 + (commandAPDU.le ?? 0),
    );

    return Promise.resolve(new ResponseAPDU(response));
  }

  reconnect(
    shareMode = ShareMode.Shared,
    preferredProtocols = Protocol.Any,
    initialization = Disposition.LeaveCard,
  ): Promise<ReaderStatus> {
    if (!this.#handle) {
      throw new SmartCardException("SmartCard disconected");
    }

    const { protocol } = native.SCardReconnect(
      this.#handle,
      shareMode,
      preferredProtocols,
      initialization,
    );

    this.#protocol = protocol;

    return this.reader.waitForChange();
  }

  disconnect(disposition = Disposition.LeaveCard): Promise<ReaderStatus> {
    if (this.#handle) {
      try {
        //
        native.SCardDisconnect(
          this.#handle,
          disposition,
        );
      } finally {
        this.#protocol = 0;
        this.#handle = 0;
      }
    }

    return this.reader.waitForChange();
  }
}
