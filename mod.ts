export * as ISO7816 from './iso7816/iso7816.ts';
export { CommandAPDU, ResponseAPDU, SmartCardException, HEX, BerTLV } from './iso7816/iso7816.ts';

export * as PCSC from './pcsc/pcsc.ts';
export type { Context, Reader, Card } from './pcsc/pcsc.ts';

export * as OMAPI from './omapi/omapi.ts';
export { SECommand, SEResponse, SEService } from './omapi/se-service.ts';

export * as FFI from './deno-pcsc-ffi/deno-pcsc-ffi.ts';

import { Context, Scope } from './pcsc/pcsc.ts';
import { FFIContext } from './deno-pcsc-ffi/context.ts';

export interface ContextProvider {
  establishContext: (scope?: Scope) => Context;
  readonly name: string;
}

let contextProvider: ContextProvider | undefined;

/**
 * Singleton to instantiate a ContextProvider
 * 
 * Detects running environment and auto-registers a ContextProvider for Deno `FFIContext` 
 * if a provider has not already bee registered. 
 */
function getContextProvider() {
  if (!contextProvider) {
    // Auto-registration

    // Deno 'FFI' provider
    if (typeof Deno != "undefined") {
      if (typeof Deno.UnsafePointer != "undefined") {
        // Need Deno and --unsafe
        contextProvider = {
          establishContext: FFIContext.establishContext,
          name: "Deno FFI"
        }
      }
      else {
        throw new Error("Must supply --unstable and --allow-ffi flags to Deno");
      }
    }
  }

  if (contextProvider)
    return contextProvider;

  throw new Error("No PCSC ContextProvider registered");
}

/**
 * ContextProvider
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
