import { useCallback, useEffect, useMemo, useState } from 'react'
import { describeDay, isoDate, toUtcDay, type ChurchDay } from './churchCalendar'
import {
  loadCanticles, loadCollects, loadFeasts, loadLectionary, loadOffices, loadPsalter,
} from './data'
import { buildIndex, resolveLectionary, type LectionaryIndex, type OfficeLectionary } from './lectionary'
import { applyFontScale, applySeasonColor, applyTheme } from './theme'
import {
  DEFAULT_SETTINGS, allRecords, loadSettings, markCompleted, saveSettings,
  streakOf, unmarkCompleted, type PrayerRecord, type Settings,
} from './storage'
import type {
  Canticle, CanticleRule, CollectDay, Feast, OfficeDoc, OfficeId, Psalm,
} from './types'

export interface AppData {
  offices: OfficeDoc[]
  lectionary: LectionaryIndex
  psalter: Map<number, Psalm>
  feasts: Feast[]
  feastNotes: Array<{ month: number; text: string }>
  /** 성무일과 송가 열세 편 (기도서 180~189쪽) */
  canticles: Canticle[]
  /** 요일·절기에 따른 송가 배정표 (180~181쪽) */
  canticleTable: CanticleRule[]
  /** 교회력에 따른 오늘의 본기도 (41~84쪽) */
  collects: CollectDay[]
}

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([loadOffices(), loadLectionary(), loadPsalter(), loadFeasts(), loadCanticles(),
            loadCollects()])
      .then(([offices, lect, psalms, feasts, canticles, collects]) => {
        if (!alive) return
        setData({
          offices,
          lectionary: buildIndex(lect),
          psalter: new Map(psalms.map((p) => [p.number, p])),
          feasts: feasts.feasts,
          feastNotes: feasts.notes,
          canticles: canticles.canticles,
          canticleTable: canticles.table,
          collects,
        })
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => { alive = false }
  }, [])

  return { data, error }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadSettings().then((s) => { setSettings(s); setReady(true) })
  }, [])

  useEffect(() => {
    if (!ready) return
    applyTheme(settings.theme)
    applyFontScale(settings.fontScale)
  }, [settings.theme, settings.fontScale, ready])

  // '시스템 설정 따르기'와 '시간대 자동'은 바깥 변화에 반응해야 한다
  useEffect(() => {
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => applyTheme('system')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    if (settings.theme === 'auto') {
      const id = window.setInterval(() => applyTheme('auto'), 60_000)
      return () => window.clearInterval(id)
    }
  }, [settings.theme])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      void saveSettings(next)
      return next
    })
  }, [])

  return { settings, update, ready }
}

/** 오늘(또는 고른 날)의 교회력·정과·축일 */
export function useDay(date: string, data: AppData | null) {
  return useMemo(() => {
    const day: ChurchDay = describeDay(date)
    if (!data) return { day, lectionary: null as OfficeLectionary | null, feasts: [] as Feast[] }
    const [, mm, dd] = date.split('-').map(Number)
    const feasts = data.feasts.filter(
      (f) => f.month === mm && (f.day === dd || (f.dayEnd !== undefined && dd >= f.day && dd <= f.dayEnd)),
    )
    return { day, lectionary: resolveLectionary(day, data.lectionary), feasts }
  }, [date, data])
}

export function useRecords(date: string, threshold: number) {
  const [records, setRecords] = useState<PrayerRecord[]>([])
  const refresh = useCallback(() => { allRecords().then(setRecords) }, [])
  useEffect(refresh, [refresh])

  const todays = useMemo(() => new Set(records.filter((r) => r.date === date).map((r) => r.office)), [records, date])
  const streak = useMemo(() => streakOf(records, isoDate(toUtcDay(new Date())), threshold), [records, threshold])

  const toggle = useCallback(async (office: OfficeId) => {
    if (todays.has(office)) await unmarkCompleted(date, office)
    else await markCompleted(date, office)
    refresh()
  }, [date, todays, refresh])

  return { records, todays, streak, toggle, refresh }
}

/** 절기색을 화면 전체 포인트 컬러로 반영한다. */
export function useSeasonColor(day: ChurchDay) {
  useEffect(() => { applySeasonColor(day.color) }, [day.color])
}
