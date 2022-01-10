Deno FFI bindings to the PC/SC API

Currently for OS/X, with (windows/linux) coming soon

This mod offers three abstractions over the PC/SC API
1. High-level classes `Context, Card, CommandAPDU/ResponseAPDU`
2. Low-level functions `SCardxx` that roughly map to standard [PC/SC]
3. TODO: OpenMobileAPI [OMAPI]

# High level usage
```typescript
import { Context, CommandAPDU, PCSC } from "https://<pcsc-deno-repo>/mod.ts";

const context = Context.establishContext();

const readerNames = context.listReaderNames();
console.log(`Readers:[${readerNames.join(",")}]`);

const readers = context.listReaders();

for( const reader of readers ) {
  if ( await reader.isPresent ) {
    const card = reader.connect();

    const selectMF = CommandAPDU.from([0x00, 0xA4, 0x00, 0x00])
      .setData([0x3f, 0x00]);

    const resp = card.transmitAPDU( selectMF );

    if ( resp.SW == 0x9000 ) {
      // success .. 
      console.log(`Reader ${reader.name}: MF selected`);
      console.log( resp.data )
    } else {
      console.error(`Reader ${reader.name}: error ${resp.SW}`);
    }
    
    card.disconnect(PCSC.SCARD_RESET_CARD);
  }
}

context.shutdown();
```

# links
[PC/SC] https://pcscworkgroup.com/specifications/

[OMAPI] https://globalplatform.org/wp-content/uploads/2016/11/GPD_Open_Mobile_API_Spec_v3.3_PublicRelease.pdf