/**
 * 독서 뒤에 부를 송가를 고른다.
 *
 * 기도서 180쪽: "모든 독서 후에는 송가를 한다. 다양한 송가의 사용을 원하면 아래표를
 * 따라서 181-189쪽에 있는 송가 중에 하나를 선택할 수 있다. 독서가 하나일 경우 첫
 * 번째 송가를 한다." 그 표를 그대로 옮겨 두었다.
 */
import type { Canticle, CanticleRule } from './types'
import type { ChurchDay } from './churchCalendar'

const WEEKDAY: CanticleRule['day'][] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

/** 표에는 대림·사순·부활만 따로 있고 나머지는 통상 항목을 쓴다. 성주간은 사순으로 본다. */
function seasonKey(day: ChurchDay): CanticleRule['season'] {
  if (day.season === 'advent') return 'advent'
  if (day.season === 'lent' || day.season === 'holyweek') return 'lent'
  if (day.season === 'easter') return 'easter'
  return 'ordinary'
}

/**
 * 그날 그 예식에 기도서가 배정한 송가 이름 (많아야 둘).
 * 절기 항목이 없으면 그 요일의 통상 항목으로 돌아간다.
 */
export function assignedCanticles(
  table: CanticleRule[], day: ChurchDay, office: string, isFeast = false,
): string[] {
  if (office !== 'morning' && office !== 'evening') return []
  const key = isFeast ? 'feast' : WEEKDAY[day.weekday]
  const find = (season: CanticleRule['season']) =>
    table.find((r) => r.day === key && r.office === office && r.season === season)
  const hit = find(seasonKey(day)) ?? find('ordinary')
  return hit ? hit.canticles : []
}

/** 이름으로 송가를 찾는다. */
export function canticleByName(list: Canticle[], name: string): Canticle | undefined {
  return list.find((c) => c.name === name)
}

/** 화면에 적을 이름 — 「모세송가 Cantemus Domino」 */
export function canticleLabel(c: Canticle): string {
  return c.latin ? `${c.name} ${c.latin}` : c.name
}
