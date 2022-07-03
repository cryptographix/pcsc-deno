import { StateFlag, StateFlags } from './pcsc.ts';

export const DWORD_SIZE = 4;
export const POINTER_SIZE = 8; // 64 bits only

export const SCARD_ATR_SIZE = 36; //(Deno.build.os == "darwin" ? 36 : 33);

/**
 * SCARDREADER_STATE, 64bits
 * 
 * [ 00 .. 07 ]   Pointer to READER_NAME
 * [ 08 .. 0F ]   Pointer to UserData 
 * [ 10 .. 13 ]   Current State
 * [ 14 .. 17 ]   Actual State
 * [ 18 .. 1B ]   ATR (size)
 * [ 1C .. 3F ]   ATR[36]
 * 
 */
export const CURRENT_STATE_OFFSET = POINTER_SIZE + POINTER_SIZE;
export const ACTUAL_STATE_OFFSET = CURRENT_STATE_OFFSET + DWORD_SIZE;
export const ATR_OFFSET = ACTUAL_STATE_OFFSET + DWORD_SIZE;
export const SCARDREADERSTATE_SIZE = ATR_OFFSET + DWORD_SIZE + SCARD_ATR_SIZE;

// deno-lint-ignore no-explicit-any
export abstract class SCARDREADERSTATE<TNAME=any, TUSERDATA=any> {
  #readerName: TNAME;
  #buffer: Uint8Array;
  #userData?: TUSERDATA;

  #onChange?: () => void;

  constructor(readerName: TNAME, userData?: TUSERDATA, onChange?: () => void) {
    this.#readerName = readerName;
    this.#userData = userData;
    this.#onChange = onChange;

    this.#buffer = new Uint8Array(SCARDREADERSTATE_SIZE);

    this.initBuffer();
  }

  handleChange(buffer: Uint8Array): boolean {
    // update internal buffer
    // DO NOT update name/userData pointers
    // TODO: check ATR length
    this.#buffer.set(buffer.slice(CURRENT_STATE_OFFSET), CURRENT_STATE_OFFSET);

    if ((this.eventState & StateFlag.Changed) != 0) {
      // eventState != currentState

      // notify listener of change
      if (this.#onChange !== undefined) {
        this.#onChange();
      }

      // ready for next
      this.currentState = this.eventState & ~StateFlag.Changed;

      return true;
    }

    return false;
  }

  get name() {
    return this.#readerName;
  }

  get userData() {
    return this.#userData;
  }

  get buffer(): Uint8Array {
    return this.#buffer;
  }

  get currentState(): StateFlags {
    return new DataView(this.#buffer.buffer).getUint32(
      CURRENT_STATE_OFFSET,
      true,
    );
  }

  protected set currentState(state: StateFlags) {
    new DataView(this.#buffer.buffer).setUint32(
      CURRENT_STATE_OFFSET,
      state,
      true,
    );
  }

  get eventState(): StateFlags {
    return new DataView(this.#buffer.buffer).getUint32(
      ACTUAL_STATE_OFFSET,
      true,
    );
  }

  get atr(): Uint8Array {
    const atrLen = new DataView(this.#buffer.buffer).getUint32(
      ATR_OFFSET,
      true,
    );

    const atr = new Uint8Array(atrLen);
    atr.set(this.#buffer.slice(ATR_OFFSET + DWORD_SIZE, atrLen));

    return atr;
  }

  protected abstract initBuffer(): void;
}
