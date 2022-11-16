export const osType/*: "windows"|"linux"|"darwin"|"unknown"*/ = (typeof Deno != "undefined") ? Deno.build.os : "unknown";

export const PLATFORM = 
{
  osType: osType,
  isWin: (osType == "windows"),
  isLinux: (osType == "linux"),
  isMac: (osType == "darwin"),

  DWORD_SIZE: (osType == "linux") ? 8 : 4,
  POINTER_SIZE: 8,   // Deno supports 64 bits only
};