import { Disposition, Protocol, ShareMode, StateFlag, DWORD } from "./pcsc.ts";
import { CommandAPDU, ResponseAPDU } from "../iso7816/apdu.ts";

export type ReaderStatus =
  | "setup"
  | "empty"
  | "present"
  | "connected"
  | "mute"
  | "reset"
  | "shutdown";

export type ReaderStatusChangeHandler<CARD extends Card, READER extends Reader<CARD>> = (reader: READER, status: ReaderStatus)=>void;

// deno-lint-ignore no-explicit-any
export interface Context<CARD extends Card = any, READER extends Reader<CARD> = Reader<CARD>> {
  getReaders(rescan: boolean): Promise<READER[]>;

  onStatusChange?: ReaderStatusChangeHandler<CARD, READER>;

  waitForChange(
    readers: READER[],
    timeout?: DWORD,
    rescan?: boolean,
  ): Promise<READER[]>;

  shutdown(): Promise<void>;
}

export interface Reader<CARD extends Card = Card> {
  readonly name: string;

  connect(shareMode?: ShareMode, preferredProtocols?: Protocol): Promise<CARD>;

  readonly status: ReaderStatus;
  readonly state: StateFlag;

  onStatusChange?: ReaderStatusChangeHandler<CARD, this>;

  waitForChange(timeout?: DWORD): Promise<ReaderStatus>;
}

export interface Card {
  isConnected: boolean;

  transmit(commandAPDU: Uint8Array, expectedLen?: number): Promise<Uint8Array>;

  transmitAPDU(commandAPDU: CommandAPDU): Promise<ResponseAPDU>;

  reconnect(
    shareMode?: ShareMode,
    preferredProtocols?: Protocol,
    initialization?: Disposition,
  ): Promise<ReaderStatus>;

  disconnect(disposition: Disposition): Promise<ReaderStatus>;
}
