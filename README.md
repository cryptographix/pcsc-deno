Deno FFI bindings to the PC/SC API

Currently for OS/X, with (windows/linux) coming soon

This mod offers three abstractions over the PC/SC API
1. High-level classes `Context, Card, CommandAPDU/ResponseAPDU`
2. Low-level functions `SCardxx` that roughly map to standard [PC/SC]
3. TODO: OpenMobileAPI [OMAPI]

# High level usage
```typescript
import { SCardContext } from "<pcsc-deno-repo>/mod.ts";

const context = Context.establishContext();

const readerNames = context.listReaderNames();
console.log("Readers:", readerNames.map((r) => r.toString()).join(","));

const card = context.connect(readerNames[0])

// card.disconnect()
```

# links
[PC/SC] (https://pcscworkgroup.com/specifications/)

[OMAPI] (https://globalplatform.org/wp-content/uploads/2016/11/GPD_Open_Mobile_API_Spec_v3.3_PublicRelease.pdf)