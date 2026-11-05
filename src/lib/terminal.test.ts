import { expect, it } from 'vitest';
import { formatTerminal } from './terminal';

it('labels numeric terminals and keeps existing T prefixes singular and uppercase', () => {
 for (const [input, output] of [['1', 'T1'], ['2', 'T2'], [' T1 ', 'T1'], ['t2', 'T2'], ['t 3', 'T3'], ['2e', 'T2E']]) {
  expect(formatTerminal(input)).toBe(output);
 }
});

it('preserves named terminals and leaves missing terminals unknown', () => {
 expect(formatTerminal('國際線航廈')).toBe('國際線航廈');
 expect(formatTerminal('South')).toBe('South');
 expect(formatTerminal('')).toBe('');
 expect(formatTerminal('   ')).toBe('');
 expect(formatTerminal(undefined)).toBe('');
});
