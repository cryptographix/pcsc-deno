export * as ISO7816 from './iso7816/iso7816.ts';

export { CommandAPDU, ResponseAPDU, HEX } from './iso7816/iso7816.ts';

export * as PCSC from './pcsc/pcsc.ts';
export type { Context, Reader, Card } from './pcsc/pcsc.ts';

export * as OMAPI from './omapi/omapi.ts';
export { SECommand, SEResponse, SEService } from './omapi/se-service.ts';

export { FFIContext } from './deno-pcsc-ffi/context.ts';
export { FFIReader } from './deno-pcsc-ffi/reader.ts';
export { FFICard } from './deno-pcsc-ffi/card.ts';

import { Context } from './pcsc/pcsc.ts';
import { FFIContext } from './deno-pcsc-ffi/context.ts';
import { Scope } from './pcsc/pcsc.ts';

export interface ContextProvider {
  establishContext: (scope?: Scope) => Context;
  readonly name: string;
}

let contextProvider: ContextProvider | undefined;

function getContextProvider() {
  if (!contextProvider) {
    if (typeof Deno != "undefined" && typeof Deno.UnsafePointer != "undefined") {
      // Need Deno and --unsafe
      contextProvider = {
        establishContext: FFIContext.establishContext,
        name: "Deno FFI"
      }
    }
    else {
      throw new Error("No PCSC ContextProvider registered");
    }
  }

  return contextProvider!;
}

/**
 * Singleton ContextProvider
 */
export const ContextProvider = {
  registerProvider(provider: ContextProvider) {
    contextProvider = provider;
  },

  get provider(): ContextProvider {
    return getContextProvider();
  },

  establishContext(scope?: Scope): Context {
    return getContextProvider().establishContext(scope);
  },
}
