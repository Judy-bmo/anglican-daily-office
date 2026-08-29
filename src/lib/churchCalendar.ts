/**
 * 교회력 계산 엔진 — 「대한성공회 기도서」(2004) 26~31쪽 규정 구현.
 *
 * 원문 규칙 요약
 *  · 대림 1주일 = 성탄일 전 네 번째 주일 (= 성 안드레축일 11/30에 가장 가까운 주일)
 *  · 성탄절기 = 성탄일 ~ 공현일(1/6) 후 첫 주일(= 연중 1주일) 전날
 *  · 사순절 = 부활주일에서 주일을 뺀 평일 40일 전 수요일(재의 수요일)부터
 *  · 부활절기 = 부활주일 ~ 성령강림주일, 승천일 = 부활 후 40일째 목요일
 *  · 연중시기 = 주의 세례주일(연중 1주일) ~ 재의 수요일 전일,
 *               성령강림주일 다음 ~ 대림 1주일 전일, 왕이신 그리스도주일이 연중 34주일
 *
 * 날짜는 표준시 문제를 피하려고 모두 UTC 자정 기준 Date로 다룬다.
 */

export type SeasonId = 'advent' | 'christmas' | 'lent' | 'holyweek' | 'easter' | 'ordinary'
export type LiturgicalColor = 'white' | 'red' | 'violet' | 'green' | 'rose' | 'blue' | 'black'
export type SundayCycle = '가' | '나' | '다'
export type WeekdayCycle = 1 | 2

export const SEASON_NAMES: Record<SeasonId, string> = {
  advent: '대림절',
  christmas: '성탄절',
  lent: '사순절',
  holyweek: '성주간',
  easter: '부활절',
  ordinary: '연중시기',
}

export const COLOR_NAMES: Record<LiturgicalColor, string> = {
  white: '백색',
  red: '홍색',
  violet: '자색',
  green: '녹색',
  rose: '장미색',
  blue: '청색',
  black: '흑색',
}

