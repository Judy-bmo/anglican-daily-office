import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, isoDate, parseIso, toUtcDay } from './lib/churchCalendar'
import { useAppData, useDay, useRecords, useSeasonColor, useSettings } from './lib/useApp'
import { InstallPrompt } from './components/InstallPrompt'
import { TodayPage } from './pages/TodayPage'
import { OfficePage } from './pages/OfficePage'
import { CalendarPage } from './pages/CalendarPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { SettingsPage } from './pages/SettingsPage'
import type { OfficeId } from './lib/types'

type View = 'today' | 'office' | 'calendar' | 'favorites' | 'settings'

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: 'today', label: '오늘', icon: '◉' },
  { id: 'calendar', label: '달력', icon: '▦' },
  { id: 'favorites', label: '즐겨찾기', icon: '★' },
  { id: 'settings', label: '설정', icon: '⚙' },
]

export default function App() {
  const { data, error } = useAppData()
  const { settings, update, ready } = useSettings()
  const today = isoDate(toUtcDay(new Date()))
  const [date, setDate] = useState(today)
  const [view, setView] = useState<View>('today')
  const [office, setOffice] = useState<OfficeId>('morning')

  const { day, lectionary, feasts } = useDay(date, data)
  const { todays, streak, toggle } = useRecords(date, settings.streakThreshold)
  useSeasonColor(day)

  const doc = useMemo(() => data?.offices.find((o) => o.office === office), [data, office])

  const shiftDay = useCallback((delta: number) => {
    setDate((d) => isoDate(addDays(parseIso(d), delta)))
  }, [])

  // 알림: 앱이 열려 있는 동안 정해진 시각에 알려 준다.
  useEffect(() => {
    if (!ready || !('Notification' in window) || Notification.permission !== 'granted') return
    const fired = new Set<string>()
    const id = window.setInterval(() => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      for (const [key, time] of Object.entries(settings.reminders)) {
        const tag = `${isoDate(toUtcDay(now))}-${key}`
        if (time === hhmm && !fired.has(tag)) {
          fired.add(tag)
          const label = { morning: '아침기도', noon: '낮기도', evening: '저녁기도', night: '밤기도' }[key as OfficeId]
          new Notification('성무일과', { body: `${label} 시간입니다.`, tag })
        }
      }
    }, 30_000)
    return () => window.clearInterval(id)
  }, [settings.reminders, ready])

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-3 text-xl">데이터를 불러오지 못했습니다</h1>
        <p style={{ color: 'var(--ink-muted)' }}>{error}</p>
      </main>
    )
  }

  if (!data || !ready) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16" aria-busy="true">
        <p style={{ color: 'var(--ink-faint)' }}>불러오는 중…</p>
      </main>
    )
  }

  const pendingToday = date === today && todays.size < settings.streakThreshold

  return (
    <div className="min-h-dvh pb-28">
      <InstallPrompt />
      <main className="mx-auto max-w-2xl px-6 pt-10">
        {view === 'today' && (
          <TodayPage
            day={day} feasts={feasts} lectionary={lectionary}
            completed={todays} streak={streak} threshold={settings.streakThreshold}
            isToday={date === today}
            onOpen={(o) => { setOffice(o); setView('office') }}
            onShiftDay={shiftDay}
          />
        )}
        {view === 'office' && doc && (
          <OfficePage
            doc={doc} day={day} lectionary={lectionary} data={data}
            showBibleText={settings.showBibleText} speechRate={settings.speechRate}
            completed={todays.has(office)}
            onToggleComplete={() => toggle(office)}
            onBack={() => setView('today')}
          />
        )}
        {view === 'calendar' && (
          <CalendarPage date={date} data={data} onPick={(d) => { setDate(d); setView('today') }} />
        )}
        {view === 'favorites' && <FavoritesPage color={day.color} />}
        {view === 'settings' && <SettingsPage settings={settings} update={update} />}
      </main>

      <nav
        className="no-print fixed inset-x-0 bottom-0 border-t backdrop-blur"
        style={{ borderColor: 'var(--rule)', background: 'color-mix(in srgb, var(--paper) 92%, transparent)' }}
        aria-label="주요 화면"
      >
        <ul className="mx-auto flex max-w-2xl">
          {NAV.map((n) => {
            const active = view === n.id || (n.id === 'today' && view === 'office')
            return (
              <li key={n.id} className="flex-1">
                <button
                  onClick={() => setView(n.id)}
                  aria-current={active ? 'page' : undefined}
                  className="tap flex w-full flex-col items-center gap-0.5 py-3 text-xs"
                  style={{ color: active ? 'var(--accent)' : 'var(--ink-faint)' }}
                >
                  <span aria-hidden className="text-base">{n.icon}</span>
                  {n.label}
                  {n.id === 'today' && pendingToday && (
                    <span aria-hidden className="absolute mt-0.5 ml-7 h-1.5 w-1.5 rounded-full"
                          style={{ background: 'var(--accent)' }} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
