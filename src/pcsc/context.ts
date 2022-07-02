import { Disposition, Protocol, ShareMode, StateFlag, DWORD } from './pcsc.ts';
import { CommandAPDU, ResponseAPDU } from '../iso7816/apdu.ts';

export type ReaderStatus =
  | "setup"
  | "empty"
  | "present"
  | "connected"
  | "mute"
  | "reset"
  | "shutdown";

export type ReaderStatusChangeHandler = (reader: Reader, status: ReaderStatus)=>void;

export interface Context { //<Card extends Card = Card, Reader extends Reader<Card> = Reader<Card>> {
  listReaders(rescan: boolean): Promise<Reader[]>;

  onStatusChange?: ReaderStatusChangeHandler;

  waitForChange(
    readers: Reader[],
    timeout?: DWORD,
    rescan?: boolean,
  ): Promise<Reader[]>;

  shutdown(): Promise<void>;
}

export interface Reader {
  readonly name: string;

  connect(shareMode?: ShareMode, preferredProtocols?: Protocol): Promise<Card>;

  readonly status: ReaderStatus;
  readonly state: StateFlag;

  onStatusChange?: ReaderStatusChangeHandler;

  waitForChange(timeout?: DWORD): Promise<ReaderStatus>;

  readonly isPresent: boolean;
  readonly isConnected: boolean;
  readonly isMute: boolean;
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
