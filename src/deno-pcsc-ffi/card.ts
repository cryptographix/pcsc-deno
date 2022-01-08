import { Card as ICard } from '../card-reader.ts';
import { SCARDHANDLE } from "../pcsc-types/mod.ts";
import { Reader } from "./reader.ts";
import * as native from "./pcsc-ffi.ts";

export class Card implements ICard {
  #protocol: number;
  #handle: SCARDHANDLE;

  constructor(
    public reader: Reader,
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
}
