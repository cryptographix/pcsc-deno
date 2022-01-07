import { CSTR, SCARDCONTEXT, lib, SCARD_SCOPE_SYSTEM } from "../mod.ts";

const ctx: SCARDCONTEXT = lib.SCardEstablishContext( SCARD_SCOPE_SYSTEM );
console.log( ctx );

let rdrLen = lib.SCardListReaders( ctx, null, null );
console.log( rdrLen );

const readerNames = CSTR.alloc( rdrLen );

lib.SCardListReaders( ctx, null, readerNames );
console.log( readerNames );

const readerNameOffsets = readerNames.buffer.reduce<number[]>( (acc, cur, curIdx) => (cur==0) ? [...acc, curIdx] : acc, [0]).slice(0,-1);

const readerNameArray = readerNameOffsets.flatMap<CSTR>( (val, index, array) => {
  return ( index < array.length -1 ) 
    ? CSTR.fromNullTerminated( readerNames.buffer.slice( val, array[index+1] ) )
    : []; } );
  
  console.log( readerNameArray );



