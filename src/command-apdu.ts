import { toHex } from "./buffer-utils.ts";

/**
 * Encoder/Decodor Kind for a APDU Command
 */
export class CommandAPDU {
  CLA: number;
  INS: number;
  P1: number;
  P2: number;
  data: Uint8Array;
  Le?: number;
  description: string;

  constructor(CLA = 0x00, INS = 0x00, P1 = 0x00, P2 = 0x00, data?: Uint8Array) {
    this.CLA = CLA;
    this.INS = INS;
    this.P1 = P1;
    this.P2 = P2;
    this.data = data || new Uint8Array();

    this.Le = undefined;
    this.description = "";
  }

  public toString(): string {
    let s = "CommandAPDU ";
    s += "CLA=0x" + toHex([this.CLA]);
    s += "," + "INS=0x" + toHex([this.INS]);
    s += "," + "P1=0x" + toHex([this.P1]);
    s += "," + "P2=0x" + toHex([this.P2]);
    if (this.data && this.data.length) {
      s += "," + "Lc=" + this.Lc;
      s += "," + "Data=" + toHex(this.data);
    }
    if (this.Le) {
      s += "," + "Le=" + this.Le;
    }

    if (this.description) {
      s += " (" + this.description + ")";
    }

    return s;
  }

  public get Lc(): number {
    return this.data.length;
  }
  public get header(): Uint8Array {
    return new Uint8Array([this.CLA, this.INS, this.P1, this.P2]);
  }

  /**
   * Fluent Builder
   */
  public static init(
    CLA = 0x00,
    INS = 0x00,
    P1 = 0x00,
    P2 = 0x00,
    data?: Uint8Array,
  ): CommandAPDU {
    return (new CommandAPDU()).set(CLA, INS, P1, P2, data);
  }

  public set(
    CLA: number,
    INS: number,
    P1: number,
    P2: number,
    data?: Uint8Array,
  ): this {
    this.CLA = CLA;
    this.INS = INS;
    this.P1 = P1;
    this.P2 = P2;
    this.data = data || new Uint8Array();
    this.Le = undefined;

    return this;
  }

  public setCLA(CLA: number): this {
    this.CLA = CLA;
    return this;
  }
  public setINS(INS: number): this {
    this.INS = INS;
    return this;
  }
  public setP1(P1: number): this {
    this.P1 = P1;
    return this;
  }
  public setP2(P2: number): this {
    this.P2 = P2;
    return this;
  }
  public setData(data: Uint8Array): this {
    this.data = data;
    return this;
  }
  public setLe(Le: number): this {
    this.Le = Le;
    return this;
  }
  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Encoder
   */
  public toBytes(_options?: unknown): Uint8Array {
    const hasLe = (this.Le !== undefined && this.Le > 0);

    const dlen = ((this.Lc > 0) ? 1 + this.Lc : 0);
    const len = 4 + dlen + ((hasLe) ? 1 : 0);

    // rebuild binary APDUCommand
    const apduBuffer = new Uint8Array(len);

    apduBuffer.set(this.header);
    if (this.Lc) {
      apduBuffer[4] = this.Lc;
      apduBuffer.set(this.data, 5);
    }

    if (hasLe) {
      apduBuffer[4 + dlen] = this.Le!;
    }

    return apduBuffer;
  }

  /**
   * Decoder
   */
  public from(bytes: Uint8Array | number[], _options: unknown): this {
    if (bytes.length < 4) {
      throw new Error("CommandAPDU: Invalid buffer");
    }

    let offset = 0;

    this.CLA = bytes[offset++];
    this.INS = bytes[offset++];
    this.P1 = bytes[offset++];
    this.P2 = bytes[offset++];

    if (bytes.length > offset + 1) {
      const Lc = bytes[offset++];

      this.data = Uint8Array.from(bytes.slice(offset, Lc));

      offset += Lc;
    }

    if (bytes.length > offset) {
      this.Le = bytes[offset++];
    }

    if (bytes.length != offset) {
      throw new Error("CommandAPDU: Invalid buffer");
    }

    return this;
  }
}
