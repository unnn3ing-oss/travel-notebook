import { expect, it } from 'vitest';
import { dayPeriodAt } from './dayPeriod';

it.each([
 [0,0,'night'],[5,59,'night'],[6,0,'morning'],[10,59,'morning'],
 [11,0,'noon'],[13,59,'noon'],[14,0,'afternoon'],[17,59,'afternoon'],
 [18,0,'night'],[23,59,'night'],
] as const)('uses the local wall-clock boundary at %i:%i', (hour, minute, expected) => {
 expect(dayPeriodAt(new Date(2026,10,6,hour,minute))).toBe(expected);
});
