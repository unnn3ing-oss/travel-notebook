export type ItemType = 'place' | 'restaurant' | 'transit' | 'hotel' | 'flight' | 'ticket' | 'car' | 'other';
/** 還沒訂 / 已訂購（付款了，還沒收到確認信）/ 訂單確認 */
export type BookingStatus = 'none' | 'ordered' | 'confirmed';
export type Mode = 'walk' | 'train' | 'bus' | 'car' | 'ferry' | 'rental' | 'plane' | 'subway' | 'tram';

export interface Trip {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  people: number;
  currency: string;
  timezone?: string;
}

export interface Alternative { name: string; status: BookingStatus; note?: string; cancelBefore?: string }

export interface Item {
  id: string;
  tripId: string;
  date: string | null; // null = 還沒排
  start: string; // HH:MM or ''
  end: string;
  title: string;
  type: ItemType;
  /** only for things that need booking */
  booking?: BookingStatus;
  alts?: Alternative[];
  /** set after 改用備案, so it can be undone */
  replaced?: { title: string; booking?: BookingStatus; reason: string };
  watch?: { text: string; done: boolean }[];
  note?: string;
  /** 喜歡／想去／想看／必去 */
  tags?: string[];
  hours?: string;
  url?: string;
  /** 建議停留（分鐘） */
  stay?: number;
  order?: number;
  address?: string;
  orderNumber?: string;
  cost?: number;
  cancelBefore?: string;
  /** 費用（自由輸入，例如 ¥48,000） */
  price?: string;
  /** 取消期限前提醒，預設開 */
  cancelRemind?: boolean;
  imported?: boolean;
  missingFields?: string[];
  originalDate?: string;
  flight?: FlightDetails;
  hotel?: HotelDetails;
  ticket?: TicketDetails;
  linkedStayId?: string;
  cancelLead?: number;
  // transit cards
  from?: string;
  to?: string;
}

/** 某一段的一個班次（HH:mm，同一天、不跨午夜） */
export interface LegTime { dep: string; arr: string; info?: string }
export interface Leg {
  mode: Mode;
  label: string;
  minutes: number;
  fare?: number;
  place?: string;
  /** 這一段預計的發車／抵達時間；沒填代表只知道所需分鐘 */
  dep?: string;
  arr?: string;
  /** 錯過主班次時的備案班次 */
  alts?: LegTime[];
}

export interface Route {
  id: string;
  itemId: string;
  name: string;
  mode: Mode;
  minutes: number;
  /** minutes to reach the boarding place */
  walk: number;
  /** where you board; '' when unknown */
  place: string;
  legs: Leg[];
  departures: { dep: string; arr: string; info: string }[];
  fare: number | null; // per person, local currency
  booking?: BookingStatus;
  primary: boolean;
  /** 付款方式，例如 IC 卡 */
  pay?: string;
  /** 訂票資訊（有 booking 時才顯示） */
  ticket?: { ref?: string; company?: string; pickup?: string; phone?: string; cancel?: string };
  /** 不用訂票時的說明 */
  noBookNote?: string;
}

export interface Task {
  id: string;
  tripId: string;
  group: string;
  title: string;
  daysBefore: number;
  done: boolean;
}

export interface Expense { id: string; tripId: string; date: string; title: string; amount: number }
export interface Document { id: string; tripId: string; name: string; file: Blob; itemId?: string }
export interface TripDetails { id: string; address: string; rate: number; contacts: string[]; hotelName?: string; hotelPhone?: string; policy?: string }

/** Details captured by the dedicated design forms; existing cards remain valid. */
export interface FlightDetails {
  airline: string; flightNo: string; from: string; fromTerminal: string;
  departureDate: string; departureTime: string; departureZone: string;
  to: string; toTerminal: string; arrivalDate: string; arrivalTime: string; arrivalZone: string;
  reference: string; seat: string; cabin: string; bags: number; bagKg: number; carryKg: number;
  checkinMinutes: number; remind: boolean; price: string; rules: string;
}
export interface HotelDetails {
  name: string; checkinDate: string; checkoutDate: string; checkinTime: string; checkoutTime: string;
  address: string; phone: string; reference: string; room: string; guests: number; breakfast: boolean;
  total: string; payment: string; cancelBy: string; remind: boolean; note: string; checkoutId?: string;
}
export interface TicketDetails {
  name: string; venue: string; date: string; time: string; early: number;
  kinds: { label: string; price: number; quantity: number }[];
  pickup: 'qr' | 'counter' | 'voucher'; place: string; reference: string;
}
