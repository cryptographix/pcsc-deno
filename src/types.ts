export type DWORD = number;
export type SCARDCONTEXT = number;
export type SCARDHANDLE = number;

export type SCARDRC = number;

export class SCardException extends Error {
  constructor( public rc: SCARDRC, public func: string, detail?: string ) {
    super( `Error ${rc} calling ${func}${detail!==undefined?" - " + detail : ""}` )
  }
}

export class CSTR {
  readonly buffer: Uint8Array;

  protected constructor( init: number | ArrayBuffer | Uint8Array ) {
    if ( typeof init == "number" ) {
      this.buffer = new Uint8Array(init);
    }
    else if ( init instanceof Uint8Array ) {
      this.buffer = new Uint8Array( init.buffer );
    }
    else {
      this.buffer = new Uint8Array( init );
    }

  }

  static alloc( size: number ): CSTR {
    return new CSTR( size );
  }

  static from( str: string ): CSTR {
    const bytes = new TextEncoder().encode( str );
    const cstr = new CSTR( bytes.length + 1 );

    cstr.buffer.set( bytes );

    return cstr;
  }

  static fromNullTerminated( buffer: Uint8Array ): CSTR {
    return new CSTR( buffer );
  }

  get length() {
    return this.buffer.length;
  }

  toString(): string {
    return new TextDecoder().decode( this.buffer.slice(0,-1) );
  }
}