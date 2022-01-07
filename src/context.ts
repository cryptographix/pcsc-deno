import * as ffi from "./pcsc-ffi.ts";
import { SCARDCONTEXT, CSTR, DWORD } from "./types.ts";
import { SCARD_SCOPE_SYSTEM } from "./constants.ts";
import { Card } from "./card.ts";

export class Context {
  protected constructor(protected context: SCARDCONTEXT) {

  }

  static establishContext( scope: DWORD = SCARD_SCOPE_SYSTEM ): Context {
    const context: SCARDCONTEXT = ffi.SCardEstablishContext( scope );
    
    return new Context(context);
  }

  drop() {
    // TODO(@sean)
    // ffi.SCardReleaseContext( this.context );
  }

  listReaderNames(): CSTR[] {
    const rdrLen = ffi.SCardListReaders( this.context, null, null );

    const readerNames = CSTR.alloc( rdrLen );
    
    ffi.SCardListReaders( this.context, null, readerNames );

    const readerNameArray = readerNames.buffer
      // find \0 terminators
      .reduce<number[]>( (acc, cur, curIdx) => (cur==0) ? [...acc, curIdx] : acc, [0])
      // remove final "double" terminator
      .slice(0,-1)
      // and map to zero-copy CSTR
      .flatMap<CSTR>( (val, index, array) => ( index < array.length -1 ) 
          ? CSTR.fromNullTerminated( readerNames.buffer.slice( val, array[index+1] ) )
          : [] );
    
    return readerNameArray;
  }

  connect( name: CSTR ): Card {
    const { handle, protocol } = ffi.SCardConnect( this.context, name, 2, 3 );

    return new Card( this, handle, protocol );
  }
}
