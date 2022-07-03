import { Scope, StateFlag } from '../../pcsc/pcsc.ts';
import { CSTR, libFFI, FFIContext, FFI_SCARDREADERSTATE } from '../../deno-pcsc-ffi/deno-pcsc-ffi.ts';

import { assert } from 'https://deno.land/std@0.146.0/testing/asserts.ts';

/**
 * Establish context and list readers using FFI
 */
export function getContext(needReader = true) {
  const context = libFFI.SCardEstablishContext(Scope.System);
  assert(context, "Invalid Context");

  const readerNameLen = libFFI.SCardListReaders(context, null, null);
  assert(readerNameLen > 0, "ReaderLen > 0");

  if (needReader && readerNameLen <= 1) {
    assert(readerNameLen > 1, "No reader found");
  }

  const readerNamesMultiString = CSTR.alloc(readerNameLen);
  libFFI.SCardListReaders(context, null, readerNamesMultiString);

  const readers = FFIContext.readerNamesToArray(readerNamesMultiString.buffer);

  return {
    context,
    readers
  }
}

export function findCards() {
  const { context, readers } = getContext();

  const readersWithCard: CSTR[] = [];

  for (const readerName of readers) {
    const state = new FFI_SCARDREADERSTATE(readerName);
    const changed = libFFI.SCardGetStatusChangeSync(context, 0, [state]);

    if (changed.length != 0) {
      const stateFlags = changed[0].currentState & (StateFlag.Present | StateFlag.Mute);

      // Ignore MUTE cards
      if (stateFlags == StateFlag.Present) {
        readersWithCard.push(readerName);
      }
    }
  }

  return {
    context,
    readers,
    readersWithCard,
  }
}

export function isCardPresent(reader: CSTR) {
  const { context, readersWithCard } = findCards();

  libFFI.SCardReleaseContext(context);

  return readersWithCard.map(r => r.toString()).includes(reader.toString());
}

