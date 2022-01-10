export const SCARD_SCOPE_USER = 0x0000; /**< Scope in user space */
export const SCARD_SCOPE_TERMINAL = 0x0001; /**< Scope in terminal */
export const SCARD_SCOPE_SYSTEM = 0x0002; /**< Scope in system */

export const SCARD_PROTOCOL_UNDEFINED = 0x0000; /**< protocol not set */
export const SCARD_PROTOCOL_UNSET = SCARD_PROTOCOL_UNDEFINED; /* backward compat */
export const SCARD_PROTOCOL_T0 = 0x0001; /**< T=0 active protocol. */
export const SCARD_PROTOCOL_T1 = 0x0002; /**< T=1 active protocol. */
export const SCARD_PROTOCOL_RAW = 0x0004; /**< Raw active protocol. */
export const SCARD_PROTOCOL_T15 = 0x0008; /**< T=15 protocol. */
export const SCARD_PROTOCOL_ANY = (SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1); /**< IFD determines prot. */

export const SCARD_SHARE_EXCLUSIVE = 0x0001; /**< Exclusive mode only */
export const SCARD_SHARE_SHARED = 0x0002; /**< Shared mode only */
export const SCARD_SHARE_DIRECT = 0x0003; /**< Raw mode only */

export const SCARD_LEAVE_CARD = 0x0000; /**< Do nothing on close */
export const SCARD_RESET_CARD = 0x0001; /**< Reset on close */
export const SCARD_UNPOWER_CARD = 0x0002; /**< Power down on close */
export const SCARD_EJECT_CARD = 0x0003; /**< Eject on close */

export const SCARD_UNKNOWN = 0x0001; /**< Unknown state */
export const SCARD_ABSENT = 0x0002; /**< Card is absent */
export const SCARD_PRESENT = 0x0004; /**< Card is present */
export const SCARD_SWALLOWED = 0x0008; /**< Card not powered */
export const SCARD_POWERED = 0x0010; /**< Card is powered */
export const SCARD_NEGOTIABLE = 0x0020; /**< Ready for PTS */
export const SCARD_SPECIFIC = 0x0040; /**< PTS has been set */

export const SCARD_STATE_UNAWARE = 0x0000; /**< App wants status */
export const SCARD_STATE_IGNORE = 0x0001; /**< Ignore this reader */
export const SCARD_STATE_CHANGED = 0x0002; /**< State has changed */
export const SCARD_STATE_UNKNOWN = 0x0004; /**< Reader unknown */
export const SCARD_STATE_UNAVAILABLE = 0x0008; /**< Status unavailable */
export const SCARD_STATE_EMPTY = 0x0010; /**< Card removed */
export const SCARD_STATE_PRESENT = 0x0020; /**< Card inserted */
export const SCARD_STATE_ATRMATCH = 0x0040; /**< ATR matches card */
export const SCARD_STATE_EXCLUSIVE = 0x0080; /**< Exclusive Mode */
export const SCARD_STATE_INUSE = 0x0100; /**< Shared Mode */
export const SCARD_STATE_MUTE = 0x0200; /**< Unresponsive card */
export const SCARD_STATE_UNPOWERED = 0x0400; /**< Unpowered card */

export const SCARD_ERROR_TIMEOUT = 0x8010000a;
export const SCARD_ERROR_CANCELLED = 0x80100002;
export const SCARD_E_NO_SERVICE = 0x8010001d;