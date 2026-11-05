/** Format old numeric terminals without rewriting saved booking data. */
export function formatTerminal(value: string | undefined): string {
 const terminal = value?.trim() ?? '';
 const code = /^(?:T\s*)?(\d+[A-Z]?)$/i.exec(terminal);
 return code ? `T${code[1].toUpperCase()}` : terminal;
}
