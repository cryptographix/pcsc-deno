import { Reader, ReaderStatus, ReaderStatusChangeHandler } from '../pcsc/context.ts';
import { DWORD, Protocol, ShareMode, StateFlag } from '../pcsc/pcsc.ts';

import * as native from './pcsc-ffi.ts';
import { CSTR } from './ffi-utils.ts';
import { SmartCardException } from '../iso7816/apdu.ts';

import { FFIContext } from './context.ts';
import { FFICard } from './card.ts';
import { SCARDREADERSTATE_FFI } from "./pcsc-ffi.ts";

/**
 * Reader for Deno FFI PC/SC wrapper
 */
export class FFIReader implements Reader {
  #state: native.SCARDREADERSTATE_FFI;
  #status: ReaderStatus;

  constructor(
    public readonly context: FFIContext,
    readerName: CSTR,
  ) {
    this.#state = new native.SCARDREADERSTATE_FFI(
      readerName,
      null,
      () => {
        this.#updateState();
      },
    );
    this.#status = "setup";
  }

  shutdown() {
    this.#status = "shutdown";
  }

  onStatusChange?: ReaderStatusChangeHandler;

  get name() {
    return this.#state.name.toString();
  }

  get status(): ReaderStatus {
    return this.#status;
  }

  async waitForChange(_timeout: DWORD = 0): Promise<ReaderStatus> {
    await this.context.waitForChange([this], 0);

    return this.status;
  }

  get state(): StateFlag {
    return this.#state.currentState;
  }

  get isPresent(): boolean {
    return (this.#state.currentState & StateFlag.Present) != 0;
  }
  get isConnected(): boolean {
    return (this.#state.currentState & StateFlag.Inuse) != 0;
  }
  get isMute(): boolean {
    return (this.#state.currentState & StateFlag.Mute) != 0;
  }

  connect(
    shareMode = ShareMode.Shared,
    supportedProtocols = Protocol.Any,
  ): Promise<FFICard> {
    if (!FFIContext.isValidContext(this.context.context)) {
      throw new SmartCardException("SmartCard context is shutdown");
    }

    const { handle, protocol } = native.SCardConnect(
      this.context.context,
      this.#state.name,
      shareMode,
      supportedProtocols,
    );

    return Promise.resolve(new FFICard(this, handle, protocol));
  }

  get readerState(): SCARDREADERSTATE_FFI {
    return this.#state;
  }

  #updateState(): void {
    const current = this.#state.currentState;
    const event = this.#state.eventState;
    const status = this.#status;

    console.log(`updateState: cur=${current.toString(16)} event=${event}`);

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
      } else if (event & StateFlag.Mute) {
        this.#status = "mute";
      } else { //if (event & StateFlag.Unpowered) {
        this.#status = "present";
      }
    } else if (event & StateFlag.Empty) {
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

  static isValidReader(reader: Reader): reader is FFIReader {
    return (reader instanceof FFIReader);
  }

  static isValidReaders(readers: Reader[]): readers is FFIReader[] {
    return readers.every((reader) => FFIReader.isValidReader(reader));
  }
}
