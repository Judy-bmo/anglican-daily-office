/**
 * 인쇄·PDF 저장 시 파일 이름.
 *
 * 브라우저는 'PDF로 저장'의 기본 파일명을 문서 제목에서 가져온다. 그래서 인쇄 직전에
 * 제목을 바꿔 두었다가 인쇄창이 닫히면 되돌린다.
 */
import type { ChurchDay } from './churchCalendar'

/** 파일 이름에 쓸 수 없는 글자를 걷어낸다. */
function safe(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * 문서 제목을 바꾼다.
 *
 * 브라우저는 'PDF로 저장'의 파일 이름을 문서 제목에서 가져온다. 미리보기 창처럼
 * 프레임 안에서 열려 있으면 바깥 문서의 제목이 쓰이므로 그쪽도 함께 바꿔 준다.
 * (앱에 내장된 미리보기에서는 그 앱이 이름을 정하므로 브라우저 탭에서 인쇄해야 한다.)
 */
function setDocumentTitle(title: string): void {
  document.title = title
  try {
    if (window.top && window.top !== window) window.top.document.title = title
  } catch {
    /* 다른 출처의 문서에는 손댈 수 없다 */
  }
}

export interface PrintOptions {
  /** 가로로 눕혀 종이 폭을 가득 쓰고, 한 쪽에 담기도록 배율을 맞춘다 (달력 표에 쓴다) */
  landscape?: HTMLElement | null
}

/** A4 가로에서 실제로 쓸 수 있는 판면 (297mm − 좌우 여백 16mm) */
const PAGE_WIDTH_PX = Math.round((297 - 16) * 96 / 25.4)
/** 210mm − 위아래 여백이면 726px이지만, 머리말·꼬리말을 켜 둔 경우까지 감안한다. */
const PAGE_HEIGHT_PX = 660

/** 인쇄할 내용을 실제 판면 넓이로 재어, 한 쪽을 넘치면 그만큼 배율을 줄인다. */
function fitToOnePage(element: HTMLElement): () => void {
  const root = document.documentElement
  root.style.setProperty('--print-width', `${PAGE_WIDTH_PX}px`)
  root.classList.add('measuring-print')
  const height = element.scrollHeight
  root.classList.remove('measuring-print')
  if (height <= PAGE_HEIGHT_PX) return () => {}
  // 반올림으로 몇 px 넘치는 일이 없도록 여유를 조금 둔다
  const scale = Math.floor(((PAGE_HEIGHT_PX - 8) / height) * 1000) / 1000
  element.style.zoom = String(scale)
  return () => { element.style.zoom = '' }
}

/**
 * 달력 표를 가로로 눕혀 종이 폭 가득 인쇄하기 위한 규칙.
 *
 * 본문은 읽기 좋으라고 `main`을 42rem으로 묶어 두었는데, 달력 표는 종이 폭을 다 써야
 * 칸이 좁아지지 않는다. 인쇄하는 동안만 그 제한을 풀어 준다.
 */
const LANDSCAPE_CSS = `
@page { size: A4 landscape; margin: 9mm 8mm; }
@media print {
  main {
    max-width: none !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    padding-top: 0 !important;
  }
}
`

export function printWithTitle(title: string, opts: PrintOptions = {}): void {
  const original = document.title
  const undo: Array<() => void> = []
  let sheet: HTMLStyleElement | null = null
  if (opts.landscape) {
    // @page는 조건부로 쓸 수 없어 인쇄하는 동안만 규칙을 끼워 넣는다
    sheet = document.createElement('style')
    sheet.textContent = LANDSCAPE_CSS
    document.head.appendChild(sheet)
    undo.push(fitToOnePage(opts.landscape))
  }
  const restore = () => {
    setDocumentTitle(original)
    sheet?.remove()
    sheet = null
    while (undo.length) undo.pop()!()
    window.removeEventListener('afterprint', restore)
  }
  setDocumentTitle(safe(title))
  window.addEventListener('afterprint', restore)
  window.print()
  // afterprint를 보내지 않는 브라우저를 대비한 보조 복구
  window.setTimeout(restore, 30_000)
}

/**
 * 기도 화면의 인쇄 제목 — 예) `2026-08-29 연중 21주 토요일 아침기도`
 * 날짜를 앞에 두면 폴더에서 날짜순으로 정렬되고, 해가 바뀌어도 겹치지 않는다.
 */
export function officePrintTitle(day: ChurchDay, officeTitle: string): string {
  return `${day.date} ${day.name} ${officeTitle}`
}

/** 달력 화면의 인쇄 제목 — 예) `2026-08 성무일과 독서목록` */
export function monthPrintTitle(yearMonth: string): string {
  return `${yearMonth} 성무일과 독서목록`
}
