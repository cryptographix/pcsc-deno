enum EventType {
  Error = 0x1001,

  CardInserted = 0x2001,
  CardRemoval = 0x2002,

  ReaderInserted = 0x3001,
  ReaderRemoval = 0x3002,
}

export class ReaderEvent {
  constructor( public readonly reader: Reader,
    public readonly eventType: EventType) {
  }
}

export interface SEService {
  readonly isConnected: boolean;

  onReaderEvent( handler: (event: ReaderEvent ) => void ): () => void;

  getReaders(): Promise<Reader[]>;

  shutdown(): Promise<void>;
}

export interface Reader {
  readonly service: SEService;

  readonly name: string;

  readonly isPresent: boolean;

  onReaderEvent( handler: (event: ReaderEvent ) => void ): () => void;

  openSession(): Promise<Session>;

  closeAllSessions(): Promise<void>;

  reset(): Promise<void>;
}

export interface Session {
  readonly reader: Reader;
  readonly historicalBytes?: Uint8Array;
  readonly isClosed: boolean;

  openBasicChannel(aid: Uint8Array, p2?: number): Promise<Channel>;
  openLogicalChannel(aid: Uint8Array, p2?: number): Promise<Channel>;
  close(): Promise<void>;
  closeChannels(): Promise<void>;
}

export interface Channel {
  readonly session: Session;
  readonly isBasicChannel: boolean;
  readonly isClosed: boolean;
  readonly selectResponse: Uint8Array;

  selectNext(): Promise<boolean>;

  setTransmitBehaviour(expectDataWithWarningSW: boolean): void;

  transmit(cmd: Uint8Array): Promise<Uint8Array>;

  transmit(cmd: SECommand): Promise<SEResponse>;

  close(): Promise<void>;
}

export interface SECommand {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: Uint8Array;
  le?: number;
  isExtended: boolean;
}

export interface SEResponse {
  readonly channel: Channel;
  readonly sw1: number;
  readonly sw2: number;
  readonly data: Uint8Array;

  isStatus(sw1?: number, sw2?: number): boolean;
}


