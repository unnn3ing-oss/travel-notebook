import type { Trip } from '../types';
/** Include travel in progress, then future trips, in departure order. */
export const upcomingTrips = (trips: Trip[], today: string) => trips.filter(t => t.end >= today).sort((a,b) => a.start.localeCompare(b.start));
