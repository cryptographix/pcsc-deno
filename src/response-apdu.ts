import { SmartCardException } from './card-reader.ts';
import { toHex } from "./buffer-utils.ts";

type BytesLike = Uint8Array | ArrayLike<number> | ArrayBufferLike;

/**
 * Encoder/Decodor for a APDU Response
 */
export class ResponseAPDU {
  SW = 0;
  data: Uint8Array;
  description = "";

  /**
   * @constructor
   *
   * Deserialize from a JSON object
   */
  constructor(SW = 0x0000, data: BytesLike = []) {
    this.SW = SW;
    this.data = (data instanceof Uint8Array) ? data : new Uint8Array(data);
    this.description = "";
  }

  public toString(): string {
    let s = "ResponseAPDU ";
    s += "SW=0x" + toHex([this.SW >> 8, this.SW & 0xff], false);
    if (this.data && this.data.length) {
      s += "," + "La=" + this.La;
      s += "," + "Data=" + toHex(this.data);
    }
    if (this.description) {
      s += " (" + this.description + ")";
    }

    return s;
  }

  public get La() {
    return this.data.length;
  }

  public static init(SW = 0x0000, data: BytesLike = []): ResponseAPDU {
    return (new ResponseAPDU()).set(SW, data);
  }

  public set(sw: number, data: BytesLike): this {
    this.SW = sw;
    this.data = (data instanceof Uint8Array) ? data : new Uint8Array(data);

    return this;
  }

  public setSW(SW: number): this {
    this.SW = SW;
    return this;
  }
  public setSW1(SW1: number): this {
    this.SW = (this.SW & 0xFF) | (SW1 << 8);
    return this;
  }
  public setSW2(SW2: number): this {
    this.SW = (this.SW & 0xFF00) | SW2;
    return this;
  }
  public setData(data: BytesLike): this {
    this.data = (data instanceof Uint8Array) ? data : new Uint8Array(data);
    return this;
  }
  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Encoder function, returns a blob from an APDUResponse object
   */
  public toBytes(_options?: unknown): Uint8Array {
    const bytes = new Uint8Array(this.La + 2);

    bytes.set(this.data, 0);
    bytes[this.La] = (this.SW >> 8) & 0xff;
    bytes[this.La + 1] = (this.SW >> 0) & 0xff;

    return bytes;
  }

  public static from(bytes: BytesLike, _options?: unknown): ResponseAPDU {
    const buffer = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);

    if (buffer.length < 2) {
      throw new SmartCardException("ResponseAPDU Buffer invalid");
    }

    const la = buffer.length - 2;

    const SW = new DataView(buffer.buffer).getUint16(la);
    const data = buffer.slice(0, la);

    return new ResponseAPDU(SW,data);
  }
}