export const WEEKDAY_NAMES = ['주일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/* ─────────────────────────  날짜 유틸  ───────────────────────── */

/** 연·월·일로 UTC 자정 Date를 만든다. month는 1~12. */
export function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

/** 자정 정규화 — 지역 시간대의 Date를 같은 달력 날짜의 UTC Date로 옮긴다. */
export function toUtcDay(d: Date): Date {
  return utc(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseIso(s: string): Date {
  const [y, m, day] = s.split('-').map(Number)
  return utc(y, m, day)
}

/** 0=주일 … 6=토요일 */
export function dayOfWeek(d: Date): number {
  return d.getUTCDay()
}

/** d와 같거나 그 이전의 가장 가까운 주일 */
export function sundayOnOrBefore(d: Date): Date {
  return addDays(d, -dayOfWeek(d))
}

/** d 이후(당일 제외)의 첫 주일 */
export function nextSunday(d: Date): Date {
  return addDays(d, 7 - dayOfWeek(d))
}

/* ─────────────────────────  이동축일  ───────────────────────── */

/**
 * 부활주일 — 그레고리력 Computus (Meeus/Butcher 익명 그레고리 알고리즘).
 * 결과는 반드시 3월 22일 ~ 4월 25일 사이에 든다(기도서 26쪽).
 */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return utc(year, month, day)
}

/** 재의 수요일 = 부활주일 46일 전 (주일 6번을 뺀 평일 40일) */
export const ashWednesday = (year: number) => addDays(easterSunday(year), -46)
/** 고난주일(성지주일) = 부활 7일 전 */
export const palmSunday = (year: number) => addDays(easterSunday(year), -7)
/** 승천일 = 부활 후 40일째 목요일 */
export const ascensionDay = (year: number) => addDays(easterSunday(year), 39)
/** 성령강림주일 = 부활 후 50일째 주일 */
export const pentecost = (year: number) => addDays(easterSunday(year), 49)
/** 삼위일체주일 = 성령강림 다음 주일 */
export const trinitySunday = (year: number) => addDays(easterSunday(year), 56)
/** 그리스도의 성체일 = 삼위일체주일 후 첫 목요일 */
export const corpusChristi = (year: number) => addDays(easterSunday(year), 60)

/**
 * 대림 1주일 = 성탄일 전 네 번째 주일.
 * 12월 24일과 같거나 그 이전의 마지막 주일(= 대림 4주일)에서 3주를 뺀다.
 * 이는 "성 안드레축일(11/30)에 가장 가까운 주일"과 언제나 같은 날이 된다.
 */
export function adventSunday(year: number): Date {
  return addDays(sundayOnOrBefore(utc(year, 12, 24)), -21)
}

export const christmas = (year: number) => utc(year, 12, 25)
export const epiphany = (year: number) => utc(year, 1, 6)
/** 주의 세례주일(= 연중 1주일) = 공현일 후 첫 주일 */
export const baptismOfTheLord = (year: number) => nextSunday(epiphany(year))
/** 왕이신 그리스도주일(= 연중 34주일) = 대림 1주일 전 주일 */
export const christTheKing = (year: number) => addDays(adventSunday(year), -7)

/* ─────────────────────  교회력 연도와 독서 주기  ───────────────────── */

/** 그 날짜가 속한 교회력 연도의 시작 연도(= 대림 1주일이 든 해). */
export function liturgicalYearStart(date: Date): number {
  const y = date.getUTCFullYear()
  return date >= adventSunday(y) ? y : y - 1
}

/**
 * 주일 독서 3년 주기(가/나/다해).
 * 기준: 2004년 대림절부터 가해. `(대림절 시작 연도 − 2004) mod 3`.
 */
export function sundayCycleOf(startYear: number): SundayCycle {
  return (['가', '나', '다'] as const)[(((startYear - 2004) % 3) + 3) % 3]
}

/**
 * 성무일과 평일 독서 2년 주기(1해/2해).
 * 기도서 484쪽: "홀수해(1)는 대림 1주일이 시작되는 해의 끝자리가 짝수인 경우 사용하고,
 * 짝수해(2)는 대림 1주일이 시작하는 해의 끝자리가 홀수인 해에 사용한다."
 */
export function weekdayCycleOf(startYear: number): WeekdayCycle {
  return startYear % 2 === 0 ? 1 : 2
}

/* ─────────────────────────  절기 판정  ───────────────────────── */

export interface ChurchDay {
  /** YYYY-MM-DD */
  date: string
  /** 교회력 연도 시작 연도(대림 1주일이 든 해) */
  liturgicalYearStart: number
  sundayCycle: SundayCycle
  weekdayCycle: WeekdayCycle
  season: SeasonId
  seasonName: string
  /** 절기 내 주차. 연중시기는 1~34, 대림 1~4, 사순 1~5, 부활 1~7. 성주간은 undefined. */
  week?: number
  /** 0=주일 … 6=토요일 */
  weekday: number
  weekdayName: string
  /** 사람이 읽는 이름. 예) "연중 21주 토요일", "대림 1주일" */
  name: string
  color: LiturgicalColor
  colorName: string
  /** 장미색 등 대체 가능한 색이 있으면 알려준다. */
  alternateColor?: LiturgicalColor
  isSunday: boolean
  /** 그날에 해당하는 이동축일 이름 (있으면) */
  principalFeast?: string
}

/** 그 해 교회력의 주요 기준일들 */
function anchors(startYear: number) {
  const nextYear = startYear + 1
  return {
    advent1: adventSunday(startYear),
    christmasDay: christmas(startYear),
    epiphanyDay: epiphany(nextYear),
    baptism: baptismOfTheLord(nextYear),
    ash: ashWednesday(nextYear),
    palm: palmSunday(nextYear),
    easter: easterSunday(nextYear),
    ascension: ascensionDay(nextYear),
    pentecostDay: pentecost(nextYear),
    trinity: trinitySunday(nextYear),
    ctk: christTheKing(nextYear),
    nextAdvent1: adventSunday(nextYear),
  }
}

/** 연중 주차 — 앞부분은 주의 세례주일부터 세고, 뒷부분은 왕이신 그리스도주일(34)에서 거꾸로 센다. */
function ordinaryWeek(date: Date, a: ReturnType<typeof anchors>): number {
  if (date < a.ash) {
    return Math.floor(diffDays(date, a.baptism) / 7) + 1
  }
  const weekSunday = sundayOnOrBefore(date)
  return 34 - Math.floor(diffDays(a.ctk, weekSunday) / 7)
}

const MOVABLE_FEASTS: Array<[keyof ReturnType<typeof anchors>, string]> = [
  ['easter', '부활주일'],
  ['ascension', '승천일'],
  ['pentecostDay', '성령강림주일'],
  ['trinity', '삼위일체주일'],
  ['ctk', '왕이신 그리스도주일'],
  ['baptism', '주의 세례'],
  ['palm', '고난주일(성지주일)'],
  ['ash', '재의 수요일'],
  ['epiphanyDay', '공현일'],
  ['christmasDay', '성탄일'],
]

/**
 * 한 날짜의 교회력 정보를 계산한다.
 * @param input Date(지역시) 또는 'YYYY-MM-DD' 문자열
 */
export function describeDay(input: Date | string): ChurchDay {
  const date = typeof input === 'string' ? parseIso(input) : toUtcDay(input)
  const startYear = liturgicalYearStart(date)
  const a = anchors(startYear)
  const weekday = dayOfWeek(date)
  const isSunday = weekday === 0

  let season: SeasonId
  let week: number | undefined
  let color: LiturgicalColor
  let alternateColor: LiturgicalColor | undefined
  let name: string

  if (date < a.christmasDay) {
    season = 'advent'
    week = Math.floor(diffDays(date, a.advent1) / 7) + 1
    color = 'violet'
    if (week === 3) alternateColor = 'rose'
    name = `대림 ${week}주${isSunday ? '일' : ' ' + WEEKDAY_NAMES[weekday]}`
  } else if (date < a.baptism) {
    season = 'christmas'
    // 성탄일이 든 주간부터 성탄 1주, 그다음 주일이 성탄 2주일
    const firstSunday = nextSunday(a.christmasDay)
    week = date < firstSunday ? undefined : Math.floor(diffDays(date, firstSunday) / 7) + 1
    color = 'white'
    name = week ? `성탄 ${week}주${isSunday ? '일' : ' ' + WEEKDAY_NAMES[weekday]}` : '성탄주간'
    if (isoDate(date) === isoDate(a.christmasDay)) name = '성탄일'
    if (isoDate(date) === isoDate(a.epiphanyDay)) name = '공현일'
  } else if (date < a.ash) {
    season = 'ordinary'
    week = ordinaryWeek(date, a)
    color = 'green'
    name = `연중 ${week}주${isSunday ? '일' : ' ' + WEEKDAY_NAMES[weekday]}`
    if (isoDate(date) === isoDate(a.baptism)) {
      name = '연중 1주일(주의 세례)'
      color = 'white'
    }
  } else if (date < a.palm) {
    season = 'lent'
    color = 'violet'
    if (isoDate(date) === isoDate(a.ash)) {
      name = '재의 수요일'
    } else {
      const firstSunday = nextSunday(a.ash)
      week = Math.floor(diffDays(date, firstSunday) / 7) + 1
      if (week < 1) {
        // 재의 수요일이 든 주간의 목·금·토
        name = `재의 수요일 후 ${WEEKDAY_NAMES[weekday]}`
        week = undefined
      } else {
        name = `사순 ${week}주${isSunday ? '일' : ' ' + WEEKDAY_NAMES[weekday]}`
        if (week === 4) alternateColor = 'rose'
      }
    }
  } else if (date < a.easter) {
    season = 'holyweek'
    color = 'red'
    const names = ['고난주일(성지주일)', '성주간 월요일', '성주간 화요일', '성주간 수요일',
      '성 목요일(성체제정일)', '성 금요일(주의 수난일)', '성 토요일']
    name = names[diffDays(date, a.palm)] ?? '성주간'
    if (weekday === 4) color = 'white'   // 성 목요일은 백색
  } else if (date <= a.pentecostDay) {
    season = 'easter'
    week = Math.floor(diffDays(date, a.easter) / 7) + 1
    color = 'white'
    // 부활주일이 든 주간이 부활 1주, 그다음 주일이 부활 2주일이다(기도서 494~495쪽).
    name = week === 1 && isSunday
      ? '부활주일'
      : `부활 ${week}주${isSunday ? '일' : ' ' + WEEKDAY_NAMES[weekday]}`
    if (isoDate(date) === isoDate(a.ascension)) name = '승천일'
    if (isoDate(date) === isoDate(a.pentecostDay)) {
      name = '성령강림주일'
      color = 'red'
    }
  } else {
    season = 'ordinary'
    week = ordinaryWeek(date, a)
    color = 'green'
    name = `연중 ${week}주${isSunday ? '일' : ' ' + WEEKDAY_NAMES[weekday]}`
    if (isoDate(date) === isoDate(a.trinity)) {
      name = `연중 ${week}주일(삼위일체주일)`
      color = 'white'
    }
    if (isoDate(date) === isoDate(a.ctk)) {
      name = '연중 34주일(왕이신 그리스도주일)'
      color = 'white'
    }
    if (isoDate(date) === isoDate(corpusChristi(startYear + 1))) {
      name = '그리스도의 성체일'
      color = 'white'
    }
  }

  const principalFeast = MOVABLE_FEASTS.find(
    ([key]) => isoDate(a[key] as Date) === isoDate(date),
  )?.[1]

  return {
    date: isoDate(date),
    liturgicalYearStart: startYear,
    sundayCycle: sundayCycleOf(startYear),
    weekdayCycle: weekdayCycleOf(startYear),
    season,
    seasonName: SEASON_NAMES[season],
    week,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday],
    name,
    color,
    colorName: COLOR_NAMES[color],
    alternateColor,
    isSunday,
    principalFeast,
  }
}
