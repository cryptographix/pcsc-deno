export { SCARDREADERSTATE } from './reader-state.ts';
export * from './errors.ts';

export const INFINITE = 0xFFFFFFFF;

export type DWORD = number;
export const DWORD_SIZE = 4;

export type SCARDCONTEXT = DWORD | bigint;
export type SCARDHANDLE = DWORD | bigint;

export enum Disposition {
  LeaveCard = 0x0000, /**< SCARD_LEAVE_CARD - Do nothing on close */
  ResetCard = 0x0001, /**< SCARD_RESET_CARD - Reset on close */
  UnpowerCard = 0x0002, /**< SCARD_UNPOWER_CARD - Power down on close */
  EjectCard = 0x0003, /**< SCARD_EJECT_CARD - Eject on close */
}

export type StateFlags = StateFlag; // DWORD of StateFlag[]

export enum StateFlag {
  Unaware = 0x0000, /**< SCARD_STATE_UNAWARE - App unaware of reader status */
  Ignore = 0x0001, /**< SCARD_STATE_IGNORE - Ignore this reader */
  Changed = 0x0002, /**< SCARD_STATE_CHANGED - State is different to last */
  Unknown = 0x0004, /**< SCARD_STATE_UNKNOWN - Reader name not recognised */
  Unavailable = 0x0008, /**< SCARD_STATE_UNAVAILABLE - Reader is unavailable */
  Empty = 0x0010, /**< SCARD_STATE_EMPTY - No card in reader */
  Present = 0x0020, /**< SCARD_STATE_PRESENT - Card inserted */
  Atrmatch = 0x0040, /**< SCARD_STATE_ATRMATCH - ATR matches target cards */
  Exclusive = 0x0080, /**< SCARD_STATE_EXCLUSIVE - Reader in exclusive mode */
  Inuse = 0x0100, /**< SCARD_STATE_INUSE - Reader in use */
  Mute = 0x0200, /**< SCARD_STATE_MUTE - Card in reader unresponsive */
  Unpowered = 0x0400, /**< SCARD_STATE_UNPOWERED - Card not powered */
}

export enum ShareMode {
  Exclusive = 0x0001, /**< SCARD_SHARE_EXCLUSIVE - Exclusive mode only */
  Shared = 0x0002, /**< SCARD_SHARE_SHARED - Shared mode only */
  Direct = 0x0003, /**< SCARD_SHARE_DIRECT - Raw mode only */
}

export enum Protocol {
  Undefined = 0x0000,
  T0 = 0x0001, /**< SCARD_PROTOCOL_T0 - T=0 active protocol. */
  T1 = 0x0002, /**< SCARD_PROTOCOL_T1 - T=1 active protocol. */
  Raw = 0x0004, /**< SCARD_PROTOCOL_RAW - Raw active protocol. */
  T15 = 0x0008, /**< SCARD_PROTOCOL_T15 - T=15 protocol. */
  Any = (0x0001 | 0x0002), /**< IFD determines prot. */
}

export enum Scope {
  User = 0x0000, /**< SCARD_SCOPE_USER - Scope in user space */
  Terminal = 0x0001, /**< SCARD_SCOPE_TERMINAL - Scope in terminal */
  System = 0x0002, /**< SCARD_SCOPE_SYSTEM - Scope in system */
}

export const isWin = (typeof Deno != "undefined") ? Deno.build.os == "windows" : false;

export enum CardStatus {
  Unknown = (isWin) ? 0 : 0x0001, /**< SCARD_UNKNOWN - Unknown state */
  Absent = (isWin) ? 1 : 0x0002, /**< SCARD_ABSENT - Card is absent */
  Present = (isWin) ? 2 : 0x0004, /**< SCARD_PRESENT - Card is present */
  Swallowed = (isWin) ? 3 : 0x0008, /**< SCARD_SWALLOWED - Card not powered */
  Powered = (isWin) ? 4 : 0x0010, /**< SCARD_POWERED - Card is powered */
  Negotiable = (isWin) ? 5 : 0x0020, /**< SCARD_NEGOTIABLE - Ready for PTS */
  Specific = (isWin) ? 6 : 0x0040, /**< SCARD_SPECIFIC - PTS has been set */
}
