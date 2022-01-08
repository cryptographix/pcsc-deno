export interface CardContext {
  shutdown(): void;
  listReaders(): Map<string, Reader>;
}

export interface Reader {
  name: string;
  isPresent: boolean;
  connect(shareMode?: number, supportedProtocols?: number): Card;
}

export interface Card {
  transmit( commandAPDU: Uint8Array, expectedLen?: number ): Uint8Array;
}
