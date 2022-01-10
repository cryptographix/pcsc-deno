import { ICard, SmartCardException } from "../card-reader.ts";
import { CommandAPDU } from '../command-apdu.ts';
import { ResponseAPDU } from '../response-apdu.ts';

import {
  SCARD_LEAVE_CARD,
  SCARD_PROTOCOL_ANY,
  SCARD_SHARE_SHARED,
  SCARDHANDLE,
} from "../pcsc-types/mod.ts";
import { Reader } from "./reader.ts";
import * as native from "./pcsc-ffi.ts";

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

  get protocol() {
    return this.#protocol;
  }

  get handle() {
    return this.#handle;
  }

  transmit(command: Uint8Array, expectedLen?: number): Uint8Array {
    if (!this.#handle) {
      throw new SmartCardException("SmartCard disconected");
    }

    const response = native.SCardTransmit(
      this.handle,
      command,
      expectedLen ?? 256,
    );

    return response;
  }

  transmitAPDU(commandAPDU: CommandAPDU): ResponseAPDU {
    const commandBytes = commandAPDU.toBytes({protocol: this.#protocol});

    const response = native.SCardTransmit(
      this.handle,
      commandBytes,
      commandAPDU.Le??0,
    );

    return ResponseAPDU.from(response);
  }

  reconnect(
    shareMode = SCARD_SHARE_SHARED,
    preferredProtocols = SCARD_PROTOCOL_ANY,
    initialization = SCARD_LEAVE_CARD,
  ): void {
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
  }

  disconnect(disposition = SCARD_LEAVE_CARD): void {
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
  }
}
