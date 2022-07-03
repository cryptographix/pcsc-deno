import { CSTR } from './ffi-utils.ts';
import {
  CardStatus,
  Disposition,
  DWORD,
  PCSCException,
  Protocol,
  SCARDCONTEXT,
  SCARDHANDLE,
  SCARDREADERSTATE,
  SCARD_ERROR_TIMEOUT,
  ShareMode,
} from '../pcsc/pcsc.ts';

import { isWin, DWORD_SIZE, POINTER_SIZE } from '../pcsc/reader-state.ts';
import { FFI_SCARDREADERSTATE } from './reader.ts';

const libPath = {
  "windows": "winscard.dll",
  "linux": "libpcsclite.so",
  "darwin": "/System/Library/Frameworks/PCSC.framework/PCSC",
};

// PC/SC HANDLE
// Darwin (M1, ?) and linux, via pcsclite, use DWORD
// Windows x64 (winscard.dll) uses a long long 
const FFI_PCSC_HANDLE = isWin ? "pointer" : "usize";
const FFI_PCSC_HANDLE_SIZE = isWin ? POINTER_SIZE : DWORD_SIZE;

const libPCSC = Deno.dlopen(
  libPath[Deno.build.os],
  {
    SCardEstablishContext: {
      parameters: ["u32", "usize", "usize", "pointer"],
      result: "u32",
    },
    SCardListReaders: {
      parameters: [FFI_PCSC_HANDLE, "pointer", "pointer", "pointer"],
      result: "u32",
      name: `SCardListReaders${isWin ? "A" : ""}`,
    },
    SCardIsValidContext: {
      parameters: [FFI_PCSC_HANDLE],
      result: "u32",
    },
    "SCardCancel": {
      parameters: [FFI_PCSC_HANDLE],
      result: "u32",
    },
    "SCardReleaseContext": {
      parameters: [FFI_PCSC_HANDLE],
      result: "u32",
    },
    SCardGetStatusChange: {
      parameters: [FFI_PCSC_HANDLE, "u32", "pointer", "u32"],
      nonblocking: true,
      result: "u32",
      name: `SCardGetStatusChange${isWin ? "A" : ""}`,
    },
    SCardGetStatusChangeSync: {
      parameters: [FFI_PCSC_HANDLE, "u32", "pointer", "u32"],
      result: "u32",
      name: `SCardGetStatusChange${isWin ? "A" : ""}`,
    },
    SCardConnect: {
      parameters: [FFI_PCSC_HANDLE, "pointer", "u32", "u32", "pointer", "pointer"],
      result: "u32",
      name: `SCardConnect${isWin ? "A" : ""}`,
    },
    "SCardReconnect": {
      parameters: [FFI_PCSC_HANDLE, "u32", "u32", "u32", "pointer"],
      result: "u32",
    },
    "SCardDisconnect": {
      parameters: [FFI_PCSC_HANDLE, "u32"],
      result: "u32",
    },
    "SCardBeginTransaction": {
      parameters: [FFI_PCSC_HANDLE, "u32"],
      result: "u32",
    },
    "SCardEndTransaction": {
      parameters: [FFI_PCSC_HANDLE, "u32"],
      result: "u32",
    },
    "SCardTransmit": {
      parameters: [
        FFI_PCSC_HANDLE,
        "pointer",
        "pointer",
        "u32",
        "pointer",
        "pointer",
        "pointer",
      ],
      nonblocking: true,
      result: "u32",
    },
    "SCardTransmitSync": {
      parameters: [
        FFI_PCSC_HANDLE,
        "pointer",
        "pointer",
        "u32",
        "pointer",
        "pointer",
        "pointer",
      ],
      result: "u32",
      name: `SCardTransmit`,
    },
    SCardStatus: {
      parameters: [
        FFI_PCSC_HANDLE,
        "pointer",
        "pointer",
        "pointer",
        "pointer",
        "pointer",
        "pointer",
      ],
      result: "u32",
      name: `SCardStatus${isWin ? "A" : ""}`,
    },
    SCardControl: {
      parameters: [
        FFI_PCSC_HANDLE,
        "u32",
        "pointer",
        "u32",
        "pointer",
        "u32",
        "pointer",
      ],
      result: "u32",
    },
    SCardGetAttrib: {
      parameters: [FFI_PCSC_HANDLE, "u32", "pointer", "pointer"],
      result: "u32",
    },
    SCardSetAttrib: {
      parameters: [FFI_PCSC_HANDLE, "u32", "pointer", "u32"],
      result: "u32",
    },
  }
);

