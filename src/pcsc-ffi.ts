import { SCARDCONTEXT, SCARDHANDLE, SCardException, DWORD, CSTR } from "./types.ts";

const DWORD_SIZE = 4;

const HANDLE_SIZE = 4;

export const pcsc = Deno.dlopen("/System/Library/Frameworks/PCSC.framework/PCSC", {
  "SCardEstablishContext": {
    parameters: ["u32","usize","usize","pointer"],
    result: "u32"
  },
  "SCardListReaders": {
    parameters: ["usize","pointer","pointer","pointer"],
    result: "u32"
  },
  "SCardConnect": {
    parameters: ["usize","pointer","u32","u32","pointer","pointer"],
    result: "u32"
  },
});

function ensureSCardSuccess( rc: unknown, func: string ) {
  if ( typeof rc == "number" ) {
    if ( rc != 0 ) {
      throw new SCardException( rc, func );
    }
  }
}

export function SCardEstablishContext( dwScope: DWORD ): SCARDCONTEXT {
  const ctx = new Uint8Array(HANDLE_SIZE);

  ensureSCardSuccess( pcsc.symbols.SCardEstablishContext( dwScope, 0, 0, ctx ), "SCardEstablishContext" )
  
  return new DataView(ctx.buffer).getUint32(0,true);
}

export function SCardListReaders( hContext: SCARDCONTEXT, mszGroups: CSTR | null, mszReaders: CSTR | null ): number {
  const pcchReaders = new Uint8Array(HANDLE_SIZE);

  if ( mszReaders !== null ) {
    new DataView(pcchReaders.buffer).setUint32(0, mszReaders.length )
  }

  const readerNames = mszReaders?.buffer ?? null;

  ensureSCardSuccess( pcsc.symbols.SCardListReaders( hContext, mszGroups, readerNames, pcchReaders ), "SCardListReaders" )
  
  return new DataView(pcchReaders.buffer).getUint32(0,true);
}

export function SCardConnect( hContext: SCARDCONTEXT, readerName: CSTR, dwShareMode: DWORD, dwPreferredProtocols: DWORD ): { handle: SCARDHANDLE, protocol: DWORD } {
  const protocol = new Uint8Array(4);
  const handle = new Uint8Array(4);

  ensureSCardSuccess( pcsc.symbols.SCardConnect( hContext, readerName.buffer, dwShareMode, dwPreferredProtocols, handle, protocol ), "SCardConnect" );

  return {
    handle: new DataView(handle.buffer).getUint32(0,true),
    protocol: new DataView(protocol.buffer).getUint32(0,true)
  }
}
