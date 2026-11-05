import 'fake-indexeddb/auto';
import { afterAll, expect, it } from 'vitest';
import { db, ensureSeed } from './db';
it('initializes a fresh database safely when StrictMode starts two calls together', async () => {
  await db.delete();
  await db.open();
  await Promise.all([ensureSeed(),ensureSeed()]);
  expect(await db.trips.count()).toBe(1);
  expect(await db.items.count()).toBeGreaterThan(0);
  await ensureSeed();
  expect(await db.trips.count()).toBe(1);
});
afterAll(async () => {await db.delete();});

it('preserves version 1 travel data when upgrading to the new local tables', async () => {
  await db.delete();
  const {default:Dexie}=await import('dexie');
  const previous=new Dexie('travel-notebook');
  previous.version(1).stores({trips:'id, start',items:'id, tripId, [tripId+date]',routes:'id, itemId',tasks:'id, tripId'});
  await previous.table('trips').add({id:'existing',name:'原有旅程',start:'2027-01-01',end:'2027-01-03',people:2,currency:'JPY'});
  previous.close();
  await db.open();
  expect((await db.trips.get('existing'))?.name).toBe('原有旅程');
  await db.expenses.add({id:'expense',tripId:'existing',date:'2027-01-01',title:'咖啡',amount:500});
  expect(await db.expenses.count()).toBe(1);
});
