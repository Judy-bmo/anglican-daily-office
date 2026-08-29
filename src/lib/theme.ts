import type { LiturgicalColor } from './churchCalendar'
import type { ThemeMode } from './storage'

/** 절기색은 포인트 컬러로만 은은하게 쓴다. 밝은 화면과 어두운 화면의 채도를 따로 맞춘다. */
export const SEASON_COLORS: Record<LiturgicalColor, { light: string; dark: string; soft: string; softDark: string }> = {
  white:  { light: '#8a7a52', dark: '#d8c89a', soft: '#f6f1e3', softDark: '#2b2718' },
  red:    { light: '#9b3b34', dark: '#e59a92', soft: '#f9ebe9', softDark: '#33201e' },
  violet: { light: '#5f4b8b', dark: '#b7a5e0', soft: '#f0ecf8', softDark: '#241f33' },
  green:  { light: '#41684b', dark: '#9dc4a6', soft: '#eaf2ec', softDark: '#1b2a1f' },
  rose:   { light: '#a45570', dark: '#e7a7bc', soft: '#faecf1', softDark: '#33212a' },
  blue:   { light: '#3c5e86', dark: '#a3c2e4', soft: '#e9f0f8', softDark: '#1c2733' },
  black:  { light: '#3a3a3a', dark: '#c4c4c4', soft: '#eeeeee', softDark: '#242424' },
}

export function applySeasonColor(color: LiturgicalColor) {
  const c = SEASON_COLORS[color]
  const root = document.documentElement
  root.style.setProperty('--season', c.light)
  root.style.setProperty('--season-dark', c.dark)
  root.style.setProperty('--season-soft', c.soft)
  root.style.setProperty('--season-soft-dark', c.softDark)
}

/** 시간대 자동: 저녁기도·밤기도 시간대(18시~다음날 5시)에는 어두운 화면으로 바꾼다. */
export function isNightHours(now = new Date()): boolean {
  const h = now.getHours()
  return h >= 18 || h < 5
}

export function resolveTheme(mode: ThemeMode, now = new Date()): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (mode === 'auto') return isNightHours(now) ? 'dark' : 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(mode: ThemeMode, now = new Date()) {
  document.documentElement.dataset.theme = resolveTheme(mode, now)
}

export function applyFontScale(scale: number) {
  document.documentElement.style.setProperty('--font-scale', String(scale))
}
