import { Context } from "../mod.ts";

const context = Context.establishContext();
console.log(context);

const readers = context.listReaders();
console.log( `Readers:[ ${ Array.from(readers.keys()).map((name) => name.toString()).join(",") } ]` );

if ( readers.size > 0 ) {
  const card = Array.from(readers.values())[0].connect();
  console.log(card);
  
  const selectFile = [ 0x00, 0xA4, 0x04, 0x00, 0x07, 0xA0, 0x00, 0x00, 0x01, 0x54, 0x44, 0x42, 0x00 ];
  
  const rapdu = card.transmit(Uint8Array.from(selectFile), 256);
  
  console.log( Array.from(rapdu).map( e => ("00"+e.toString(16).toUpperCase()).slice(-2) ).join(" ") );
}
