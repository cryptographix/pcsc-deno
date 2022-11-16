import { DWORD, StateFlag } from './pcsc.ts';
import { PLATFORM } from './platform.ts';


/**
 * SCARDREADER_STATE, 64bits
 *   Win           MacOs         Linux
 *               [ 00 .. 07 ]                 Pointer READER_NAME
 *               [ 08 .. 0F ]                 Pointer UserData 
 * [ 10 .. 13 ]  [ 10 .. 13 ]  [ 10 .. 17 ]   DWORD Current State
 * [ 14 .. 17 ]  [ 14 .. 17 ]  [ 18 .. 1F ]   DWORD Actual State
 * [ 18 .. 1B ]  [ 18 .. 1B ]  [ 20 .. 27 ]   DWORD ATR Size
 * [ 1C .. 3C ]  [ 1C .. 3F ]  [ 28 .. 4F ]   BYTE[] ATR
 * 
 */
export const CURRENT_STATE_OFFSET = PLATFORM.POINTER_SIZE + PLATFORM.POINTER_SIZE;
export const EVENT_STATE_OFFSET = CURRENT_STATE_OFFSET + PLATFORM.DWORD_SIZE;
export const ATR_OFFSET = EVENT_STATE_OFFSET + PLATFORM.DWORD_SIZE;
export const SCARD_ATR_SIZE = PLATFORM.isWin ? 33 : 36;
export const SCARDREADERSTATE_SIZE = ATR_OFFSET + PLATFORM.DWORD_SIZE + SCARD_ATR_SIZE;

// deno-lint-ignore no-explicit-any
export abstract class SCARDREADERSTATE<TNAME = any, TUSERDATA = any> {
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

  get currentState(): DWORD {
    return new DataView(this.#buffer.buffer).getUint32(
      CURRENT_STATE_OFFSET,
      true,
    );
  }

  protected set currentState(state: DWORD) {
    new DataView(this.#buffer.buffer).setUint32(
      CURRENT_STATE_OFFSET,
      state,
      true,
    );
  }

  get eventState(): DWORD {
    return new DataView(this.#buffer.buffer).getUint32(
      EVENT_STATE_OFFSET,
      true,
    );
  }

  get atr(): Uint8Array {
    const atrLen = new DataView(this.#buffer.buffer).getUint32(
      ATR_OFFSET,
      true,
    );

    const atr = new Uint8Array(atrLen);
    atr.set(this.#buffer.slice(ATR_OFFSET + PLATFORM.DWORD_SIZE, atrLen));

    return atr;
  }

  protected abstract initBuffer(): void;

  static buildStateBuffer(states: SCARDREADERSTATE[], alignedStateSize = SCARDREADERSTATE_SIZE) {
    const stateBuffer = new Uint8Array(
      alignedStateSize * states.length,
    );

    states.forEach((state, index) => {
      stateBuffer.set(
        state.buffer,
        index * alignedStateSize,
      );

      new DataView(stateBuffer.buffer, index * alignedStateSize).setUint32(
        EVENT_STATE_OFFSET,
        0,
        true,
      );
    } );

    return stateBuffer;
  }

  static unpackStateChangeBuffer<STATE extends SCARDREADERSTATE>(
    states: STATE[],
    stateBuffer: Uint8Array,
    alignedStateSize = SCARDREADERSTATE_SIZE): number[] {

    const changed: number[] = [];

    states.forEach((state, index) => {
      // update state ...
      if (state.handleChange(
        stateBuffer.slice(
          index * alignedStateSize,
          SCARDREADERSTATE_SIZE,
        ),
      )) {
        changed.push(index);
      }
    });

    return changed;
  }
}
