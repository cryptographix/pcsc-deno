import { CSTR, FFIContext, libFFI, PCSC } from '../../mod.ts';

import { assert } from 'https://deno.land/std@0.146.0/testing/asserts.ts';

/**
 * Establish context and list readers using FFI
 */
export function getContext(needReader = true) {
  const context = libFFI.SCardEstablishContext(PCSC.Scope.System);
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

export async function findCards() {
  const { context, readers } = getContext();

  const readersWithCard: CSTR[] = [];

  for (const readerName of readers) {
    const state = new libFFI.SCARDREADERSTATE_FFI(readerName);
    const changed = await libFFI.SCardGetStatusChange(context, 0, [state]);

    if (changed.length != 0) {
      const stateFlags = changed[0].currentState & (PCSC.StateFlag.Present | PCSC.StateFlag.Mute);

      // Ignore MUTE cards
      if (stateFlags == PCSC.StateFlag.Present) {
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

export async function isCardPresent(reader: CSTR) {
  const { context, readersWithCard } = await findCards();

  libFFI.SCardReleaseContext(context);

  return readersWithCard.map( r => r.toString() ).includes(reader.toString());
}

