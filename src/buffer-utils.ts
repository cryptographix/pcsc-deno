export function toHex(data: Uint8Array | Iterable<number>, spaces = true) {
  return Array
    .from(data)
    .map<string>((v) => ("00" + v.toString(16)).slice(-2))
    .join(spaces?" ":"");
}

