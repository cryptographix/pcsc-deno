import { toHex } from "./buffer-utils.ts";

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
  constructor() {
    this.SW = 0;
    this.data = new Uint8Array();
    this.description = "";
  }

  public toString(): string {
    let s = "ResponseAPDU ";
    s += "SW=0x" + toHex([this.SW>>8, this.SW & 0xff], false);
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

  public static init(sw: number, data?: Uint8Array): ResponseAPDU {
    return (new ResponseAPDU()).set(sw, data);
  }

  public set(sw: number, data?: Uint8Array): this {
    this.SW = sw;
    this.data = data || new Uint8Array();

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
  public setData(data: Uint8Array): this {
    this.data = data;
    return this;
  }
  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Encoder function, returns a blob from an APDUResponse object
   */
  public encodeBytes(_options?: unknown): Uint8Array {
    const bytes = new Uint8Array(this.La + 2);

    bytes.set(this.data, 0);
    bytes[this.La] = (this.SW >> 8) & 0xff;
    bytes[this.La + 1] = (this.SW >> 0) & 0xff;

    return bytes;
  }

  public decodeBytes(bytes: Uint8Array, _options?: unknown): this {
    if (bytes.length < 2) {
      throw new Error("ResponseAPDU Buffer invalid");
    }

    const la = bytes.length - 2;

    this.SW = new DataView(bytes.buffer).getUint16(la);
    this.data = (la) ? bytes.slice(0, la) : new Uint8Array();

    return this;
  }
}
