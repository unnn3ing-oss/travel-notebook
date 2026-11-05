import type { Item, Trip } from '../types';
import { DESTINATIONS, tripDestination } from '../lib/destinations';
import { md } from '../lib/time';
import { href } from '../lib/route';
import { DestinationArt } from './TravelArt';

export function DestinationHeader({ trip, items }: { trip: Trip; items: Item[] }) {
 const arrival = tripDestination(items, trip.id);
 const theme = arrival?.destination ? DESTINATIONS[arrival.destination] : undefined;
 return <header className="destination-header" data-destination={arrival?.destination || 'neutral'}>
  <div className="destination-heading">
   <a href={href('')}>‹ 所有旅程</a>
   <h1>{trip.name}</h1>
   <p className="num">{md(trip.start)} – {md(trip.end)} · {trip.people} 人</p>
   {theme && <p className="destination-caption"><span className="num">{arrival!.airport}</span> · {theme.name}</p>}
  </div>
  <DestinationArt destination={arrival?.destination}/>
  {theme && <span className="visually-hidden">目的地地標：{theme.landmarks}</span>}
 </header>;
}
