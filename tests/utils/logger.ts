
const verbose = (Deno.args.includes('--verbose'));
const info = (Deno.args.includes('--info'));

export const Logger = {
  info(...args: unknown[]) {
    if (info || verbose)
      console.log(...args);
  },

  detail(...args: unknown[]) {
    if (verbose)
      console.log(...args);
  },
}

