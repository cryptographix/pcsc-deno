import { BytesLike, toUint8Array } from './../buffer-utils.ts';

type ByteArray = Uint8Array;

export interface TLV {
  tag: number;
  len: number;
  value: Uint8Array;
}

export type TLVParseType = "pad" | "t" | "tl" | "tlv";

export class BerTLV implements TLV {
  #tag: number;
  #value: Uint8Array;

  /**
   * Parse and extract TLV information from a ByteArray
   * @return
   *   null:   Malformed TLV
   *   { }:    Info about the TLV, including
   *              tag: TAG if found, 0 otherwise (only padding)
   */
  static parse(
    bytes: BytesLike,
    parseType: TLVParseType = "tlv",
  ) {
    const buffer = toUint8Array(bytes);
    let off = 0;

    const res: Partial<TLV> & {
      tagOffset?: number;
      lenOffset?: number;
      valueOffset?: number;
    } = {};

    // skip padding
    while ((off < buffer.length) && (buffer[off] == 0x00)) {
      ++off;
    }

    res.tagOffset = off;

    if ((off >= buffer.length) || (parseType == "pad")) {
      return res;
    }

    let tag = 0;
    res.tagOffset = off;
    if ((buffer[off] & 0x1F) == 0x1F) {
      tag = buffer[off++] << 8;
      if (off >= buffer.length) {
        return null;
      }
    }
    res.tag = tag | buffer[off++];

    res.lenOffset = off;

    if (parseType == "t") {
      return res;
    }

    // extract "L"
    if (off >= buffer.length) {
      return null;
    }

    let ll = (buffer[off] & 0x80) ? (buffer[off++] & 0x7F) : 1;
    let len = 0;
    while (ll-- > 0) {
      if (off >= buffer.length) {
        return null;
      }

      len = (len << 8) | buffer[off++];
    }

    res.len = len;
    res.valueOffset = off;

    if (parseType == "tl") {
      return res;
    }

    // extract "V"
    if (off + res.len > buffer.length) {
      return null;
    }

    res.value = buffer.slice(off, off + len);

    return res;
  }

  constructor(tag: number, value: BytesLike) {
    this.#tag = tag;
    this.#value = toUint8Array(value);
  }

  get tag(): number {
    return this.#tag;
  }

  get value(): Uint8Array {
    return this.#value;
  }

  get len(): number {
    return this.#value.length;
  }

  get buffer() {

    let tagLenBytes: number[] = [];
    if (this.#tag >= 0x100) {
      tagLenBytes = [ (this.#tag >> 8) & 0xFF ];
    }
    tagLenBytes = [ ...tagLenBytes, this.#tag & 0xFF ];

    const len = this.#value.length;
    if (len > 0xFF) {
      tagLenBytes = [ ...tagLenBytes, 0x82, (len >> 8) & 0xFF ];
    } else if (len > 0x7F) {
      tagLenBytes = [ ...tagLenBytes, 0x81 ];
    }
    tagLenBytes = [ ...tagLenBytes, len & 0xFF ];

    const buffer = new Uint8Array( tagLenBytes.length + len);
    buffer.set( tagLenBytes, 0 );
    buffer.set( this.#value, tagLenBytes.length )

    return buffer;
  }
}

