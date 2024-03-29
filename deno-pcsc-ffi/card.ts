import { Card, Disposition, Protocol, SCARDHANDLE, ShareMode } from '../pcsc/pcsc.ts';
import { ReaderStatus } from '../pcsc/context.ts';

import { BytesLike, CommandAPDU, ResponseAPDU, SmartCardException } from '../iso7816/iso7816.ts';

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
    return this.#handle != 0;
  }

  get protocol() {
    return this.#protocol;
  }

  get handle() {
    return this.#handle;
  }

  async transmit(command: BytesLike, expectedLen?: number): Promise<Uint8Array> {
    if (!this.#handle) {
      throw new SmartCardException("SmartCard disconected");
    }

    const commandBuffer = BytesLike.toUint8Array(command);

    const response = await native.SCardTransmit(
      this.handle,
      commandBuffer,
      2 + (expectedLen ?? 256),
      this.#protocol,
    );

    return Promise.resolve(response);
  }

  async transmitAPDU(commandAPDU: CommandAPDU): Promise<ResponseAPDU> {
    const commandBytes = commandAPDU.toBytes({ isT0: this.#protocol == Protocol.T0 });

    const response = await native.SCardTransmit(
      this.handle,
      commandBytes,
      2 + (commandAPDU.le ?? 256),
      this.#protocol,
    );

    return ResponseAPDU.from(response);
  }

  reconnect(
    shareMode = ShareMode.Shared,
    preferredProtocols = Protocol.Any,
    initialization = Disposition.LeaveCard,
  ): Promise<ReaderStatus> {
    if (!this.#handle) {
      throw new SmartCardException("SmartCard disconected");
    }

    this.#protocol = 0;
    try {
      const { protocol } = native.SCardReconnect(
        this.#handle,
        shareMode,
        preferredProtocols,
        initialization,
      );
  
      this.#protocol = protocol;
    }
    finally {
      // If reconnect failed, handle is no longer valid
      if (this.#protocol == 0) 
        this.#handle = 0;
    }

    return this.reader.waitForChange() as Promise<ReaderStatus>;
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

    return this.reader.waitForChange() as Promise<ReaderStatus>;
  }
}
