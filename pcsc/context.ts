import { Disposition, Protocol, ShareMode, DWORD } from './pcsc.ts';
import { CommandAPDU, ResponseAPDU } from '../iso7816/apdu.ts';
import { BytesLike } from "../iso7816/iso7816.ts";

export type ReaderStatus =
  | "setup"
  | "empty"
  | "present"
  | "connected"
  | "mute"
  | "reset"
  | "shutdown";

export type ReaderStatusChangeHandler = (reader: Reader, status: ReaderStatus) => void;

export interface Context { //<Card extends Card = Card, Reader extends Reader<Card> = Reader<Card>> {
  listReaders(rescan?: boolean): Reader[];

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

  readonly isPresent: boolean;

  readonly isConnected: boolean;

  readonly isMute: boolean;

  readonly status: ReaderStatus;

  readonly state: DWORD;

  connect(shareMode?: ShareMode, preferredProtocols?: Protocol): Promise<Card>;

  onStatusChange?: ReaderStatusChangeHandler;

  waitForChange(timeout?: DWORD): Promise<ReaderStatus | "no-change">;
}

export interface Card {
  readonly isConnected: boolean;

  readonly protocol: number;

  transmit(commandAPDU: BytesLike, expectedLen?: number): Promise<Uint8Array>;

  transmitAPDU(commandAPDU: CommandAPDU): Promise<ResponseAPDU>;

  reconnect(
    shareMode?: ShareMode,
    preferredProtocols?: Protocol,
    initialization?: Disposition,
  ): Promise<ReaderStatus>;

  disconnect(disposition: Disposition): Promise<ReaderStatus>;
}

