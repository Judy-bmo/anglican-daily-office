import { useEffect, useState } from 'react'

/**
 * 처음 들어온 사람에게 홈 화면에 담는 법을 알려 준다.
 *
 * 설치해 두면 주소창 없이 전체 화면으로 열리고, 인터넷이 닿지 않는 곳에서도
 * 예식문과 시편을 볼 수 있다. iOS는 브라우저가 설치를 제안하지 못하므로 사파리의
 * 공유 메뉴를 짚어 주고, 안드로이드·데스크톱 크롬은 브라우저가 건네주는 설치
 * 절차를 그대로 띄운다.
 */
const DISMISSED = 'install-prompt-dismissed'

/** 브라우저가 설치를 제안할 때 넘겨주는 이벤트 (표준에 아직 없는 형태) */
interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true
}

function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [deferred, setDeferred] = useState<InstallEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISSED)) return
    } catch {
      /* 저장소를 막아 둔 브라우저에서도 안내는 보여 준다 */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()                       // 브라우저 기본 배너 대신 우리 안내를 쓴다
      setDeferred(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // 첫 화면을 먼저 보여 주고 나서 말을 건다
    const id = window.setTimeout(() => setOpen(true), 1800)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.clearTimeout(id)
    }
  }, [])

  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      /* 저장할 수 없으면 이번만 닫힌다 */
    }
  }

  if (!open) return null

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    close()
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'color-mix(in srgb, #000 38%, transparent)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-6 pb-8"
        style={{ background: 'var(--paper-raised)', color: 'var(--ink)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="install-title" className="text-[1.15em] font-semibold">
          홈 화면에 담아 두세요
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          앱처럼 전체 화면으로 열리고, 인터넷이 닿지 않는 곳에서도 예식문과 시편을
          보실 수 있습니다.
        </p>

        {deferred ? (
          <button
            className="tap mt-5 w-full rounded-xl py-3 text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'var(--paper)' }}
            onClick={install}
          >
            설치하기
          </button>
        ) : (
          <ol className="mt-4 space-y-2 text-sm">
            {isIOS() ? (
              <>
                <li>1. 사파리 아래쪽 <b>공유 버튼</b>을 누르세요.</li>
                <li>2. 목록을 내려 <b>「홈 화면에 추가」</b>를 고르세요.</li>
                <li>3. 오른쪽 위 <b>추가</b>를 누르면 끝입니다.</li>
              </>
            ) : (
              <>
                <li>1. 크롬 오른쪽 위 <b>⋮</b> 를 누르세요.</li>
                <li>2. <b>「앱 설치」</b> 또는 <b>「홈 화면에 추가」</b>를 고르세요.</li>
              </>
            )}
          </ol>
        )}

        <button
          className="tap mt-3 w-full rounded-xl py-3 text-sm"
          style={{ border: '1px solid var(--rule)', color: 'var(--ink-muted)' }}
          onClick={close}
        >
          그냥 둘러보기
        </button>
      </div>
    </div>
  )
}
