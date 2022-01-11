import { CommandAPDU } from './command-apdu.ts';
import { ResponseAPDU } from './response-apdu.ts';

export type ReaderEventType = "reader-inserted"|"reader-removed"|"card-inserted"|"card-removed"|"card-reset";

export type ReaderEventHandler = (event: ReaderEventType, reader: IReader) => void;

export class SmartCardException extends Error {
}

export interface IContext {
  onReaderEvent( handler: ReaderEventHandler ): void;

  shutdown(): void;
  
  listReaders(): IReader[];

  waitForChange(readers: IReader[], timeout: number): Promise<IReader[]>;
}

export interface IReader {
  name: string;

  isActive: boolean;

  isPresent: Promise<boolean>;
  
  connect(shareMode?: number, preferredProtocols?: number): Promise<ICard>;
}

export interface ICard {
  transmit( commandAPDU: Uint8Array, expectedLen?: number ): Promise<Uint8Array>;

  transmitAPDU(commandAPDU: CommandAPDU): Promise<ResponseAPDU>;

  reconnect( shareMode?: number, preferredProtocols?: number, initialization?: number ): Promise<void>;

  disconnect( disposition: number ): Promise<void>;
}
