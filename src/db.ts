import Dexie, { type EntityTable } from 'dexie';
import type { Item, Route, Task, Trip } from './types';
import { seedKyoto } from './seed';

export const db = new Dexie('travel-notebook') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
  items: EntityTable<Item, 'id'>;
  routes: EntityTable<Route, 'id'>;
  tasks: EntityTable<Task, 'id'>;
};

db.version(1).stores({
  trips: 'id, start',
  items: 'id, tripId, [tripId+date]',
  routes: 'id, itemId',
  tasks: 'id, tripId',
});

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** First launch: put the sample trip in so there is something to try. */
export async function ensureSeed() {
  if ((await db.trips.count()) > 0) return;
  const s = seedKyoto();
  await db.transaction('rw', db.trips, db.items, db.routes, db.tasks, async () => {
    await db.trips.add(s.trip);
    await db.items.bulkAdd(s.items);
    await db.routes.bulkAdd(s.routes);
    await db.tasks.bulkAdd(s.tasks);
  });
}
