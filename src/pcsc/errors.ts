export const SCARD_ERROR_TIMEOUT = 0x8010000a;
export const SCARD_ERROR_CANCELLED = 0x80100002;
export const SCARD_E_NO_SERVICE = 0x8010001d;

export class PCSCException extends Error {
  constructor(public rc: number, public func: string, detail?: string) {
    super(
      `Error 0x${rc.toString(16)} calling ${func}${
        detail !== undefined ? " - " + detail : ""
      }`,
    );
  }
}
