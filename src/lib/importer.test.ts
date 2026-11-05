import { describe, expect, it } from 'vitest';
import { parseImport } from './importer';

const days = ['2026-11-20', '2026-11-21'];
describe('parseImport', () => {
  it('reads a fenced JSON block, maps train to transit, flags duplicates and out-of-range dates', () => {
    const raw = 'AI 說：\n```json\n' + JSON.stringify({ items: [
      { date: '2026-11-21', start: '15:00', type: 'ticket', title: '嵐山 小火車', orderNo: 'A1' },
      { date: '2026-11-20', start: '10:16', type: 'train', title: 'Haruka' },
      { date: '2026-12-01', type: 'hotel', title: '延住' },
      { date: 'tomorrow', title: '沒日期' },
    ] }) + '\n```';
    const r = parseImport(raw, days, { '2026-11-21': ['嵐山小火車'] });
    if ('error' in r) throw new Error(r.error);
    expect(r.skipped).toBe(1);
    expect(r.rows[0]).toMatchObject({ checked: false, flag: '這天已有同名卡片，預設不加入', orderNumber: 'A1' });
    expect(r.rows[1]).toMatchObject({ type: 'transit', target: '2026-11-20', checked: true });
    expect(r.rows[2]).toMatchObject({ target: null, flag: '日期不在旅程內，會放到未排程' });
  });
  it('explains bad input', () => {
    expect(parseImport('', days, {})).toEqual({ error: '還沒有貼上內容。' });
    expect(parseImport('hello', days, {})).toEqual({ error: '看不懂這段內容。請 AI 照提示詞的格式只回傳 JSON，再貼一次。' });
    expect(parseImport('{"a":1}', days, {})).toEqual({ error: '內容裡找不到 items 清單，請確認是用這份提示詞產生的。' });
  });
});
