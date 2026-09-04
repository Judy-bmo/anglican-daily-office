/**
 * 새 판이 올라오면 그 자리에서 바꿔 끼운다.
 *
 * 서비스워커는 앱 껍데기를 캐시에서 먼저 내주므로, 새 판을 올려도 이번에 연 화면은
 * 옛 것이고 다음에 열어야 새 것이 보인다. 고친 곳이 왜 안 보이느냐는 오해가 여기서
 * 생긴다. 그래서 새 일꾼이 자리를 넘겨받는 순간(controllerchange) 화면을 다시 그린다.
 *
 * 처음 설치할 때도 같은 일이 일어나지만 그때는 이미 새 것을 보고 있으므로, 앞서
 * 일꾼이 있었을 때만 다시 그린다. 오래 켜 둔 경우를 위해 한 시간마다, 그리고 앱을
 * 다시 앞으로 가져올 때 새 판이 있는지 물어본다.
 */
const HOUR = 60 * 60 * 1000

export function watchForUpdates(): void {
  if (!('serviceWorker' in navigator)) return

  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  void navigator.serviceWorker.ready.then((reg) => {
    const check = () => { void reg.update().catch(() => {}) }
    window.setInterval(check, HOUR)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  })
}
