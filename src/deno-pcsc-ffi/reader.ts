import { Reader as IReader, Card as ICard } from '../card-reader.ts';
import { SCARD_SHARE_SHARED, SCARD_PROTOCOL_ANY } from "../pcsc-types/mod.ts";
import { Context } from "./context.ts";
import { Card } from "./card.ts";

import { CSTR } from "./ffi-utils.ts";
import * as native from "./pcsc-ffi.ts";

export class Reader implements IReader {
  #context: Context;
  #readerName: CSTR;
  #state: Uint8Array;

  constructor(
    context: Context,
    readerName: CSTR,
  ) {
    this.#context = context;
    this.#readerName = readerName;
    this.#state = new Uint8Array(64);
  }

  get name() {
    return this.#readerName.toString();
  }

  get isPresent() {
    // TODO: SCardGetStatusChange
    return true;
  }

  connect(shareMode = SCARD_SHARE_SHARED, supportedProtocols = SCARD_PROTOCOL_ANY): ICard {
    const { handle, protocol } = native.SCardConnect(
      this.#context.context,
      this.#readerName,
      shareMode,
      supportedProtocols,
    );

    return new Card(this, handle, protocol);
  }
}
