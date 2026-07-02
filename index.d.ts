/**
 * Run update and print output to terminal.
 */
declare function updateDb(
  print?: (str: string) => void,
  opts?: {
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
  }
): void

export = updateDb
