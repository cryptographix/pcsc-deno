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

import { PLATFORM } from '../pcsc/platform.ts';
import { FFI_SCARDREADERSTATE } from './reader.ts';

const libPath = {
  "windows": "winscard.dll",
  "linux": "libpcsclite.so.1",
  "darwin": "/System/Library/Frameworks/PCSC.framework/PCSC",
};

// PC/SC HANDLE
// Darwin (M1, ?) and linux, via pcsclite, use DWORD
// Windows x64 (winscard.dll) uses a long long 
const FFI_PCSC_HANDLE = (PLATFORM.isWin) ? "pointer" : "usize";
const FFI_PCSC_HANDLE_SIZE = (PLATFORM.isWin) ? PLATFORM.POINTER_SIZE : PLATFORM.DWORD_SIZE;

const libPCSC = Deno.dlopen(
  libPath[Deno.build.os],
  {
    SCardEstablishContext: {
      parameters: ["u32", "usize", "usize", "buffer"],
      result: "u32",
    },
    SCardListReaders: {
      parameters: [FFI_PCSC_HANDLE, "buffer", "buffer", "buffer"],
      result: "u32",
      name: `SCardListReaders${PLATFORM.isWin ? "A" : ""}`,
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
      parameters: [FFI_PCSC_HANDLE, "u32", "buffer", "u32"],
      nonblocking: true,
      result: "u32",
      name: `SCardGetStatusChange${PLATFORM.isWin ? "A" : ""}`,
    },
    SCardGetStatusChangeSync: {
      parameters: [FFI_PCSC_HANDLE, "u32", "buffer", "u32"],
      result: "u32",
      name: `SCardGetStatusChange${PLATFORM.isWin ? "A" : ""}`,
    },
    SCardConnect: {
      parameters: [FFI_PCSC_HANDLE, "buffer", "u32", "u32", "buffer", "buffer"],
      result: "u32",
      name: `SCardConnect${PLATFORM.isWin ? "A" : ""}`,
    },
    "SCardReconnect": {
      parameters: [FFI_PCSC_HANDLE, "u32", "u32", "u32", "buffer"],
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
        "buffer",
        "buffer",
        "u32",
        "buffer",
        "buffer",
        "buffer",
      ],
      nonblocking: true,
      result: "u32",
    },
    "SCardTransmitSync": {
      parameters: [
        FFI_PCSC_HANDLE,
        "buffer",
        "buffer",
        "u32",
        "buffer",
        "buffer",
        "buffer",
      ],
      result: "u32",
      name: `SCardTransmit`,
    },
    SCardStatus: {
      parameters: [
        FFI_PCSC_HANDLE,
        "buffer",
        "buffer",
        "buffer",
        "buffer",
        "buffer",
        "buffer",
      ],
      result: "u32",
      name: `SCardStatus${PLATFORM.isWin ? "A" : ""}`,
    },
    SCardControl: {
      parameters: [
        FFI_PCSC_HANDLE,
        "u32",
        "buffer",
        "u32",
        "buffer",
        "u32",
        "buffer",
      ],
      result: "u32",
    },
    SCardGetAttrib: {
      parameters: [FFI_PCSC_HANDLE, "u32", "buffer", "buffer"],
      result: "u32",
    },
    SCardSetAttrib: {
      parameters: [FFI_PCSC_HANDLE, "u32", "buffer", "u32"],
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

class DWORDBuffer extends Uint8Array {
  constructor(value?: DWORD) {
    super(PLATFORM.DWORD_SIZE);

    this.value = value ?? 0;
  }

  get value(): DWORD {
    const view = new DataView(this.buffer);

    // TODO: Handle ARM64 Big-endian
    return (PLATFORM.DWORD_SIZE == 4)
      ? view.getUint32(0, true)
      : Number(view.getBigUint64(0, true));
  }

  set value(value: DWORD) {
    const view = new DataView(this.buffer);

    // TODO: Handle ARM64 Big-endian
    if (PLATFORM.DWORD_SIZE == 4)
      view.setUint32(0, value, true);
    else
      view.setBigUint64(0, BigInt(value), true);
  }
}

function getHandleFromBuffer(handle: Uint8Array): number | bigint {
  const view = new DataView(handle.buffer);

  return (FFI_PCSC_HANDLE_SIZE == 8) ? view.getBigUint64(0, true) : view.getUint32(0, true);
}

export function SCardEstablishContext(scope: DWORD): SCARDCONTEXT {
  const context = new Uint8Array(FFI_PCSC_HANDLE_SIZE);

  ensureSCardSuccess(
    libPCSC.symbols.SCardEstablishContext(scope, 0, 0, context),
    "SCardEstablishContext",
  );

  return getHandleFromBuffer(context);
}

export function SCardIsValidContext(hContext: SCARDCONTEXT): boolean {
  const ret = libPCSC.symbols.SCardIsValidContext(hContext);

  return (ret == 0);
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
  const readerNamesLen = new DWORDBuffer(mszReaders?.length);

  const readerNames = mszReaders?.buffer ?? null;

  ensureSCardSuccess(
    libPCSC.symbols.SCardListReaders(
      hContext,
      mszGroups?.buffer ?? null,
      readerNames,
      readerNamesLen,
    ),
    "SCardListReaders",
  );

  return readerNamesLen.value;
}

export function SCardConnect(
  hContext: SCARDCONTEXT,
  readerName: CSTR,
  shareMode: ShareMode,
  preferredProtocols: Protocol,
): { handle: SCARDHANDLE; protocol: Protocol } {
  const protocol = new DWORDBuffer();
  const handle = new Uint8Array(FFI_PCSC_HANDLE_SIZE);

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
    handle: getHandleFromBuffer(handle),
    protocol: protocol.value,
  };
}

export function SCardReconnect(
  hCard: SCARDHANDLE,
  shareMode: ShareMode,
  preferredProtocols: DWORD,
  initialization: Disposition,
): { protocol: Protocol } {
  const protocol = new DWORDBuffer();

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
    protocol: protocol.value,
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

function prepareTransmit(recvLength: DWORD, activeProtocol: DWORD) {
  const PIO_SIZE = 2 * PLATFORM.DWORD_SIZE;

  const pioSendPci = new Uint8Array(PIO_SIZE);
  new DataView(pioSendPci.buffer).setUint32(0, activeProtocol, true);
  new DataView(pioSendPci.buffer).setUint32(PLATFORM.DWORD_SIZE, PIO_SIZE, true);

  const pioRecvPci = new Uint8Array(PIO_SIZE);
  pioRecvPci.set(pioSendPci);

  const recvBuffer = new Uint8Array(recvLength + 2);
  const recvLengthBuffer = new DWORDBuffer(recvBuffer.length);

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
  activeProtocol: DWORD,
): Promise<Uint8Array> {
  const { pioSendPci, pioRecvPci, recvBuffer, recvLengthBuffer } = prepareTransmit(recvLength, activeProtocol);

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

  recvLength = recvLengthBuffer.value;

  return recvBuffer.slice(0, recvLength);
}

export function SCardTransmitSync(
  hCard: SCARDHANDLE,
  sendBuffer: Uint8Array,
  recvLength: DWORD,
  activeProtocol: DWORD,
): Uint8Array {
  const { pioSendPci, pioRecvPci, recvBuffer, recvLengthBuffer } = prepareTransmit(recvLength, activeProtocol);

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

  recvLength = recvLengthBuffer.value;

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
  const readerNamesLen = new DWORDBuffer(mszReaderNames?.length);
  const state = new DWORDBuffer();
  const protocol = new DWORDBuffer();
  const atrLen = new DWORDBuffer(rgbAtr?.length)

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
    readerNamesLen: readerNamesLen.value,
    status: state.value,
    protocol: protocol.value,
    atrLen: atrLen.value,
  };
}

export async function SCardGetStatusChange(
  hContext: SCARDCONTEXT,
  timeout: DWORD,
  states: FFI_SCARDREADERSTATE[],
): Promise<number[]> {
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
): number[] {
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
  const outLen = new DWORDBuffer(dataOut.length);

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

  return outLen.value;
}

export function SCardGetAttrib(
  hCard: SCARDHANDLE,
  attrID: DWORD,
  attrib: Uint8Array | null,
): DWORD {
  const bufLen = new DWORDBuffer(attrib?.length);

  ensureSCardSuccess(
    libPCSC.symbols.SCardGetAttrib(hCard, attrID, attrib, attrib, bufLen),
    "SCardGetAttrib",
  );

  return bufLen.value;
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
