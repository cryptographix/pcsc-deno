export type DWORD = number;
export type SCARDCONTEXT = number;
export type SCARDHANDLE = number;

export type SCARDRC = number;

export class SCardException extends Error {
  constructor(public rc: SCARDRC, public func: string, detail?: string) {
    super(
      `Error 0x${rc.toString(16)} calling ${func}${
        detail !== undefined ? " - " + detail : ""
      }`,
    );
  }
}
