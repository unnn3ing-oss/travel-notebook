import type { Item, Route } from '../types';
import { formatTerminal } from '../lib/terminal';
import { BookingPill } from './ui';
import { EntryArt, FlightArt } from './TravelArt';

const LABELS = { flight:'航班',transit:'交通',hotel:'住宿',ticket:'門票',restaurant:'餐廳',place:'景點',car:'租車',other:'其他' };
const MODES: Record<string, string> = { walk:'步行',train:'電車',subway:'地鐵',tram:'路面電車',bus:'巴士',car:'計程車',ferry:'渡輪',rental:'租車',plane:'飛機' };
function summary(item: Item, routes: Route[]) {
 if (item.type === 'transit') {
  const route = routes.find(r => r.itemId === item.id && r.primary) || routes.find(r => r.itemId === item.id);
  if (route) return `${MODES[route.mode] || '交通'}${route.name ? ' · ' + route.name : ''} · 約 ${route.minutes} 分`;
 }
 if (item.hotel) return [item.hotel.name, item.hotel.checkinTime && '入住 ' + item.hotel.checkinTime].filter(Boolean).join(' · ');
 if (item.linkedStayId) return [item.start && item.start + ' 前', '退房'].filter(Boolean).join(' · ');
 if (item.ticket) return [item.ticket.venue, item.ticket.time && item.ticket.time + ' 入場'].filter(Boolean).join(' · ') || '門票';
 return [LABELS[item.type], item.address, item.price].filter(Boolean).join(' · ');
}

/** Content only: list/timeline/board retain ownership of click and drag behavior. */
export function ItineraryCard({ item, routes = [], compact = false, showTime = false }: { item: Item; routes?: Route[]; compact?: boolean; showTime?: boolean }) {
 const flight = item.flight;
 const from = flight?.from || item.from;
 const to = flight?.to || item.to;
 const bookingClass = item.booking ? ' has-booking' : '';
 const booking = item.booking && <span className="itinerary-status"><BookingPill status={item.booking}/></span>;
 if (item.type === 'flight') return <span className={'itinerary-ticket' + (compact ? ' is-compact' : '') + bookingClass}>
  {booking}
  <span className="itinerary-ticket-stub"><FlightArt/></span>
  <span className="itinerary-ticket-body">
   <span className="itinerary-card-heading"><strong className="itinerary-title">{item.title}</strong></span>
   {(from || to) && <strong className="itinerary-flight-route num">{from || '—'} <span>→</span> {to || '—'}</strong>}
   <span className="itinerary-subtitle num">{[flight && [flight.airline,flight.flightNo].filter(Boolean).join(' '), flight && [formatTerminal(flight.fromTerminal), formatTerminal(flight.toTerminal)].filter(Boolean).join(' → ')].filter(Boolean).join(' · ') || '航班資訊待補'}</span>
   {showTime && <span className="itinerary-subtitle num">{[flight?.departureTime || item.start, flight?.arrivalTime || item.end].filter(Boolean).join(' – ') || '時間未定'}</span>}
  </span>
 </span>;
 return <span className={'itinerary-small-card' + (compact ? ' is-compact' : '') + ' type-' + item.type + bookingClass}>
  {booking}
  <span className="itinerary-small-art"><EntryArt type={item.type} checkout={!!item.linkedStayId}/></span>
  <span className="itinerary-small-body">
   <span className="itinerary-card-heading"><strong className="itinerary-title">{item.title}</strong></span>
   <span className="itinerary-subtitle">{summary(item,routes)}</span>
   {showTime && <span className="itinerary-subtitle num">{item.start || '時間未定'}{item.end && item.end!==item.start && ' – ' + item.end}</span>}
  </span>
 </span>;
}
