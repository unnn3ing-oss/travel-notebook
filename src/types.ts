export type ItemType = 'place' | 'restaurant' | 'transit' | 'hotel' | 'flight' | 'ticket' | 'car' | 'other';
/** 還沒訂 / 已訂購（付款了，還沒收到確認信）/ 訂單確認 */
export type BookingStatus = 'none' | 'ordered' | 'confirmed';
export type Mode = 'walk' | 'train' | 'bus' | 'car' | 'ferry' | 'plane';

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
  orderNumber?: string;
  cost?: number;
  cancelBefore?: string;
  /** 費用（自由輸入，例如 ¥48,000） */
  price?: string;
  /** 取消期限前提醒，預設開 */
  cancelRemind?: boolean;
  // transit cards
  from?: string;
  to?: string;
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
  legs: { mode: Mode; label: string; minutes: number }[];
  departures: { dep: string; arr: string; info: string }[];
  fare: number | null; // per person, local currency
  booking?: BookingStatus;
  primary: boolean;
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
