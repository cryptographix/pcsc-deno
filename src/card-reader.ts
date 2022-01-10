export type ReaderEventHandler = (event: "reader-inserted"|"reader-removed"|"card-inserted"|"card-removed"|"card-reset", reader: IReader) => void;

export interface IContext {
  onReaderEvent( handler: ReaderEventHandler ): void;

  shutdown(): void;
  
  listReaders(): IReader[];
}

export interface IReader {
  name: string;

  isPresent: Promise<boolean>;
  
  connect(shareMode?: number, preferredProtocols?: number): ICard;
}

export interface ICard {
  transmit( commandAPDU: Uint8Array, expectedLen?: number ): Uint8Array;

  reconnect( shareMode?: number, preferredProtocols?: number, initialization?: number ): void;

  disconnect( disposition: number ): void;
}
