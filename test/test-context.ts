import { Context, SCARD_SCOPE_SYSTEM } from "../mod.ts";

const context = Context.establishContext( SCARD_SCOPE_SYSTEM );
console.log( context );

const readerNames = context.listReaderNames();
console.log( "Readers:", readerNames.map( (r) => r.toString()).join( ",") );

const card = context.connect(readerNames[0]);
console.log( card );