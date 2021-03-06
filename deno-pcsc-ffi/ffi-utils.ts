export class CSTR {
  readonly buffer: Uint8Array;

  protected constructor(init: number | Iterable<number> | Uint8Array) {
    if (typeof init == "number") {
      this.buffer = new Uint8Array(init);
    } else if (init instanceof Uint8Array) {
      this.buffer = init;
    } else {
      this.buffer = new Uint8Array(init);
    }
  }

  static alloc(size: number): CSTR {
    return new CSTR(size);
  }

  static from(str: string): CSTR {
    const bytes = new TextEncoder().encode(str);
    const cstr = new CSTR(bytes.length + 1);

    cstr.buffer.set(bytes);

    return cstr;
  }

  static fromNullTerminated(buffer: Uint8Array): CSTR {
    return new CSTR(buffer);
  }

  get length() {
    return this.buffer.length;
  }

  toString(): string {
    return new TextDecoder().decode(this.buffer.slice(0, -1));
  }
}
