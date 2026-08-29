/**
 * 성무일과 성서정과 매칭 — 기도서 484~524쪽 표를 날짜에 연결한다.
 *
 * ⚠ 이 엔진은 아침기도·저녁기도에만 쓰인다. 낮기도·밤기도는 기도서 구조상
 *   날짜별 전례독서를 따르지 않는 고정/선택형 예식이다(OfficeDoc.lectionaryLinked).
 */
import type { ChurchDay } from './churchCalendar'
import { addDays, ascensionDay, baptismOfTheLord, isoDate, parseIso, pentecost, trinitySunday } from './churchCalendar'
import type { LectionaryDay, ReadingSet, ReadingYear } from './types'

/* ─────────────────────────  시편 지정 파싱  ───────────────────────── */

export interface PsalmSpec {
  /** 시편 번호 */
  number: number
  /** '105-112'처럼 절 범위가 지정된 경우 */
  verses?: string
  /** 대괄호로 묶여 생략 가능한 시편 */
  optional?: boolean
  /** '또는'으로 이어진 대체 시편 */
  alternative?: boolean
}

/** '50[59, 60]', '119:105-112', '113, 114, 또는 118' 등을 해석한다. */
export function parsePsalmSpec(raw?: string | null): PsalmSpec[] {
  if (!raw) return []
  const out: PsalmSpec[] = []
  let optional = false
  let alternative = false
  const re = /또는|\[|\]|(\d+)(?::([\d\-,\s–]+?))?(?=\s*(?:,|\[|\]|또는|$))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const tok = m[0]
    if (tok === '[') { optional = true; continue }
    if (tok === ']') { optional = false; continue }
    if (tok === '또는') { alternative = true; continue }
    const spec: PsalmSpec = { number: Number(m[1]) }
    if (m[2]) spec.verses = m[2].trim().replace(/\s+/g, '')
    if (optional) spec.optional = true
    if (alternative) spec.alternative = true
    out.push(spec)
  }
  return out
}

/* ─────────────────────────  조회 색인  ───────────────────────── */

export interface LectionaryIndex {
  byKey: Map<string, LectionaryDay>
  byDate: Map<string, LectionaryDay>
  byLabel: Map<string, LectionaryDay>
  all: LectionaryDay[]
}

const key = (season: string, week: number | null | undefined, weekday: number) =>
  `${season}|${week ?? '-'}|${weekday}`

export function buildIndex(days: LectionaryDay[]): LectionaryIndex {
  const byKey = new Map<string, LectionaryDay>()
  const byDate = new Map<string, LectionaryDay>()
  const byLabel = new Map<string, LectionaryDay>()
  for (const d of days) {
    byLabel.set(d.label, d)
    if (d.season && d.weekday !== undefined) {
      const k = key(d.season, d.week, d.weekday)
      if (!byKey.has(k)) byKey.set(k, d)
    }
    if (d.kind === 'date' && d.month && d.day) {
      byDate.set(`${d.month}-${d.day}`, d)
    }
  }
  return { byKey, byDate, byLabel, all: days }
}

/* ─────────────────────────  날짜 → 정과  ───────────────────────── */

export interface OfficeLectionary {
  day: LectionaryDay
  /** 어떤 규칙으로 찾았는지 (날짜 지정 / 절기·요일 / 특별일) */
  matchedBy: 'date' | 'special' | 'season' | 'label'
  year: ReadingYear
  readings: ReadingSet
  morningPsalms: PsalmSpec[]
  eveningPsalms: PsalmSpec[]
  /** 저녁기도에 쓰는 전일(前日) 정과. 성탄 전일·공현일 전일 등. */
  eve?: LectionaryDay
  /** 아침/저녁 독서가 따로 지정된 날(고난주일·부활주일) */
  offices?: LectionaryDay['offices']
  alternates?: string[]
}

/** 기도서 484쪽: 12월 17일~1월 12일은 요일이 아니라 날짜로 지정된다. */
export function isDateRuleWindow(month: number, day: number): boolean {
  return (month === 12 && day >= 17) || (month === 1 && day <= 12)
}

