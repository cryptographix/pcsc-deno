export enum CLA {
  // ISO class code
  ISO = 0x00,

  // Extended
  Extended = 0x80,

  SecureMessageMask = 0x03,
}

export enum INS {
  // External external authenticate instruction code
  ExternalAuthenticate = 0x82,

  // Get challenge instruction code
  GetChallenge = 0x84,

  // Internal authenticate instruction code
  InternalAuthenticate = 0x88,

  // Select file instruction code
  SelectFile = 0xA4,

  // Read record instruction code
  ReadRecord = 0xB2,

  // Update record instruction code
  UpdateRecord = 0xDC,

  // Verify instruction code
  Verify = 0x20,

  // Block Application instruction code
  BlockApplication = 0x1E,

  // Unblock application instruction code
  UnblockApplication = 0x18,

  // Unblock change PIN instruction code
  UnblockChangePin = 0x24,

  // Get data instruction code
  GetData = 0xCA,
}

export enum TAG
{

  // Application Template
  ApplicationTemplate61 = 0x61,

  // FCI Proprietary Template
  FciProprietaryTemplate = 0xA5,

  // FCI Template
  FciTemplate = 0x6F,

  // Application Identifier (AID) - card
  ApplicationID = 0x4F,
  AID = 0x4F,

  // Application Label
  ApplicationLabel = 0x50,

  // Language Preference
  LanguagePreferences = 0x5F2D,

  // Application Effective Data
  ApplicationEffectiveDate = 0x5F25,

  // Application Expiration Date
  ApplicationExpiryDate = 0x5F24,

  // Card Holder Name
  CardholderName = 0x5F20,

  // Issuer Country Code
  IssuerCountryCode = 0x5F28,

  // Issuer URL
  IssuerUrl = 0x5F50,

  // Application Primary Account Number (PAN)
  PAN = 0x5a,

  // Application Primary Account Number (PAN) Sequence Number
  PanSequenceNumber = 0x5F34,

  // Service Code
  ServiceCode = 0x5F30,
}

export enum SW {
  SW_SUCCESS = 0x9000,

  //  SW_BYTES_REMAINING(SW2) = 0x61##SW2,
  SW_WARNING_NV_MEMORY_UNCHANGED = 0x6200 ,
  SW_PART_OF_RETURN_DATA_CORRUPTED = 0x6281,
  SW_END_FILE_REACHED_BEFORE_LE_BYTE = 0x6282,
  SW_SELECTED_FILE_INVALID = 0x6283,
  SW_FCI_NOT_FORMATTED_TO_ISO = 0x6284,
  SW_WARNING_NV_MEMORY_CHANGED = 0x6300,
  SW_FILE_FILLED_BY_LAST_WRITE = 0x6381,
  //  SW_COUNTER_PROVIDED_BY_X(X) = 0x63C##X,
  //  SW_ERROR_NV_MEMORY_UNCHANGED(SW2) = 0x64##SW2,
  //  SW_ERROR_NV_MEMORY_CHANGED(SW2) = 0x65##SW2 ,
  //  SW_RESERVED(SW2) = 0x66##SW2,
  SW_WRONG_LENGTH = 0x6700 ,
  SW_FUNCTIONS_IN_CLA_NOT_SUPPORTED = 0x6800,
  SW_LOGICAL_CHANNEL_NOT_SUPPORTED = 0x6881,
  SW_SECURE_MESSAGING_NOT_SUPPORTED = 0x6882,
  SW_COMMAND_NOT_ALLOWED = 0x6900,
  SW_COMMAND_INCOMPATIBLE_WITH_FILE_STRUCTURE = 0x6981,
  SW_SECURITY_STATUS_NOT_SATISFIED = 0x6982,
  SW_FILE_INVALID = 0x6983,
  SW_DATA_INVALID = 0x6984,
  SW_CONDITIONS_NOT_SATISFIED = 0x6985,
  SW_COMMAND_NOT_ALLOWED_AGAIN = 0x6986,
  SW_EXPECTED_SM_DATA_OBJECTS_MISSING = 0x6987 ,
  SW_SM_DATA_OBJECTS_INCORRECT = 0x6988,
  SW_WRONG_PARAMS = 0x6A00   ,
  SW_WRONG_DATA = 0x6A80,
  SW_FUNC_NOT_SUPPORTED = 0x6A81,
  SW_FILE_NOT_FOUND = 0x6A82,
  SW_RECORD_NOT_FOUND = 0x6A83,
  SW_NOT_ENOUGH_SPACE_IN_FILE = 0x6A84,
  SW_LC_INCONSISTENT_WITH_TLV = 0x6A85,
  SW_INCORRECT_P1P2 = 0x6A86,
  SW_LC_INCONSISTENT_WITH_P1P2 = 0x6A87,
  SW_REFERENCED_DATA_NOT_FOUND = 0x6A88,
  SW_WRONG_P1P2 = 0x6B00,
  //SW_CORRECT_LENGTH(SW2) = 0x6C##SW2,
  SW_INS_NOT_SUPPORTED = 0x6D00,
  SW_CLA_NOT_SUPPORTED = 0x6E00,
  SW_UNKNOWN = 0x6F00,
}

export const ISO_PINBLOCK_SIZE = 8      //< Size of an ISO PIN block
export const APDU_LEN_LE_MAX_T0 = 256;  //< Maximum size for Le
