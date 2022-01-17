export function toHex(data: Uint8Array | Iterable<number>, spaces = true) {
  return Array
    .from(data)
    .map<string>((v) => ("00" + v.toString(16)).slice(-2))
    .join(spaces ? " " : "");
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
