import { CSTR } from "./ffi-utils.ts";

import {
  DWORD,
  SCARD_STATE_CHANGED,
  SCARDCONTEXT,
  PCSCException,
  SCARDHANDLE,
} from "../pcsc-types/mod.ts";

const DWORD_SIZE = 4;

const HANDLE_SIZE = 4;

const libPath = {
  "windows": "winscard.dll",
  "linux": "libpcsclite.so",
  "darwin": "/System/Library/Frameworks/PCSC.framework/PCSC"
};
const isWin = (Deno.build.os == "windows");

export const pcsc = Deno.dlopen(
  libPath[Deno.build.os],
  {
    "SCardEstablishContext": {
      parameters: ["u32", "usize", "usize", "pointer"],
      result: "u32",
    },
    "SCardIsValidContext": {
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
    [isWin?"SCardListReadersA":"SCardListReaders"]: {
      parameters: ["usize", "pointer", "pointer", "pointer"],
      result: "u32",
    },
    [isWin?"SCardGetStatusChangeA":"SCardGetStatusChange"]: {
      parameters: ["usize", "u32", "pointer", "u32"],
      nonblocking: true,
      result: "u32",
    },
    [isWin?"SCardConnectA":"SCardConnect"]: {
      parameters: ["usize", "pointer", "u32", "u32", "pointer", "pointer"],
      result: "u32",
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
    [isWin?"SCardStatusA":"SCardStatus"]: {
      parameters: ["usize", "u32"],
      result: "u32",
    },
    "SCardControl": {
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
    },
    "SCardGetAttrib": {
      parameters: ["usize", "u32", "pointer", "pointer"],
      result: "u32",
    },
    "SCardSetAttrib": {
      parameters: ["usize", "u32"],
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

export function SCardEstablishContext(dwScope: DWORD): SCARDCONTEXT {
  const ctx = new Uint8Array(HANDLE_SIZE);

  ensureSCardSuccess(
    pcsc.symbols.SCardEstablishContext(dwScope, 0, 0, ctx),
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
    pcsc.symbols[isWin?"SCardListReadersA":"SCardListReaders"](
      hContext,
      mszGroups,
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
  dwShareMode: DWORD,
  dwPreferredProtocols: DWORD,
): { handle: SCARDHANDLE; protocol: DWORD } {
  const protocol = new Uint8Array(DWORD_SIZE);
  const handle = new Uint8Array(HANDLE_SIZE);

  ensureSCardSuccess(
//    pcsc.symbols.SCardConnectA(
    pcsc.symbols[isWin?"SCardConnectA":"SCardConnect"](
      hContext,
      readerName.buffer,
      dwShareMode,
      dwPreferredProtocols,
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
  dwShareMode: DWORD,
  dwPreferredProtocols: DWORD,
  dwInitialization: DWORD,
): { protocol: DWORD } {
  const protocol = new Uint8Array(DWORD_SIZE);

  ensureSCardSuccess(
    pcsc.symbols.SCardReconnect(
      hCard,
      dwShareMode,
      dwPreferredProtocols,
      dwInitialization,
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
  dwDisposition: DWORD,
): void {
  ensureSCardSuccess(
    pcsc.symbols.SCardDisconnect(
      hCard,
      dwDisposition,
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

  const recvBuffer = new Uint8Array(recvLength+2);

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

export function SCardEndTransaction(hCard: SCARDHANDLE, disposition: DWORD) {
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
  state: DWORD;
  protocol: DWORD;
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
    //pcsc.symbols.SCardStatusA(
    pcsc.symbols[isWin?"SCardStatusA":"SCardStatus"](
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
    state: new DataView(state.buffer).getUint32(0),
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
    SCARDREADERSTATE.SCARDREADERSTATE_SIZE * states.length,
  );

  states.forEach((state, index) =>
    stateBuffer.set(
      state.buffer,
      index * SCARDREADERSTATE.SCARDREADERSTATE_SIZE,
    )
  );

  // In darwin, the LPSCARD_READERSTATE_A has 1 byte alignment and hence
  // has no trailing padding. Go does add 3 bytes of padding (on both 32
  // and 64 bits), so we pack an array manually instead.
  // const size = int(unsafe.Sizeof(states[0])) - 3

//  const func = pcsc.symbols.SCardGetStatusChangeA(
  const func = pcsc.symbols[isWin?"SCardGetStatusChangeA":"SCardGetStatusChange"](
    hContext,
    timeout,
    stateBuffer,
    states.length,
  ) as Promise<number>;

  return func.then((res: number) => {
    if ( res !== 0 ) {
      return res;
    }
    
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
      state.buffer.set(
        stateBuffer.slice(
          index * SCARDREADERSTATE.SCARDREADERSTATE_SIZE,
          SCARDREADERSTATE.SCARDREADERSTATE_SIZE,
        ),
        0,
      );

      // ready for next
      state.currentState = state.eventState & ~SCARD_STATE_CHANGED;
    });

    return 0; // changed
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
  dwAttrID: DWORD,
  attrib: Uint8Array | null,
): DWORD {
  const bufLen = new Uint8Array(DWORD_SIZE);

  if (attrib !== null) {
    new DataView(bufLen.buffer).setUint32(attrib.length, 0, true);
  }

  ensureSCardSuccess(
    pcsc.symbols.SCardGetAttrib(hCard, dwAttrID, attrib, attrib, bufLen),
    "SCardGetAttrib",
  );

  return new DataView(bufLen.buffer).getUint32(0, true);
}

export function SCardSetAttrib(
  hCard: SCARDHANDLE,
  dwAttrID: DWORD,
  attrib: Uint8Array,
) {
  ensureSCardSuccess(
    pcsc.symbols.SCardSetAttrib(hCard, dwAttrID, attrib, attrib.length),
    "SetAttrib",
  );
}

export class SCARDREADERSTATE {
  buffer: Uint8Array;
  readerName: CSTR;
  pUserData: null;

  static SCARD_ATR_SIZE = 33;
  static SCARDREADERSTATE_SIZE =
    (8 + 8 + 4 + 4 + 4 + SCARDREADERSTATE.SCARD_ATR_SIZE);

  constructor(readerName: CSTR) {
    this.buffer = new Uint8Array(SCARDREADERSTATE.SCARDREADERSTATE_SIZE);

    this.readerName = readerName;

    this.pUserData = null;

    this.initBuffer();
  }

  get stateBuffer(): Uint8Array {
    return this.buffer;
  }

  get currentState(): DWORD {
    return new DataView(this.buffer.buffer).getUint32(8 + 8, true);
  }
  set currentState(state: DWORD) {
    new DataView(this.buffer.buffer).setUint32(8 + 8, state, true);
  }
  get eventState(): DWORD {
    return new DataView(this.buffer.buffer).getUint32(8 + 8 + 4, true);
  }

  get atr(): Uint8Array {
    const atrLen = new DataView(this.buffer.buffer).getUint32(
      8 + 8 + 4 + 4,
      true,
    );

    const atr = new Uint8Array(atrLen);
    atr.set(this.buffer.slice(8 + 8 + 4 + 4 + 4, atrLen));

    return atr;
  }

  private initBuffer() {
    const data = new DataView(this.buffer.buffer);

    data.setBigUint64(
      0,
      Deno.UnsafePointer.of(this.readerName.buffer).valueOf(),
      true,
    );
    data.setBigUint64(8, 0n);
    data.setUint32(8 + 8, 0);
    data.setUint32(8 + 8 + 4, 0);
    data.setUint32(8 + 8 + 4 + 4, SCARDREADERSTATE.SCARD_ATR_SIZE);
  }
}
