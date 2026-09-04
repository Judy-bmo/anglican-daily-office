/** 정적 데이터 로더 — 한 번 받아 두고 재사용한다(오프라인 캐시는 서비스워커가 담당). */
import type {
  BibleBook, BibleChapter, Canticle, CanticleRule, Feast, LectionaryDay, OfficeDoc, Psalm,
} from './types'

const BASE = `${import.meta.env.BASE_URL}data`
const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined
  if (!p) {
    p = fetch(`${BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`데이터를 불러오지 못했습니다: ${path} (${r.status})`)
      return r.json() as Promise<T>
    })
    cache.set(path, p as Promise<unknown>)
  }
  return p
}

export const loadOffices = () =>
  load<{ offices: OfficeDoc[] }>('offices.json').then((d) => d.offices)

export const loadLectionary = () =>
  load<{ days: LectionaryDay[] }>('lectionary.json').then((d) => d.days)

export const loadPsalter = () =>
  load<{ psalms: Psalm[] }>('psalter.json').then((d) => d.psalms)

export const loadCanticles = () =>
  load<{ canticles: Canticle[]; table: CanticleRule[] }>('canticles.json')

export const loadFeasts = () =>
  load<{ feasts: Feast[]; notes: Array<{ month: number; text: string }> }>('feasts.json')

export const loadBibleBooks = () => load<BibleBook[]>('bible-books.json')

export const loadChapter = (bookId: string, chapter: number) =>
  load<BibleChapter>(`bible/${bookId}-${chapter}.json`)
