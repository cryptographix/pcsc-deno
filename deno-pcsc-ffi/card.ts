import { Card, Disposition, Protocol,  SCARDHANDLE, ShareMode } from '../pcsc/pcsc.ts';
import { ReaderStatus } from '../pcsc/context.ts';

import { CommandAPDU, ResponseAPDU, SmartCardException } from '../iso7816/iso7816.ts';

import * as native from './pcsc-ffi-wrapper.ts';
import { FFIReader } from './reader.ts';

/**
 * Card for Deno FFI PC/SC wrapper
 */
export class FFICard implements Card {
  #protocol: number;
  #handle: SCARDHANDLE;

  constructor(
    public readonly reader: FFIReader,
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

  async transmit(command: Uint8Array, expectedLen?: number): Promise<Uint8Array> {
    if (!this.#handle) {
      throw new SmartCardException("SmartCard disconected");
    }

    const response = await native.SCardTransmit(
      this.handle,
      command,
      2 + (expectedLen ?? 256),
    );

    return Promise.resolve(response);
  }

  async transmitAPDU(commandAPDU: CommandAPDU): Promise<ResponseAPDU> {
    const commandBytes = commandAPDU.toBytes({ protocol: this.#protocol });

    const response = await native.SCardTransmit(
      this.handle,
      commandBytes,
      2 + (commandAPDU.le ?? 0),
    );

    return new ResponseAPDU(response);
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
