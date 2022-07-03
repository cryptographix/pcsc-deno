export const HEX = {
  toString(data: Uint8Array | Iterable<number>, spaces = true) {
    return Array
      .from(data)
      .map((e) => ("00" + e.toString(16)).slice(-2))
      .join(spaces ? " " : "")
      .toUpperCase();
  },

  parse(hex: string): Uint8Array {
    const bytes = [];
    let idx = 0;

    // skip initial whitespace
    while(/\s/.test(hex[idx])) idx++;

    while(idx < hex.length) {
      const byteStr = hex.slice(idx, idx + 2);
      if (/[0-9A-Fa-f]{2}/.test(byteStr)) {
        bytes.push(parseInt(byteStr, 16));
        idx+=2;
      }
      else {
        throw new Error(`Invalid HEX string @${idx}`);
      }

      // skip whitespace
      while(/\s/.test(hex[idx])) idx++;
    }

    return new Uint8Array(bytes);
  },

}

export type BytesLike =
  | Uint8Array
  | ArrayLike<number>
  | ArrayBufferLike
  | Iterable<number>;

// deno-lint-ignore no-explicit-any
function isIterable<T>(obj: any): obj is Iterable<T> {
  return (obj != null) && typeof obj[Symbol.iterator] === "function";
}

export function toUint8Array(data: BytesLike = []): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  } else if (isIterable(data)) {
    return Uint8Array.from(data);
  } else {
    return new Uint8Array(data);
  }
}
