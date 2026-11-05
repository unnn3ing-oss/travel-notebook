import { describe, expect, it } from 'vitest';
import type { Item } from '../types';
import { airportDestination, tripDestination } from './destinations';
const flight = (id: string, to: string, date: string | null, start = '06:00'): Item => ({ id, tripId: 'trip', type: 'flight', title: id, date, start, end: '', to });
describe('destination artwork from flight data', () => {
 it('recognizes the six destinations and regional airports without guessing other names', () => {
  for (const [airport, destination] of [['NRT','japan'],['kix','japan'],['ICN','korea'],['PUS','korea'],['TPE','taiwan'],['KHH','taiwan'],[' SIN ','singapore'],['HKG','hongkong'],['KUL','malaysia'],['PEN','malaysia']]) expect(airportDestination(airport)).toBe(destination);
  for (const airport of ['LHR', '', 'Tokyo', '__proto__']) expect(airportDestination(airport)).toBeUndefined();
 });
 it('keeps the first destination across return flights, manual order and unscheduled cards without mutating input', () => {
  const items = [flight('return','TPE','2026-11-14'), flight('unscheduled','SIN',null), flight('outbound','NRT','2026-11-09'), flight('connection','KUL','2026-11-09','12:00')];
  const before = structuredClone(items);
  expect(tripDestination(items, 'trip')).toEqual({ airport: 'NRT', destination: 'japan' });
  expect(items).toEqual(before);
 });
 it('uses explicit nested flight fields and limits selection to the current trip', () => {
  const nested = { ...flight('a','TPE','2026-11-10'), flight: { to: 'HKG', departureDate: '2026-11-08', departureTime: '07:00' } } as Item;
  expect(tripDestination([{...flight('other','ICN','2026-11-01'),tripId:'other'}, nested, flight('b','SIN','2026-11-09')], 'trip')).toEqual({airport:'HKG',destination:'hongkong'});
 });
 it('keeps an unknown first destination neutral instead of using the known return airport', () => {
  expect(tripDestination([flight('out','LHR','2026-11-09'),flight('back','TPE','2026-11-14')], 'trip')).toEqual({airport:'LHR',destination:undefined});
  expect(tripDestination([], 'trip')).toBeUndefined();
  expect(tripDestination([{...flight('empty','','2026-11-09')}], 'trip')).toBeUndefined();
  expect(tripDestination([flight('missing','','2026-11-09'),flight('return','TPE','2026-11-14')], 'trip')).toBeUndefined();
 });
});
