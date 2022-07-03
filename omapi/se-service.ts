import * as OMAPI from '../omapi/omapi.ts';

import { CommandAPDU, ResponseAPDU } from '../iso7816/apdu.ts';
import { Card, Context, Reader as PCSCReader } from '../pcsc/context.ts';

export class SEService implements OMAPI.SEService {
  #contexts: Context[] = [];
  #readers: Reader[] = [];

  isConnected = true;

  constructor(contexts?: Context[]) {
    if (contexts === undefined) {
      contexts = [];

      if (typeof Deno !== "undefined") {
        //
      }
    }

    this.#contexts = contexts;

    this.#setup();
  }

  onReaderEvent(_handler: (event: OMAPI.ReaderEvent) => void): () => void {
    return () => {
    };
  }

  getReaders(): Promise<OMAPI.Reader[]> {
    throw new Error("Method not implemented.");
  }

  shutdown(): Promise<void> {
    this.#teardown;

    return Promise.resolve();
  }

  #setup() {
  }

  #handleReaderInserted() {
    this.#readers.push(new Reader(this, null as any as PCSCReader));
  }

  #handleReaderRemoved() {
  }
  #teardown() {
  }
}

class Reader implements OMAPI.Reader {
  #reader: PCSCReader;
  #sessions: OMAPI.Session[];

  constructor(public readonly service: OMAPI.SEService, reader: PCSCReader) {
    this.#reader = reader;
    this.#sessions = [];
  }

  get name(): string {
    return this.#reader.name;
  }

  get isPresent(): boolean {
    return false;
  }

  onReaderEvent(_handler: (event: OMAPI.ReaderEvent) => void): () => void {
    throw new Error("Method not implemented.");
  }

  openSession(): Promise<OMAPI.Session> {
    return Promise.resolve(new Session(this));
  }

  closeAllSessions(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  reset(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

class Session implements OMAPI.Session {
  #channels: Channel[] = [];
  readonly reader: OMAPI.Reader;

  constructor(reader: Reader) {
    this.reader = reader;
  }

  closeChannels(): Promise<void> {
    return Promise.all(this.#channels.map((channel) => channel.close()))
      .then(() => {
        this.#channels = [];
      });
  }

  get isClosed(): boolean {
    return false;
  }

  historicalBytes?: Uint8Array;

  openBasicChannel(_aid: Uint8Array, _p2?: number): Promise<OMAPI.Channel> {
    const select = Promise.resolve(new Uint8Array());

    return select.then((selectResult) => {
      const channel = new Channel(
        this,
        null as any as Card,
        true,
        selectResult,
      );

      this.#channels.push(channel);

      return channel;
    });
  }

  openLogicalChannel(
    _aid: Uint8Array,
    _p2?: number,
  ): Promise<OMAPI.Channel> {
    throw new Error("Method not implemented.");
  }

  close(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

class Channel implements OMAPI.Channel {
  constructor(
    public readonly session: OMAPI.Session,
    protected readonly card: Card,
    public readonly isBasicChannel: boolean,
    public readonly selectResponse: Uint8Array,
  ) {
  }

  get isClosed(): boolean {
    return this.card != null;
  }

  setTransmitBehaviour(_expectDataWithWarningSW: boolean): void {
    throw new Error("Method not implemented.");
  }

  selectNext(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  transmit(cmd: SECommand): Promise<SEResponse>;
  transmit(cmd: Uint8Array): Promise<Uint8Array>;
  transmit(
    cmd: SECommand | Uint8Array,
  ): Promise<Uint8Array> | Promise<SEResponse> {
    if (cmd instanceof Uint8Array) {
      return this.card.transmit(cmd);
    } else {
      const resp = this.card.transmitAPDU(cmd);
      const resp2 = resp
        .then((response) => {
          return new SEResponse(this, response.toBytes());
        });

      return resp2;
    }
  }

  close(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export class SECommand extends CommandAPDU implements OMAPI.SECommand {
  constructor(
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data?: Uint8Array,
    le?: number,
    isExtended?: boolean,
  ) {
    super(cla, ins, p1, p2, data, le, isExtended);
  }
}

export class SEResponse extends ResponseAPDU implements OMAPI.SEResponse {
  get sw1(): number {
    return this.SW >> 8;
  }
  get sw2(): number {
    return this.SW & 0xff;
  }

  constructor(public readonly channel: Channel, raw: Uint8Array) {
    super(raw);
  }

  isStatus(sw1?: number, sw2?: number): boolean {
    return (sw1 == undefined) || sw1 == this.sw1 &&
        (sw2 == undefined) ||
      sw2 == this.sw2;
  }
}
