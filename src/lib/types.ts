export type OfficeId = 'morning' | 'noon' | 'evening' | 'night'
export type ReadingYear = '1' | '2' | 'both'

/** 성무일과 예식문 한 조각 */
export interface OfficeBlock {
  type: 'title' | 'rubric' | 'section' | 'option' | 'versicle' | 'response' | 'verse' | 'heading' | 'text'
  text?: string
  title?: string
  n?: number | string
  marker?: string
  page: number
}

export interface OfficeDoc {
  office: OfficeId | 'brief' | 'canticles'
  title: string
  pages: [number, number]
  /** 성서정과(날짜별 전례독서)를 따르는 예식인지. 낮기도·밤기도는 false. */
  lectionaryLinked: boolean
  blocks: OfficeBlock[]
}

export interface ReadingSet {
  ot?: string
  epistle?: string
  gospel?: string
  extra?: string[]
}

export interface OfficeReadings {
  psalms?: string | null
  readings: string[]
}

export interface LectionaryDay {
  label: string
  kind: 'sunday' | 'weekday' | 'date' | 'special' | 'feast'
  page: number
  season?: string
  week?: number | null
  weekday?: number
  month?: number
  day?: number
  psalms: { morning?: string | null; evening?: string | null; raw?: string }
  readings: Partial<Record<ReadingYear, ReadingSet>>
  /** 고난주일·부활주일·성탄주간 축일처럼 아침/저녁 독서가 따로 지정된 경우 */
  offices?: Partial<Record<'morning' | 'evening', OfficeReadings>>
  alternates?: string[]
  notes?: string[]
}

export interface PsalmVerse {
  n?: string | null
  text?: string
  section?: string
  /** 긴 시편을 나누어 낭송하도록 표시한 구분 (기도서 526쪽) */
  part?: string
}

export interface Psalm {
  number: number
  page: number
  verses: PsalmVerse[]
  gloria: string | null
}

export type FeastRank = 'principal' | 'major' | 'feast' | 'memorial'

export interface Feast {
  month: number
  day: number
  dayEnd?: number
  name: string
  rank: FeastRank
  page: number
}

export interface BibleBook {
  id: string
  name_ko: string
  short_name_ko: string
  name_en: string
  division: 'old_testament' | 'deuterocanon' | 'new_testament'
  chapter_count: number
  has_prologue?: boolean
}

export interface BibleSegment {
  type: string
  text: string
  paragraph_break?: boolean
}

export interface BibleVerse {
  number: number
  segments: BibleSegment[]
  notes?: Array<{ id: string; anchor: string; body: string }>
}

export interface BibleChapter {
  book_id: string
  book_name_ko: string
  chapter: number
  verses: BibleVerse[]
}

/** 성무일과 송가 한 편 (기도서 180~189쪽) */
export interface Canticle {
  name: string
  /** 라틴어 첫 구절 — 예) Benedictus Dominus Deus */
  latin: string | null
  /** 성서 출처 — 「당신은 하느님」처럼 출처가 없는 것도 있다 */
  ref: string | null
  page: number
  /** 「특별히 부활절기에 적합하다」 같은 안내 */
  rubric: string | null
  verses: Array<{ n: string; text: string }>
}

/** 요일·절기에 따라 어느 송가를 쓰는지 (기도서 180~181쪽 표) */
export interface CanticleRule {
  day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'feast'
  office: 'morning' | 'evening'
  season: 'ordinary' | 'advent' | 'lent' | 'easter'
  /** 첫째는 1독서 뒤, 둘째는 2독서 뒤. 독서가 하나면 첫째만 한다 (180쪽) */
  canticles: string[]
}

/** 교회력에 따른 오늘의 본기도 (기도서 41~84쪽 「주일 본기도」) */
export interface CollectDay {
  /** 대림절기 · 성탄절기 · 사순절기 · 부활절기 · 연중시기 */
  season: string | null
  /** 책에 적힌 표제 그대로 — 「연중 22주일(8월 28일과 9월 3일 사이의 주일)」 */
  day: string
  /** 괄호를 뗀 이름 — 「연중 22주일」 */
  name: string
  page: number
  rubric: string | null
  /** 교회력과 이어 붙일 열쇠. 축일처럼 주차로 정해지지 않는 날은 null */
  key: { season: string; week: number } | null
  /** 가·나·다해, 주간, 전부(주기 구분이 없는 날) */
  cycles: Array<{ cycle: string; texts: string[] }>
}
