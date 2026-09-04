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
  /** 세로 그대로 두되 한 쪽에 담기도록 배율만 맞춘다 (2단 독서 목록에 쓴다) */
  fitPortrait?: HTMLElement | null
}

/** A4 가로에서 실제로 쓸 수 있는 판면 (297mm − 좌우 여백 16mm) */
const PAGE_WIDTH_PX = Math.round((297 - 16) * 96 / 25.4)
/** 210mm − 위아래 여백이면 726px이지만, 머리말·꼬리말을 켜 둔 경우까지 감안한다. */
const PAGE_HEIGHT_PX = 660
/**
 * 세로 용지에 눕혀 앉힐 때 쓸 수 있는 판면.
 *
 * 돌려 놓으면 내용의 가로가 종이의 긴 변, 내용의 세로가 짧은 변을 차지한다.
 * 문제는 이 브라우저가 @page의 여백 지정도 무시한다는 것이다. 게다가 인쇄물
 * 위아래에 주소와 날짜, 쪽 번호를 적은 띠를 스스로 붙인다. 판면을 A4에 딱
 * 맞춰 놓았더니 그 띠만큼 모자라, 돌린 뒤 맨 아래로 가는 토요일 열이 다음
 * 장으로 밀려났다. 그래서 A4·레터 가운데 작은 쪽에서 여백과 띠를 넉넉히 빼고
 * 잡는다.
 * 크기는 vh로 정하고, 아래 px 값은 그 값이 터무니없이 커지지 않게 막는
 * 빗장으로만 쓴다. 짧은 변은 재어서 넘치면 그만큼 배율을 줄인다.
 */
const ROTATED_WIDTH_PX = 1200
const ROTATED_HEIGHT_PX = 680
/** A4 세로에서 본문이 차지하는 폭 — main의 42rem과 판면(210mm − 좌우 32mm)이 거의 같다 */
const PORTRAIT_WIDTH_PX = 672
/**
 * 297mm − 위아래 여백이면 986px이지만, 브라우저가 머리말·꼬리말 띠를 붙이면
 * (iOS는 늘 붙인다) 실제로 쓸 수 있는 세로는 230mm쯤이다. 넉넉히 217mm로 잡는다.
 */
const PORTRAIT_HEIGHT_PX = 820

/**
 * 이 브라우저가 용지 방향 지정을 무시하는가.
 *
 * iOS·iPadOS의 웹킷은 @page의 size를 통째로 무시한다. 가로로 눕혀 달라고 해도 세로로
 * 나오고, 좁아진 폭에 표가 구겨진다. 그런 브라우저에서는 우리가 직접 내용을 90도 돌려
 * 세로 용지에 눕혀 앉힌다. 종이에 뽑으면 용지를 돌려 보는 것과 같은 결과가 된다.
 */
export function needsRotatedPrint(ua: string, hasTouch: boolean): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13부터는 데스크톱 사파리와 같은 UA를 보내므로 터치 여부로 가른다
  return /Macintosh/.test(ua) && hasTouch
}

/** 인쇄할 내용을 실제 판면 넓이로 재어, 한 쪽을 넘치면 그만큼 배율을 줄인다. */
function fitToOnePage(element: HTMLElement, width: number, limit: number): () => void {
  const root = document.documentElement
  root.style.setProperty('--print-width', `${width}px`)
  root.classList.add('measuring-print')
  const height = element.scrollHeight
  root.classList.remove('measuring-print')
  if (height <= limit) return () => {}
  // 반올림으로 몇 px 넘치는 일이 없도록 여유를 조금 둔다
  const scale = Math.floor(((limit - 8) / height) * 1000) / 1000
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

/**
 * 용지 방향을 못 바꾸는 브라우저용 — 세로 용지에 표를 눕혀 앉힌다.
 *
 * 종이의 긴 변(281mm)을 표의 가로로 쓰고 짧은 변(194mm)을 높이로 쓴다. 회전은 배치에
 * 영향을 주지 않으므로, 감싸는 `main`에 돌린 뒤의 높이를 직접 주어 한 쪽으로 끝맺는다.
 */
/**
 * 세로 그대로 인쇄하되 본문 폭을 판면에 맞추는 규칙.
 *
 * 화면용 좌우 여백이 남아 있으면 잰 폭과 실제 인쇄 폭이 어긋나 배율이 틀어진다.
 */
const PORTRAIT_FIT_CSS = `
@media print {
  main {
    padding-left: 0 !important;
    padding-right: 0 !important;
    padding-top: 0 !important;
  }
}
`

const ROTATED_CSS = `
@page { margin: 8mm; }
@media print {
  main {
    max-width: none !important;
    padding: 0 !important;
    position: relative;
    /* px로 적은 값은 이 브라우저가 종이에 맞춰 판을 통째로 늘이거나 줄이면
       뜻을 잃는다(800px으로 못박았더니 두 쪽으로 갈라졌다). vh가 쪽 상자를
       따라가므로 그쪽을 쓰고, px 값은 터무니없이 커지지 않게 막는 빗장으로만
       둔다. 재어 본 값 — 92vh는 한 쪽에 들어가되 종이가 많이 남고, 135vh는
       넘쳐서 두 쪽이 된다. 그 사이에서 넘칠 위험이 적은 쪽으로 잡는다. */
    height: min(${ROTATED_WIDTH_PX}px, 110vh);
  }
  .print-only {
    position: absolute;
    top: 0;
    left: 0;
    width: min(${ROTATED_WIDTH_PX}px, 110vh);
    transform-origin: 0 0;
    transform: rotate(90deg) translateY(-100%);
  }
}
`

export function printWithTitle(title: string, opts: PrintOptions = {}): void {
  const original = document.title
  const undo: Array<() => void> = []
  let sheet: HTMLStyleElement | null = null
  if (opts.landscape) {
    const rotated = needsRotatedPrint(navigator.userAgent, navigator.maxTouchPoints > 1)
    // @page는 조건부로 쓸 수 없어 인쇄하는 동안만 규칙을 끼워 넣는다
    sheet = document.createElement('style')
    sheet.textContent = rotated ? ROTATED_CSS : LANDSCAPE_CSS
    document.head.appendChild(sheet)
    undo.push(rotated
      ? fitToOnePage(opts.landscape, ROTATED_WIDTH_PX, ROTATED_HEIGHT_PX)
      : fitToOnePage(opts.landscape, PAGE_WIDTH_PX, PAGE_HEIGHT_PX))
  } else if (opts.fitPortrait) {
    sheet = document.createElement('style')
    sheet.textContent = PORTRAIT_FIT_CSS
    document.head.appendChild(sheet)
    undo.push(fitToOnePage(opts.fitPortrait, PORTRAIT_WIDTH_PX, PORTRAIT_HEIGHT_PX))
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
