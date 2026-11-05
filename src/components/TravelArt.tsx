import type { ItemType } from '../types';
import type { Destination } from '../lib/destinations';

const GOLD = '#F2C14E', BLUE = '#8DB5D7', PALE = '#DCEAF5';
const line = { stroke: 'var(--ink)', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** Small decorative marks; the adjacent text provides the accessible label. */
export function EntryArt({ type, checkout = false }: { type: ItemType; checkout?: boolean }) {
 return <svg className="entry-art" aria-hidden="true" viewBox="0 0 48 48" fill="none" {...line}>
  {type === 'transit' && <><path d="M8 38h32M13 34l-3 8m25-8 3 8"/><rect x="11" y="7" width="26" height="29" rx="7" fill={PALE}/><path d="M14 23h20V13H14z" fill={BLUE}/><path d="M16 29h3m10 0h3"/><path d="M19 8V5h10v3"/><path d="M18 34h12" stroke={GOLD} strokeWidth="4"/></>}
  {type === 'hotel' && (checkout ? <><rect x="5" y="16" width="20" height="25" rx="3" fill={GOLD}/><path d="M11 16V9h9v7m-8 7v12m6-12v12m11-14h12v18H29m3-9h12m-5-5 5 5-5 5"/><circle cx="10" cy="44" r="1"/><circle cx="21" cy="44" r="1"/></> : <><path d="M5 43h38"/><path d="M10 43V12h28v31" fill={PALE}/><path d="M8 8h32v7H8z" fill={BLUE}/><path d="M21 43V32h7v11" fill="white"/>{[17,30].map(x=><path key={x} d={`M${x} 21v3m0 3v2`} stroke={GOLD} strokeWidth="4"/>)}</>)}
  {type === 'ticket' && <><path d="M7 12l28-6 4 18-28 6z" fill={BLUE}/><path d="M5 23h38v6a4 4 0 0 0 0 8v6H5v-6a4 4 0 0 0 0-8z" fill={GOLD}/><path d="M32 24v18" strokeDasharray="2 4"/><path d="m18 27 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="white" stroke="none"/></>}
  {type === 'place' && <><path d="M3 42h42"/><path d="M30 35v7m-3-7c-8-4-2-10 2-9 0-8 11-7 11 0 5 2 7 12-4 11" fill="#BDD3C1"/><path d="M27 16c0 9-11 20-11 20S5 25 5 16a11 11 0 0 1 22 0z" fill={GOLD}/><circle cx="16" cy="16" r="4" fill="white"/></>}
  {type === 'restaurant' && <><path d="M6 23h34c0 14-8 18-17 18S7 34 6 23z" fill={PALE}/><ellipse cx="23" cy="23" rx="17" ry="5" fill={GOLD}/><path d="M13 16c-5-4 5-5 0-10m11 9c-5-4 5-5 0-10m11 11c-5-4 5-5 0-10M29 43l17-5m-16 8 17-5"/></>}
  {type === 'car' && <><path d="m9 19 5-10h20l5 10" fill={PALE}/><rect x="5" y="19" width="38" height="17" rx="5" fill={GOLD}/><path d="M11 27h4m18 0h4M12 36v5m24-5v5M17 10v9m14-9v9"/></>}
  {type === 'other' && <><path d="m5 18 12-6 14 6 12-6v28l-12 5-14-6-12 6z" fill={PALE}/><path d="M17 12v27m14-21v27"/><path d="m12 28 10-4 10 8 7-5" stroke={GOLD} strokeWidth="3" strokeDasharray="3 4"/><circle cx="35" cy="10" r="6" fill={GOLD}/></>}
  {type === 'flight' && <path d="m5 25 15-5 5-15 5-1-2 16 14-2 3 4-17 5-7 15-4 1 3-15-12 2z" fill={GOLD}/>}
 </svg>;
}

export function FlightArt() {
 return <svg className="flight-card-art" aria-hidden="true" viewBox="0 0 80 110" fill="none">
  <path d="M-8 89c3-14 16-16 23-6 0-16 27-17 29-1 11-9 26-1 26 12H-8z" fill={PALE}/>
  <path d="M45 28c0-8 12-9 14-2 8-3 15 4 14 10H40c-3-5 0-9 5-8z" fill="white" opacity=".65"/>
  <g transform="translate(6 15) rotate(-19 34 34)"><path d="m2 37 26-6L39 8l7-1-5 24 23-1c9 0 10 7 0 10l-24 3-8 17-6 1 1-18-19 1z" fill="white"/><path d="m8 37 52-5c5 0 8 3 3 5L13 43z" fill={GOLD}/><path d="m7 38-6-9 5-1 9 8" fill={GOLD}/><path d="m52 31 8-1" stroke={BLUE} strokeWidth="3" strokeLinecap="round"/></g>
  <path d="M51 77c-2-8 12-13 16-3 9-2 14 6 12 11H47c-1-4 0-7 4-8z" fill="white"/>
  <path d="M0 101h80" stroke="white" strokeDasharray="3 5" opacity=".35"/>
 </svg>;
}

/** Destination vignettes share a fixed canvas so every header has the same layout. */
export function DestinationArt({ destination }: { destination?: Destination }) {
 return <svg className="destination-art" aria-hidden="true" viewBox="0 0 240 120" fill="none">
  <circle cx="183" cy="27" r="17" fill={GOLD}/>
  <path d="M0 120c20-34 39-40 62-20 21-35 53-40 77-10 31-15 50-12 69 5 12-15 24-14 32-2v27z" fill={BLUE} opacity=".45"/>
  {destination === 'japan' && <><path d="M12 120 112 30l108 90z" fill={BLUE}/><path d="m112 30-37 34 23-4 14 9 13-10 26 4z" fill="white"/><path d="m169 78 24-16 34-6" stroke="#9B7667" strokeWidth="4" strokeLinecap="round"/>{[[178,65],[198,53],[215,61],[229,45]].map(([x,y])=><g key={x} transform={`translate(${x} ${y})`} fill="#F5D6E0"><circle cx="-4" cy="-3" r="4"/><circle cx="4" cy="-3" r="4"/><circle cy="4" r="4"/><circle r="2" fill={GOLD}/></g>)}</>}
  {destination === 'korea' && <><path d="M63 111 69 45h6l5 66z" fill={PALE}/><path d="M72 45V9m-7 26h14v10H65z" stroke={PALE} strokeWidth="3"/><path d="M62 30h20v6H62z" fill={BLUE}/><path d="M122 84h86v32h-86z" fill={PALE}/><path d="M141 89h12v27h-12m35-27h12v27h-12" fill="#B67468"/><path d="M111 84c21-6 35-9 54-22 19 13 33 16 54 22z" fill={BLUE} stroke={PALE} strokeWidth="2"/><path d="M129 61c12-4 23-9 36-19 13 10 24 15 36 19z" fill={PALE}/><path d="M134 61h63v12h-63z" fill={BLUE}/></>}
  {destination === 'taiwan' && <><path d="M143 118V99h-6V82h-3V65h-3V49h4V34h5V21h13v13h5v15h4v16h-3v17h-3v17h-6v19z" fill={BLUE} stroke={PALE} strokeWidth="2"/><path d="M146 21V7m-9 44h22m-20 16h18m-15 16h13m-10 17h8" stroke={PALE} strokeWidth="2"/><path d="M184 111V94h34v17" fill={PALE}/><path d="M176 95c11-3 18-8 25-17 7 9 14 14 25 17z" fill="#BD776F"/><path d="M196 98v16m12-16v16" stroke="#BD776F" strokeWidth="3"/></>}
  {destination === 'singapore' && <><path d="m59 112 5-63h16l4 63m17 0 4-63h16l4 63m17 0 4-63h16l4 63" fill={BLUE} stroke={PALE} strokeWidth="2"/><path d="M54 47c19 5 85 5 116-3l4-8c-38 9-90 9-119 2z" fill={PALE}/>{[70,111,152].map(x=><path key={x} d={`M${x} 61v40`} stroke={GOLD} strokeWidth="3" strokeDasharray="3 4"/>)}<path d="M199 111c14-5 15-13 5-23 4-2 5-6 3-10l5-7-5-5c-11-2-16 5-15 15l-8 4 7 5-2 6c-5 4-6 10-5 15z" fill={PALE}/><path d="M190 82c-14-8-17-4-17 10" stroke={PALE} strokeWidth="2"/><path d="M23 116q14-6 28 0t28 0t28 0t28 0t28 0t28 0t28 0" stroke={BLUE} strokeWidth="3"/></>}
  {destination === 'hongkong' && <><path d="M45 109V66h18v43m9 0V43h20v66m13 0V25l21 19v65m10 0V57h16v52m12 0V70h21v39m13 0V49h15v60" fill={BLUE} stroke={PALE} strokeWidth="1.5"/><path d="m105 25 21 38-21 46m0-54 21-11m-11-10V10" stroke={PALE} strokeWidth="2"/><path d="M151 91h60l-9 12h-42z" fill={GOLD}/><path d="M181 91V57l-24 28zm4 0V65l21 23z" fill="#D99A87"/><path d="M16 115q17-5 34 0t34 0t34 0t34 0t34 0t34 0" stroke={PALE} strokeWidth="2"/></>}
  {destination === 'malaysia' && <><g fill={BLUE} stroke={PALE} strokeWidth="2">{[88,139].map(x=><path key={x} d={`M${x} 119V63h-4V48h4V34h5V22h6v12h5v14h4v15h-4v56z`}/>)}</g><path d="M96 22V8m51 14V8m-47 70h44v7h-44M89 48h15m36 0h15M89 63h15m36 0h15m-51 34h36" stroke={PALE} strokeWidth="3"/><path d="m202 117-3-35m0 0c-17-18-28-7-26-2 10-5 18-4 26 2zm0 0c7-24 23-20 26-10-12-3-19 1-26 10zm0 0c14-3 23 4 23 12-11-11-17-12-23-12z" stroke="#B9D3BD" strokeWidth="3" strokeLinecap="round"/></>}
  {!destination && <><path d="M23 95c26-38 51 7 84-25s58-8 102-24" stroke={PALE} strokeWidth="2" strokeDasharray="5 6"/><path d="m134 65 26-9 12-24 7-2-5 25 27-4 5 6-33 8-12 23-6 2 4-24-21 5z" fill="white"/><circle cx="50" cy="85" r="4" fill={GOLD}/></>}
 </svg>;
}
