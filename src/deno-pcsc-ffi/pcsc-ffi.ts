import { CSTR } from "./ffi-utils.ts";
import {
  CardStatus,
  Disposition,
  DWORD,
  DWORD_SIZE,
  PCSCException,
  Protocol,
  SCARDCONTEXT,
  SCARDHANDLE,
  SCARDREADERSTATE,
  ShareMode,
  StateFlag,
} from "../pcsc/pcsc.ts";
import {
  ATR_OFFSET,
  SCARD_ATR_SIZE,
  SCARDREADERSTATE_SIZE,
} from "../pcsc/reader-state.ts";

import { toHex } from "../buffer-utils.ts";

const libPath = {
  "windows": "winscard.dll",
  "linux": "libpcsclite.so",
  "darwin": "/System/Library/Frameworks/PCSC.framework/PCSC",
};
const isWin = (Deno.build.os == "windows");

const HANDLE_SIZE = 4;

export const pcsc = Deno.dlopen(
  libPath[Deno.build.os],
  {
    SCardEstablishContext: {
      parameters: ["u32", "usize", "usize", "pointer"],
      result: "u32",
    },
    SCardIsValidContext: {
      parameters: ["usize"],
      result: "u32",
    },
    "SCardCancel": {
      parameters: ["usize"],
      result: "u32",
    },
    "SCardReleaseContext": {
      parameters: ["usize"],
      result: "u32",
    },
    SCardListReaders: {
      parameters: ["usize", "pointer", "pointer", "pointer"],
      result: "u32",
      name: `SCardListReaders${isWin ? "A" : ""}`,
    },
    SCardGetStatusChange: {
      parameters: ["usize", "u32", "pointer", "u32"],
      nonblocking: true,
      result: "u32",
      name: `SCardListReaders${isWin ? "A" : ""}`,
    },
    SCardConnect: {
      parameters: ["usize", "pointer", "u32", "u32", "pointer", "pointer"],
      result: "u32",
      name: `SCardConnect${isWin ? "A" : ""}`,
    },
    "SCardReconnect": {
      parameters: ["usize", "u32", "u32", "u32", "pointer"],
      result: "u32",
    },
    "SCardDisconnect": {
      parameters: ["usize", "u32"],
      result: "u32",
    },
    "SCardBeginTransaction": {
      parameters: ["usize", "u32"],
      result: "u32",
    },
    "SCardEndTransaction": {
      parameters: ["usize", "u32"],
      result: "u32",
    },
    "SCardTransmit": {
      parameters: [
        "usize",
        "pointer",
        "pointer",
        "u32",
        "pointer",
        "pointer",
        "pointer",
      ],
      result: "u32",
    },
    SCardStatus: {
      parameters: [
        "usize",
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
        "usize",
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
      parameters: ["usize", "u32", "pointer", "pointer"],
      result: "u32",
    },
    SCardSetAttrib: {
      parameters: ["usize", "u32", "pointer", "u32"],
      result: "u32",
    },
  },
);

function ensureSCardSuccess(rc: unknown, func: string) {
  if (typeof rc == "number") {
    if (rc != 0) {
      throw new PCSCException(rc, func);
    }
  }
}

export function SCardEstablishContext(scope: DWORD): SCARDCONTEXT {
  const ctx = new Uint8Array(HANDLE_SIZE);

  ensureSCardSuccess(
    pcsc.symbols.SCardEstablishContext(scope, 0, 0, ctx),
    "SCardEstablishContext",
  );

  return new DataView(ctx.buffer).getUint32(0, true);
}

export function SCardIsValidContext(hContext: SCARDCONTEXT) {
  ensureSCardSuccess(
    pcsc.symbols.SCardIsValidContext(hContext),
    "SCardIsValidContext",
  );
}

export function SCardCancel(hContext: SCARDCONTEXT) {
  ensureSCardSuccess(
    pcsc.symbols.SCardCancel(hContext),
    "SCardCancel",
  );
}

export function SCardReleaseContext(hContext: SCARDCONTEXT) {
  ensureSCardSuccess(
    pcsc.symbols.SCardReleaseContext(hContext),
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
    new DataView(readersLen.buffer).setUint32(0, mszReaders.length);
  }

  const readerNames = mszReaders?.buffer ?? null;

  ensureSCardSuccess(
    pcsc.symbols.SCardListReaders(
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
  const handle = new Uint8Array(HANDLE_SIZE);

  ensureSCardSuccess(
    //    pcsc.symbols.SCardConnectA(
    pcsc.symbols.SCardConnect(
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
    handle: new DataView(handle.buffer).getUint32(0, true),
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
    pcsc.symbols.SCardReconnect(
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
    pcsc.symbols.SCardDisconnect(
      hCard,
      disposition,
    ),
    "SCardDisconnect",
  );
}

//type LPCSCARD_IO_REQUEST = null;
//type LPSCARD_IO_REQUEST = null;

export function SCardTransmit(
  hCard: SCARDHANDLE,
  //pioSendPci: LPCSCARD_IO_REQUEST,
  sendBuffer: Uint8Array,
  //pioRecvPci: LPSCARD_IO_REQUEST,
  recvLength: DWORD,
): Uint8Array {
  const pioSendPci = new Uint8Array(8);
  new DataView(pioSendPci.buffer).setUint32(0, 1, true);
  new DataView(pioSendPci.buffer).setUint32(4, 8, true);

  const pioRecvPci = new Uint8Array(8);
  pioRecvPci.set(pioSendPci);

  const recvBuffer = new Uint8Array(recvLength + 2);

  const length = new Uint8Array(DWORD_SIZE);

  new DataView(length.buffer).setUint32(0, recvBuffer.length);

  ensureSCardSuccess(
    pcsc.symbols.SCardTransmit(
      hCard,
      pioSendPci,
      sendBuffer,
      sendBuffer.length,
      pioRecvPci,
      recvBuffer,
      length,
    ),
    "SCardTransmit",
  );

  recvLength = new DataView(length.buffer).getUint32(0, true);

  return recvBuffer.slice(0, recvLength);
}

export function SCardBeginTransaction(hCard: SCARDHANDLE) {
  ensureSCardSuccess(
    pcsc.symbols.SCardBeginTransaction(hCard),
    "SCardBeginTransaction",
  );
}

export function SCardEndTransaction(
  hCard: SCARDHANDLE,
  disposition: Disposition,
) {
  ensureSCardSuccess(
    pcsc.symbols.SCardEndTransaction(hCard, disposition),
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
    new DataView(readerNamesLen.buffer).setUint32(0, mszReaderNames.length);
  }

  const state = new Uint8Array(DWORD_SIZE);
  const protocol = new Uint8Array(DWORD_SIZE);
  const atrLen = new Uint8Array(DWORD_SIZE);

  if (rgbAtr !== null) {
    new DataView(atrLen.buffer).setUint32(0, rgbAtr.length);
  }

  ensureSCardSuccess(
    pcsc.symbols.SCardStatus(
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

export function SCardGetStatusChange(
  hContext: SCARDCONTEXT,
  timeout: DWORD,
  states: SCARDREADERSTATE[],
): Promise<number> {
  const stateBuffer = new Uint8Array(
    SCARDREADERSTATE_SIZE * states.length,
  );

  states.forEach((state, index) =>
    stateBuffer.set(
      state.buffer,
      index * SCARDREADERSTATE_SIZE,
    )
  );

  // In darwin, the LPSCARD_READERSTATE_A has 1 byte alignment and hence
  // has no trailing padding. Go does add 3 bytes of padding (on both 32
  // and 64 bits), so we pack an array manually instead.
  // const size = int(unsafe.Sizeof(states[0])) - 3

  //console.log("I", toHex(stateBuffer));

  //  const func = pcsc.symbols.SCardGetStatusChangeA(
  const func = pcsc.symbols.SCardGetStatusChange(
    hContext,
    timeout,
    stateBuffer,
    states.length,
  ) as Promise<number>;

  return func.then((res: number) => {
    if (res !== 0) {
      console.log(`GSC=0x${res.toString(16)}`);
      return res;
    }

    //console.log("O", toHex(stateBuffer));

    //   switch (res) {
    //   case SCARD_ERROR_TIMEOUT:
    //   case SCARD_ERROR_CANCELLED:
    //   case SCARD_E_NO_SERVICE: {
    //     return false; // no change
    //   }

    //   default:
    //     ensureSCardSuccess(res, "SCardGetStatusChange");
    // }

    states.forEach((state, index) => {
      // update state ...
      state.handleChange(
        stateBuffer.slice(
          index * SCARDREADERSTATE_SIZE,
          SCARDREADERSTATE_SIZE,
        ),
      );
    });

    return 0; // OK
  });
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
    pcsc.symbols.SCardControl(
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
    pcsc.symbols.SCardGetAttrib(hCard, attrID, attrib, attrib, bufLen),
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
    pcsc.symbols.SCardSetAttrib(hCard, attrID, attrib, attrib.length),
    "SetAttrib",
  );
}

export class SCARDREADERSTATE_FFI extends SCARDREADERSTATE<CSTR, null> {
  protected initBuffer() {
    this.buffer.fill(0);

    const data = new DataView(this.buffer.buffer);

    data.setBigUint64(
      0,
      Deno.UnsafePointer.of(this.name.buffer).valueOf(),
      true,
    );

    data.setUint32(ATR_OFFSET, SCARD_ATR_SIZE);
  }
}
