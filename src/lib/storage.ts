/**
 * 기기 안에만 남는 개인 기록 — 기도 기록(스트릭)·즐겨찾기·설정.
 * 신앙 생활 기록이므로 서버로 보내지 않는다.
 */
import { openDB, type IDBPDatabase } from 'idb'
import type { OfficeId } from './types'

export interface PrayerRecord {
  id: string
  date: string
  office: OfficeId
  completedAt: string
}

export interface Favorite {
  id: string
  type: 'psalm' | 'reading' | 'prayer'
  reference: string
  text: string
  savedAt: string
}

export type ThemeMode = 'system' | 'light' | 'dark' | 'auto'

export interface Settings {
  theme: ThemeMode
  fontScale: number
  speechRate: number
  /** 하루를 '완료'로 볼 최소 기도 수 (1~4) */
  streakThreshold: number
  /** 성서 본문을 함께 보여 줄지 */
  showBibleText: boolean
  reminders: Partial<Record<OfficeId, string>>
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontScale: 1,
  speechRate: 0.95,
  streakThreshold: 2,
  showBibleText: true,
  reminders: {},
}

let dbp: Promise<IDBPDatabase> | null = null
function db() {
  if (!dbp) {
    dbp = openDB('daily-office', 1, {
      upgrade(d) {
        const rec = d.createObjectStore('records', { keyPath: 'id' })
        rec.createIndex('date', 'date')
        d.createObjectStore('favorites', { keyPath: 'id' })
        d.createObjectStore('settings')
      },
    })
  }
  return dbp
}

/* ───────────  기도 기록  ─────────── */

const recordId = (date: string, office: OfficeId) => `${date}|${office}`

export async function markCompleted(date: string, office: OfficeId): Promise<void> {
  await (await db()).put('records', {
    id: recordId(date, office), date, office, completedAt: new Date().toISOString(),
  })
}

export async function unmarkCompleted(date: string, office: OfficeId): Promise<void> {
  await (await db()).delete('records', recordId(date, office))
}

export async function recordsForDate(date: string): Promise<PrayerRecord[]> {
  return (await db()).getAllFromIndex('records', 'date', date)
}

export async function allRecords(): Promise<PrayerRecord[]> {
  return (await db()).getAll('records')
}

/**
 * 연속 기도 일수. 설정한 개수 이상을 마친 날만 이어진 것으로 센다.
 * 오늘 아직 채우지 못했더라도 어제까지 이어졌다면 끊지 않는다.
 */
export function streakOf(records: PrayerRecord[], today: string, threshold: number): number {
  const byDate = new Map<string, number>()
  for (const r of records) byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1)
  const done = (d: string) => (byDate.get(d) ?? 0) >= threshold

  const day = new Date(`${today}T00:00:00Z`)
  if (!done(today)) day.setUTCDate(day.getUTCDate() - 1)
  let n = 0
  for (;;) {
    const iso = day.toISOString().slice(0, 10)
    if (!done(iso)) break
    n++
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return n
}

/* ───────────  즐겨찾기  ─────────── */

export async function addFavorite(f: Omit<Favorite, 'id' | 'savedAt'>): Promise<Favorite> {
  const item: Favorite = { ...f, id: crypto.randomUUID(), savedAt: new Date().toISOString() }
  await (await db()).put('favorites', item)
  return item
}

export async function removeFavorite(id: string): Promise<void> {
  await (await db()).delete('favorites', id)
}

export async function listFavorites(): Promise<Favorite[]> {
  const all: Favorite[] = await (await db()).getAll('favorites')
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/* ───────────  설정  ─────────── */

export async function loadSettings(): Promise<Settings> {
  const saved = (await (await db()).get('settings', 'settings')) as Partial<Settings> | undefined
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('settings', s, 'settings')
}
