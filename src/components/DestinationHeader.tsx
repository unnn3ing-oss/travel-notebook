import type { Item, Trip } from '../types';
import { DESTINATIONS, tripDestination } from '../lib/destinations';
import { md } from '../lib/time';
import { href } from '../lib/route';
import { DestinationArt } from './TravelArt';
import { DAY_PERIOD_LABEL, type DayPeriod } from '../lib/dayPeriod';

export function DestinationHeader({ trip, items, period }: { trip: Trip; items: Item[]; period: DayPeriod }) {
 const arrival = tripDestination(items, trip.id);
 const theme = arrival?.destination ? DESTINATIONS[arrival.destination] : undefined;
 return <header className="destination-header" data-destination={arrival?.destination || 'neutral'} data-day-period={period}>
  <div className="destination-heading">
   <a href={href('')}>‹ 所有旅程</a>
   <h1>{trip.name}</h1>
   <p className="num">{md(trip.start)} – {md(trip.end)} · {trip.people} 人</p>
   {theme && <p className="destination-caption"><span className="num">{arrival!.airport}</span> · {theme.name}</p>}
  </div>
  <DestinationArt destination={arrival?.destination} period={period}/>
  <span className="visually-hidden">地標背景：{DAY_PERIOD_LABEL[period]}</span>
  {theme && <span className="visually-hidden">目的地地標：{theme.landmarks}</span>}
 </header>;
}
