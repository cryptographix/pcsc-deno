import { IReader, SmartCardException } from '../card-reader.ts';
import { SCARD_SHARE_SHARED, SCARD_PROTOCOL_ANY, SCARD_STATE_PRESENT } from "../pcsc-types/mod.ts";
import { Context } from "./context.ts";
import { Card } from "./card.ts";

import { CSTR } from "./ffi-utils.ts";
import * as native from "./pcsc-ffi.ts";

export class Reader implements IReader {
  #context: Context;
  #readerName: CSTR;
  #state: native.SCARDREADERSTATE;

  constructor(
    context: Context,
    readerName: CSTR,
  ) {
    this.#context = context;
    this.#readerName = readerName;
    this.#state = new native.SCARDREADERSTATE(readerName);
  }

  get name() {
    return this.#readerName.toString();
  }

  get isPresent(): Promise<boolean> {
    return this.#context.waitForChange( [this], 0)
    .then( () => {
      return !!(this.#state.currentState & SCARD_STATE_PRESENT);
    });
  }

  connect(shareMode = SCARD_SHARE_SHARED, supportedProtocols = SCARD_PROTOCOL_ANY): Card {
    if (!this.#context.isValidContext(this.#context.context)) {
      throw new SmartCardException("SmartCard context is shutdown");
    }

    const { handle, protocol } = native.SCardConnect(
      this.#context.context,
      this.#readerName,
      shareMode,
      supportedProtocols,
    );

    return new Card(this, handle, protocol);
  }

  get readerState(): native.SCARDREADERSTATE {
    return this.#state; 
  }
}
