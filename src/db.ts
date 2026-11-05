import Dexie, { type EntityTable } from 'dexie';
import type { Item, Route, Task, Trip, Expense, Document, TripDetails } from './types';
import { seedKyoto } from './seed';

export const db = new Dexie('travel-notebook') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  documents: EntityTable<Document, 'id'>;
  details: EntityTable<TripDetails, 'id'>;
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

db.version(2).stores({ expenses: 'id, tripId, [tripId+date]', documents: 'id, tripId', details: 'id' });

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** First launch: put the sample trip in so there is something to try. */
export async function ensureSeed() {
  const s = seedKyoto();
  await db.transaction('rw', db.trips, db.items, db.routes, db.tasks, async () => {
    if ((await db.trips.count()) > 0) return;
    await db.trips.add(s.trip);
    await db.items.bulkAdd(s.items);
    await db.routes.bulkAdd(s.routes);
    await db.tasks.bulkAdd(s.tasks);
  });
}
