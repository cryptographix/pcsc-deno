import { Card as ICard } from '../card-reader.ts';
import { SCARDHANDLE, SCARD_SHARE_SHARED, SCARD_PROTOCOL_ANY, SCARD_LEAVE_CARD } from "../pcsc-types/mod.ts";
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

  get protocol() { return this.#protocol; }
  get handle() { return this.#handle; }

  transmit( commandAPDU: Uint8Array, expectedLen?: number ): Uint8Array {
    const responseAPDU = native.SCardTransmit( this.handle, commandAPDU, expectedLen ?? 256 );

    return responseAPDU;
  }

  reconnect( shareMode = SCARD_SHARE_SHARED, preferredProtocols = SCARD_PROTOCOL_ANY, initialization = SCARD_LEAVE_CARD): void {
    const { protocol } = native.SCardReconnect(
      this.#handle,
      shareMode,
      preferredProtocols,
      initialization
    );

    this.#protocol = protocol;
  }

  disconnect( disposition = SCARD_LEAVE_CARD ): void {
    native.SCardDisconnect(
      this.#handle,
      disposition
    );

    this.#protocol = 0;
    this.#handle = 0;
  }
}
