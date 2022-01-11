export type DWORD = number;
export type SCARDCONTEXT = number;
export type SCARDHANDLE = number;

export class PCSCException extends Error {
  constructor(public rc: number, public func: string, detail?: string) {
    super(
      `Error 0x${rc.toString(16)} calling ${func}${
        detail !== undefined ? " - " + detail : ""
      }`,
    );
  }
}