function ensureSCardSuccess(rc: number, func: string) {
  if (typeof rc == "number") {
    if (rc != 0) {
      throw new PCSCException(rc, func);
    }
  }
}

export function SCardEstablishContext(scope: DWORD): SCARDCONTEXT {
  const ctx = new Uint8Array(FFI_PCSC_HANDLE_SIZE);
  const view = new DataView(ctx.buffer);

  ensureSCardSuccess(
    libPCSC.symbols.SCardEstablishContext(scope, 0, 0, ctx),
    "SCardEstablishContext",
  );

  return isWin ? view.getBigUint64(0, true) : view.getUint32(0, true);
}

export function SCardIsValidContext(hContext: SCARDCONTEXT): boolean {
  const ret = libPCSC.symbols.SCardIsValidContext(hContext);

  return ( ret == 0 );
}

export function SCardCancel(hContext: SCARDCONTEXT) {
  ensureSCardSuccess(
    libPCSC.symbols.SCardCancel(hContext),
    "SCardCancel",
  );
}

export function SCardReleaseContext(hContext: SCARDCONTEXT) {
  ensureSCardSuccess(
    libPCSC.symbols.SCardReleaseContext(hContext),
    "SCardReleaseContext",
  );
}

export function SCardListReaders(
  hContext: SCARDCONTEXT,
  mszGroups: CSTR | null,
  mszReaders: CSTR | null,
): DWORD {
  const readersLen = new Uint8Array(DWORD_SIZE);

  if (mszReaders !== null) {
    new DataView(readersLen.buffer).setUint32(0, mszReaders.length, true);
  }

  const readerNames = mszReaders?.buffer ?? null;

  ensureSCardSuccess(
    libPCSC.symbols.SCardListReaders(
      hContext,
      mszGroups?.buffer ?? null,
      readerNames,
      readersLen,
    ),
    "SCardListReaders",
  );

  return new DataView(readersLen.buffer).getUint32(0, true);
}

export function SCardConnect(
  hContext: SCARDCONTEXT,
  readerName: CSTR,
  shareMode: ShareMode,
  preferredProtocols: Protocol,
): { handle: SCARDHANDLE; protocol: Protocol } {
  const protocol = new Uint8Array(DWORD_SIZE);
  const handle = new Uint8Array(FFI_PCSC_HANDLE_SIZE);
  const view = new DataView(handle.buffer);

  ensureSCardSuccess(
    //    pcsc.symbols.SCardConnectA(
    libPCSC.symbols.SCardConnect(
      hContext,
      readerName.buffer,
      shareMode,
      preferredProtocols,
      handle,
      protocol,
    ),
    "SCardConnect",
  );

  return {
    handle: isWin ? view.getBigUint64(0, true) : view.getUint32(0, true),
    protocol: new DataView(protocol.buffer).getUint32(0, true),
  };
}

export function SCardReconnect(
  hCard: SCARDHANDLE,
  shareMode: ShareMode,
  preferredProtocols: DWORD,
  initialization: Disposition,
): { protocol: Protocol } {
  const protocol = new Uint8Array(DWORD_SIZE);

  ensureSCardSuccess(
    libPCSC.symbols.SCardReconnect(
      hCard,
      shareMode,
      preferredProtocols,
      initialization,
      protocol,
    ),
    "SCardReconnect",
  );

  return {
    protocol: new DataView(protocol.buffer).getUint32(0, true),
  };
}