/** ChurchDay의 절기·주차를 성서정과 표의 색인 키로 옮긴다. */
function seasonKeyOf(day: ChurchDay): string | null {
  switch (day.season) {
    case 'advent':
      return key('advent', day.week, day.weekday)
    case 'christmas':
      return day.week ? key('christmas', day.week, day.weekday) : null
    case 'lent':
      // 재의 수요일 다음 목~토는 표에서 '재의 수요일' 묶음(week 0)에 들어 있다
      return key('lent', day.week ?? 0, day.weekday)
    case 'holyweek':
      return key('holyweek', 1, day.weekday)
    case 'easter':
      return key('easter', day.week, day.weekday)
    case 'ordinary':
      return key('ordinary', day.week, day.weekday)
    default:
      return null
  }
}

/** 그날 저녁기도에 쓰는 전일(前日) 정과가 있으면 돌려준다. */
function eveOf(day: ChurchDay, idx: LectionaryIndex): LectionaryDay | undefined {
  const d = parseIso(day.date)
  const y = d.getUTCFullYear()
  const tomorrow = isoDate(addDays(d, 1))
  const pick = (label: string) => idx.byLabel.get(label)
  if (day.date.endsWith('-12-24')) return pick('성탄전일')
  if (day.date.endsWith('-01-05')) return pick('공현일 전일')
  if (tomorrow === isoDate(baptismOfTheLord(y))) return pick('주의 세례 전일')
  if (tomorrow === isoDate(ascensionDay(y))) return pick('승천일 전일')
  if (tomorrow === isoDate(pentecost(y))) return pick('강림 전일')
  if (tomorrow === isoDate(trinitySunday(y))) return pick('성삼 전일')
  return undefined
}

/**
 * 그날의 성무일과 성서정과를 찾는다.
 * @param day  교회력 정보(describeDay 결과)
 * @param idx  buildIndex로 만든 색인
 */
export function resolveLectionary(day: ChurchDay, idx: LectionaryIndex): OfficeLectionary | null {
  const d = parseIso(day.date)
  const month = d.getUTCMonth() + 1
  const date = d.getUTCDate()
  let found: LectionaryDay | undefined
  let matchedBy: OfficeLectionary['matchedBy'] = 'season'

  // 1) 이동축일 중 표에 고유 항목이 있는 날
  const namedMovable: Array<[boolean, string]> = [
    [day.name === '재의 수요일', '재의 수요일'],
    [day.name === '승천일', '승천일'],
    [day.name === '성령강림주일', '성령강림주일'],
    [day.name.includes('삼위일체주일'), '삼위일체주일'],
  ]
  for (const [cond, label] of namedMovable) {
    if (cond && idx.byLabel.has(label)) {
      found = idx.byLabel.get(label)
      matchedBy = 'special'
      break
    }
  }

  // 2) 날짜 지정 구간 (12/17 ~ 1/12)
  if (!found && isDateRuleWindow(month, date)) {
    const fixed: Record<string, string> = { '12-25': '성탄일', '1-1': '거룩한 이름 예수(1월 1일)', '1-6': '공현일' }
    const label = fixed[`${month}-${date}`]
    found = label ? idx.byLabel.get(label) : idx.byDate.get(`${month}-${date}`)
    if (found) matchedBy = label ? 'special' : 'date'
  }

  // 3) 절기·주차·요일
  if (!found) {
    const k = seasonKeyOf(day)
    if (k) found = idx.byKey.get(k)
  }

  // 4) 승천일 다음 금·토처럼 표가 별도 이름으로 묶어 둔 경우
  if (!found && day.season === 'easter' && day.week === 6 && day.weekday >= 5) {
    found = idx.byLabel.get(`승천일 ${day.weekdayName}`)
    if (found) matchedBy = 'label'
  }

  if (!found) return null

  const year: ReadingYear = found.readings['both'] ? 'both' : (String(day.weekdayCycle) as ReadingYear)
  return {
    day: found,
    matchedBy,
    year,
    readings: found.readings[year] ?? found.readings['1'] ?? {},
    // 성탄주간 축일처럼 아침/저녁 시편이 따로 지정된 날은 그쪽을 쓴다
    morningPsalms: parsePsalmSpec(found.psalms?.morning ?? found.offices?.morning?.psalms),
    eveningPsalms: parsePsalmSpec(
      found.psalms?.evening ?? found.offices?.evening?.psalms ?? found.psalms?.morning),
    eve: eveOf(day, idx),
    offices: found.offices,
    alternates: found.alternates,
  }
}
