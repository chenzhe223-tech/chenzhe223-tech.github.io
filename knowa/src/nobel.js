// Nobel Prize API v2.1: deterministic count of people whose current-country
// birthplace is Japan, NOT a count of Japanese citizens or nationalities.
const ENDPOINT = 'https://api.nobelprize.org/2.1/laureates';
const PAGE_SIZE = 500;
const MAX_PAGES = 6;
const value = (obj) => typeof obj === 'string' ? obj : (obj?.zh || obj?.en || obj?.se || '');
const safeText = (x) => String(x ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const oneYear = (x) => /^\d{4}$/.test(String(x || '')) ? String(x) : '未知年份';
const inJapanNow = (x) => /^(japan|日本)$/i.test(safeText(value(x)));
export const isJapanNobelQuestion = q => /(?:诺贝尔|nobel)/i.test(q) && /(?:日本|japan)/i.test(q) && /(?:多少|几位|人数|人数|获得者|得主|年份|名单|原因|理由|谁)/.test(q);

export const isJapanBirthplaceNobelQuestion = q => isJapanNobelQuestion(q) && /(?:出生|生于|出生地|诞生|出生在|出生于|境内出生)/.test(q);

export async function fetchJapanBornNobel(fetchJSON) {
  const rows = [];
  let total = null;
  const seen = new Set();
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), format: 'json'}).toString();
    const body = await fetchJSON(url.toString());
    const count = Number(body?.meta?.count);
    if (!Number.isSafeInteger(count) || count <= 0 || count > MAX_PAGES * PAGE_SIZE || !Array.isArray(body?.laureates)) throw new Error('Nobel API 没有返回可信的总数或数据结构');
    if (total === null) total = count;
    if (total !== count) throw new Error('Nobel API 翻页期间总数变更');
    if (body.meta?.offset !== undefined && Number(body.meta.offset) !== page * PAGE_SIZE) throw new Error('Nobel API 页码不一致');
    const batch = body.laureates;
    if (batch.length > PAGE_SIZE || batch.length !== Math.min(PAGE_SIZE, total - page * PAGE_SIZE)) throw new Error('Nobel API 返回不完整的分页');
    for (const x of batch) {
      const id = String(x?.id ?? '');
      if (!id || seen.has(id)) throw new Error('Nobel API 奖项数据重复或缺少 ID');
      seen.add(id);
      // We fetch ALL laureates because the API query does not support birthCountryNow.
      // A missing countryNow is excluded from the explicit modern-birthplace count.
      rows.push(x);
    }
    if (rows.length === total) break;
    if (rows.length > total || batch.length < PAGE_SIZE) throw new Error('Nobel API 分页覆盖不完整');
  }
  if (rows.length !== total) throw new Error('Nobel API 分页未能完整获取');
  const japan = rows.filter(x => inJapanNow(x?.birth?.place?.countryNow));
  if (!japan.length) throw new Error('Nobel API 未返回可验证的日本出生地记录');
  const details = japan.flatMap(x => {
    const name = safeText(value(x.knownName) || [value(x.givenName), value(x.familyName)].filter(Boolean).join(' ')) || `ID ${x.id}`;
    return (x.nobelPrizes || []).map(prize => ({
      laureateId: String(x.id), name, year: oneYear(prize.awardYear),
      category: safeText(value(prize.categoryFullName) || value(prize.category) || '未知类别'),
      motivation: safeText(value(prize.motivation) || '官方未提供获奖理由'),
      url: `https://www.nobelprize.org/laureate/${encodeURIComponent(String(x.id))}`
    }));
  }).sort((a,b)=>Number(b.year)-Number(a.year)||a.name.localeCompare(b.name));
  return {count: japan.length, scanned: rows.length, details, sourceUrl: 'https://www.nobelprize.org/laureates/', apiUrl: ENDPOINT, definition: '出生地按 NobelPrize.org 的现今国家字段（birth.place.countryNow=Japan）分类，按获奖者 ID 去重；不是日本国籍、华裔/日裔身份或日本机构获奖者人数。'};
}
