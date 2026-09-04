/**
 * 오늘의 본기도를 고른다.
 *
 * 성무일과 예식문은 「교회력에 따른 오늘의 본기도를 드린다」고만 적어 두고, 기도문은
 * 41~84쪽 「주일 본기도」에 따로 실려 있다. 주일에는 그해 주기(가·나·다해)의 기도를,
 * 평일에는 그 주간의 기도를 드린다.
 */
import type { CollectDay } from './types'
import type { ChurchDay } from './churchCalendar'

/** 주차로 정해지지 않는 날들 — 교회력 이름과 본기도 표제를 이어 준다 */
const SPECIAL: Record<string, string> = {
  '성탄일': '성탄 밤',
  '공현일': '공현일 1월 6일',
  '고난주일(성지주일)': '사순 6주일 / 고난주일 또는 성지주일',
  '성 목요일(성체제정일)': '성목요일 / 성체제정일',
  '성 금요일(주의 수난일)': '성금요일 / 주의 수난일',
  '성 토요일': '성토요일',
  '재의 수요일': '사순 첫날 / 재축복식',
  '승천일': '예수 승천일',
  '성령강림주일': '성령강림주일',
  '삼위일체주일': '삼위일체주일',
  '그리스도의 성체일': '그리스도의 성체일 Corpus Christi',
}

export interface ResolvedCollect {
  source: CollectDay
  /** 어느 기도를 골랐는지 — 가·나·다해, 주간, 전부 */
  cycle: string
  texts: string[]
}

/** 성주간 월·화·수요일은 고난주일의 주간 기도를 이어 쓴다 */
const HOLY_WEEK_DAYS = /^성주간 [월화수]요일$/
/** 「이 본기도는 사순 1주일 전까지 사용한다」 — 재의 수요일이 든 주간의 목·금·토 */
const AFTER_ASH = /^재의 수요일 후 /
/** 「공현일 본기도는 연중 1주일 전까지 사용한다」 — 공현일 뒤 성탄절기의 남은 날 */
const EPIPHANY_TIDE = /^성탄(주간|\s*\d+주)/

export function resolveCollect(list: CollectDay[], day: ChurchDay): ResolvedCollect | null {
  const wanted = SPECIAL[day.principalFeast ?? '']
    ?? SPECIAL[day.name]
    ?? (HOLY_WEEK_DAYS.test(day.name) ? SPECIAL['고난주일(성지주일)'] : undefined)
    ?? (AFTER_ASH.test(day.name) ? SPECIAL['재의 수요일'] : undefined)

  let source = wanted
    ? list.find((c) => c.day === wanted)
    : list.find((c) => c.key && c.key.season === day.season && c.key.week === day.week)
  // 공현일 뒤 연중 1주일 전까지는 공현일 본기도를 이어 쓴다 (기도서 46쪽)
  if (!source && day.season === 'christmas' && EPIPHANY_TIDE.test(day.name)) {
    source = list.find((c) => c.day === SPECIAL['공현일'])
  }
  if (!source || !source.cycles.length) return null

  // 주일에는 그해 주기의 기도를, 평일에는 그 주간의 기도를 드린다
  const want = day.weekday === 0 ? day.sundayCycle : '주간'
  const pick = source.cycles.find((c) => c.cycle === want)
    ?? source.cycles.find((c) => c.cycle === '전부')
    ?? source.cycles[0]
  return { source, cycle: pick.cycle, texts: pick.texts }
}
