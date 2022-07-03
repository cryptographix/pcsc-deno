import { BytesLike } from './buffer-utils.ts';

export interface TLV {
  tag: number;
  len: number;
  value: Uint8Array;
}

export class BerTLV implements TLV {
  #tag: number;
  #value: Uint8Array;

  /**
   * Parse and extract TLV information from bytes
   * 
   * @param bytes Raw TLV as bytes or buffer
   * @param parseType What to parse and extract from bytes
   *   `padding` skip any initial padding (to see if buffer contains any data)
   *   `tag`     skip padding and extract a BER-TLV `tag` field
   *   `tag-len` skip padding and extract both `tag` and `len` fields
   *   `tlv`     skip padding and extract `tag`, `len` and `value` fields
   * @return
   *   null:   Malformed TLV
   * 
   *   { }:    Info about the TLV, including
   *             `tag`: Tag of TLV                        (`tag`/`tag-len`/`tlv` options)
   *             `tagOffset`: Offset to `tag` of TLV      (`tag`/`tag-len`/`tlv` options)
   *             `len`: Length of TLV                     (`tag-len`/`tlv` options)
   *             `lenOffset`: Offset to `len` of TLV      (`tag-len`/`tlv` options)
   *             `value`: Value of TLV                    (`tlv` option)
   *             `valueOffset`: Offset to `value` of TLV  (`tlv` options)
   */
  static parse(
    bytes: BytesLike,
    parseType: "padding" | "tag" | "tag-len" | "tlv" = "tlv",
  ) {
    const buffer = BytesLike.toUint8Array(bytes);
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

    if ((off >= buffer.length) || (parseType == "padding")) {
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

    if (parseType == "tag") {
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

    if (parseType == "tag-len") {
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
    this.#value = BytesLike.toUint8Array(value);
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

  get bytes() {

    // T
    let tagLenBytes: number[] = [];
    if (this.#tag >= 0x100) {
      tagLenBytes = [ (this.#tag >> 8) & 0xFF ];
    }
    tagLenBytes = [ ...tagLenBytes, this.#tag & 0xFF ];

    // L
    const len = this.#value.length;
    if (len > 0xFF) {
      tagLenBytes = [ ...tagLenBytes, 0x82, (len >> 8) & 0xFF ];
    } else if (len > 0x7F) {
      tagLenBytes = [ ...tagLenBytes, 0x81 ];
    }
    tagLenBytes = [ ...tagLenBytes, len & 0xFF ];

    // V
    const buffer = new Uint8Array( tagLenBytes.length + len);
    buffer.set( tagLenBytes, 0 );
    buffer.set( this.#value, tagLenBytes.length )

    return buffer;
  }
}

