import { IReader, SmartCardException } from '../card-reader.ts';
import { DWORD, SCARD_SHARE_SHARED, SCARD_PROTOCOL_ANY, SCARD_STATE_PRESENT, SCARD_STATE_CHANGED } from "../pcsc-types/mod.ts";
import { Context } from "./context.ts";
import { Card } from "./card.ts";

import { CSTR } from "./ffi-utils.ts";
import * as native from "./pcsc-ffi.ts";

export class Reader implements IReader {
  #context: Context;
  #readerName: string;
  #state: native.SCARDREADERSTATE;
  #lifeCycle: "new"|"active"|"dead";

  constructor(
    context: Context,
    readerName: string,
  ) {
    this.#context = context;
    this.#readerName = readerName;
    this.#state = new native.SCARDREADERSTATE(readerName);
    this.#lifeCycle = "new";
  }

  shutdown() {
    this.#lifeCycle = "dead";
  }

  get name() {
    return this.#readerName;
  }

  get isActive(): boolean {
    return this.#lifeCycle != "dead";
  }

  get isPresent(): Promise<boolean> {
    return this.#updateState(0).then(
      (_) => (this.#state.eventState & SCARD_STATE_PRESENT)!=0
    )
  }

  connect(shareMode = SCARD_SHARE_SHARED, supportedProtocols = SCARD_PROTOCOL_ANY): Promise<Card> {
    if (!this.#context.isValidContext(this.#context.context)) {
      throw new SmartCardException("SmartCard context is shutdown");
    }

    const { handle, protocol } = native.SCardConnect(
      this.#context.context,
      CSTR.from(this.#readerName),
      shareMode,
      supportedProtocols,
    );

    return Promise.resolve(new Card(this, handle, protocol));
  }

  get readerState(): native.SCARDREADERSTATE {
    return this.#state; 
  }

  #updateState(timeout: DWORD): Promise<boolean> {
    switch( this.#lifeCycle ) {
      case "new":
        this.#state.currentState = 0;
        this.#lifeCycle = "active";
        /* falls through */

      case "active": {
        return this.#context.waitForChange( [this], timeout)
        .then((_)=> (this.#state.eventState & SCARD_STATE_CHANGED)!=0 );
      }

      default:
        return Promise.resolve(false);
    }
  }
}
