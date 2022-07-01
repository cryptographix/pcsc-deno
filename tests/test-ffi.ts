import { CSTR, nativeDenoFFI as lib, PCSC} from '../mod.ts';
import { SCARDREADERSTATE_FFI } from '../src/deno-pcsc-ffi/pcsc-ffi.ts';

const ctx = lib.SCardEstablishContext(PCSC.Scope.System);
console.log("Context:", ctx);

const rdrLen = lib.SCardListReaders(ctx, null, null);
console.log(rdrLen);

const readerNames = CSTR.alloc(rdrLen);

lib.SCardListReaders(ctx, null, readerNames);
console.log(readerNames.toString());

const readerNameOffsets = readerNames.buffer.reduce<number[]>(
  (acc, cur, curIdx) => (cur == 0) ? [...acc, curIdx] : acc,
  [0],
).slice(0, -1);

const readerNameArray = readerNameOffsets.flatMap<CSTR>((val, index, array) => {
  return (index < array.length - 1)
    ? CSTR.fromNullTerminated(readerNames.buffer.slice(val, array[index + 1]+1))
    : [];
});

console.log("Readers:", readerNameArray.map((r) => r.toString()).join(","));

const { handle: card, protocol } = lib.SCardConnect(
  ctx,
  readerNameArray[0],
  PCSC.ShareMode.Shared,
  PCSC.Protocol.Any,
);

console.log("Card Handle", card, "Protocol:", protocol);

// deno-fmt-ignore
const selectFile = [ 0x00, 0xA4, 0x04, 0x00, 0x07, 0xA0, 0x00, 0x00, 0x01, 0x54, 0x44, 0x42, 0x00, ];

const rapdu = lib.SCardTransmit(card, Uint8Array.from(selectFile), 256);
console.log(rapdu);

const state = new SCARDREADERSTATE_FFI(readerNameArray[0]);
const res = await lib.SCardGetStatusChange(ctx, 100, [state]);
console.log(res);