export function SCardDisconnect(
  hCard: SCARDHANDLE,
  disposition: Disposition,
): void {
  ensureSCardSuccess(
    libPCSC.symbols.SCardDisconnect(
      hCard,
      disposition,
    ),
    "SCardDisconnect",
  );
}

function prepareTransmit(recvLength: DWORD) {
  const pioSendPci = new Uint8Array(8);
  new DataView(pioSendPci.buffer).setUint32(0, 1, true);
  new DataView(pioSendPci.buffer).setUint32(4, 8, true);

  const pioRecvPci = new Uint8Array(8);
  pioRecvPci.set(pioSendPci);

  const recvBuffer = new Uint8Array(recvLength + 2);

  const recvLengthBuffer = new Uint8Array(DWORD_SIZE);

  new DataView(recvLengthBuffer.buffer).setUint32(0, recvBuffer.length, isWin);

  return {
    pioSendPci,
    pioRecvPci,
    recvBuffer,
    recvLength,
    recvLengthBuffer
  }
}
export async function SCardTransmit(
  hCard: SCARDHANDLE,
  sendBuffer: Uint8Array,
  recvLength: DWORD,
): Promise<Uint8Array> {
  const { pioSendPci, pioRecvPci, recvBuffer, recvLengthBuffer } = prepareTransmit(recvLength);

  ensureSCardSuccess(
    await libPCSC.symbols.SCardTransmit(
      hCard,
      pioSendPci,
      sendBuffer,
      sendBuffer.length,
      pioRecvPci,
      recvBuffer,
      recvLengthBuffer,
    ),
    "SCardTransmit",
  );

  recvLength = new DataView(recvLengthBuffer.buffer).getUint32(0, true);

  return recvBuffer.slice(0, recvLength);
}

export function SCardTransmitSync(
  hCard: SCARDHANDLE,
  sendBuffer: Uint8Array,
  recvLength: DWORD,
): Uint8Array {
  const { pioSendPci, pioRecvPci, recvBuffer, recvLengthBuffer } = prepareTransmit(recvLength);

  ensureSCardSuccess(
    libPCSC.symbols.SCardTransmitSync(
      hCard,
      pioSendPci,
      sendBuffer,
      sendBuffer.length,
      pioRecvPci,
      recvBuffer,
      recvLengthBuffer,
    ),
    "SCardTransmit",
  );

  recvLength = new DataView(recvLengthBuffer.buffer).getUint32(0, true);

  return recvBuffer.slice(0, recvLength);
}

export function SCardBeginTransaction(hCard: SCARDHANDLE) {
  ensureSCardSuccess(
    libPCSC.symbols.SCardBeginTransaction(hCard),
    "SCardBeginTransaction",
  );
}

export function SCardEndTransaction(
  hCard: SCARDHANDLE,
  disposition: Disposition,
) {
  ensureSCardSuccess(
    libPCSC.symbols.SCardEndTransaction(hCard, disposition),
    "SCardEndTransaction",
  );
}

export function SCardCardStatus(
  hCard: SCARDHANDLE,
  mszReaderNames: CSTR | null,
  rgbAtr: Uint8Array | null,
): {
  readerNamesLen: DWORD;
  status: CardStatus;
  protocol: Protocol;
  atrLen: DWORD;
} {
  const readerNamesLen = new Uint8Array(DWORD_SIZE);

  if (mszReaderNames !== null) {
    new DataView(readerNamesLen.buffer).setUint32(0, mszReaderNames.length, isWin);
  }

  const state = new Uint8Array(DWORD_SIZE);
  const protocol = new Uint8Array(DWORD_SIZE);
  const atrLen = new Uint8Array(DWORD_SIZE);

  if (rgbAtr !== null) {
    new DataView(atrLen.buffer).setUint32(0, rgbAtr.length, isWin);
  }

  ensureSCardSuccess(
    libPCSC.symbols.SCardStatus(
      hCard,
      mszReaderNames?.buffer ?? null,
      readerNamesLen,
      state,
      protocol,
      rgbAtr,
      atrLen,
    ),
    "SCardStatus",
  );

  return {
    readerNamesLen: new DataView(readerNamesLen.buffer).getUint32(0),
    status: new DataView(state.buffer).getUint32(0),
    protocol: new DataView(protocol.buffer).getUint32(0),
    atrLen: new DataView(atrLen.buffer).getUint32(0),
  };
}

export async function SCardGetStatusChange(
  hContext: SCARDCONTEXT,
  timeout: DWORD,
  states: FFI_SCARDREADERSTATE[],
): Promise<FFI_SCARDREADERSTATE[]> {
  const stateBuffer = SCARDREADERSTATE.buildStateBuffer(states);

  //console.log("I", HEX.toString(stateBuffer));

  const res = (await libPCSC.symbols.SCardGetStatusChange(
    hContext,
    timeout,
    stateBuffer,
    states.length,
  )) as number;

  // Handle special error-case of timeout -> no change
  if (res == SCARD_ERROR_TIMEOUT) {
    return [];
  }

  ensureSCardSuccess(res, "SCardGetStatusChange");

  //console.log("O", HEX.toString(stateBuffer));

  return SCARDREADERSTATE.unpackStateChangeBuffer<FFI_SCARDREADERSTATE>(states, stateBuffer);
}

export function SCardGetStatusChangeSync(
  hContext: SCARDCONTEXT,
  timeout: DWORD,
  states: FFI_SCARDREADERSTATE[],
): FFI_SCARDREADERSTATE[] {
  const stateBuffer = SCARDREADERSTATE.buildStateBuffer(states);

  const res = libPCSC.symbols.SCardGetStatusChangeSync(
    hContext,
    timeout,
    stateBuffer,
    states.length,
  ) as number;

  // Handle special error-case of timeout -> no change
  if (res == SCARD_ERROR_TIMEOUT) {
    return [];
  }

  ensureSCardSuccess(res, "SCardGetStatusChange");

  //console.log("O", HEX.toString(stateBuffer));

  return SCARDREADERSTATE.unpackStateChangeBuffer<FFI_SCARDREADERSTATE>(states, stateBuffer);
}

export function SCardControl(
  hCard: SCARDHANDLE,
  ioctl: DWORD,
  dataIn: Uint8Array,
  dataOut: Uint8Array,
): DWORD {
  const outLen = new Uint8Array(DWORD_SIZE);

  new DataView(outLen.buffer).setUint32(dataOut.length, 0, true);

  ensureSCardSuccess(
    libPCSC.symbols.SCardControl(
      hCard,
      ioctl,
      dataIn,
      dataIn.length,
      dataOut,
      dataOut.length,
      outLen,
    ),
    "SCardControl",
  );

  return new DataView(outLen.buffer).getUint32(0, true);
}

export function SCardGetAttrib(
  hCard: SCARDHANDLE,
  attrID: DWORD,
  attrib: Uint8Array | null,
): DWORD {
  const bufLen = new Uint8Array(DWORD_SIZE);

  if (attrib !== null) {
    new DataView(bufLen.buffer).setUint32(attrib.length, 0, true);
  }

  ensureSCardSuccess(
    libPCSC.symbols.SCardGetAttrib(hCard, attrID, attrib, attrib, bufLen),
    "SCardGetAttrib",
  );

  return new DataView(bufLen.buffer).getUint32(0, true);
}

export function SCardSetAttrib(
  hCard: SCARDHANDLE,
  attrID: DWORD,
  attrib: Uint8Array,
) {
  ensureSCardSuccess(
    libPCSC.symbols.SCardSetAttrib(hCard, attrID, attrib, attrib.length),
    "SetAttrib",
  );
}
