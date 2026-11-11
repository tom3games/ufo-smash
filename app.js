// iPhone アプリ版へのボタン。結果画面の支援ボタンの上（無ければ data-again のボタン列の下）に置く
// 使い方: support.js の後に <script src="app.js?v=1" data-url="https://apps.apple.com/jp/app/idXXXX" data-again="retryBtn"></script>
// Android では入れられないので出さない。見た目は各ゲームの CSS（#tmApp）で合わせる
(function () {
  var script = document.currentScript
  if (/Android/i.test(navigator.userAgent)) return
  var url = script.getAttribute('data-url')
  var again = document.getElementById(script.getAttribute('data-again') || '')
  var byHtml = script.getAttribute('data-lang') === 'html'
  if (!url || !again || document.getElementById('tmApp')) return

  var a = document.createElement('a')
  a.id = 'tmApp'
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  // スマホの形に下向きの矢印（アップルのロゴは描かない）
  a.innerHTML = '<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" style="flex:none"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="1" width="11" height="16" rx="2"/><path d="M8 5v6M5.5 8.6 8 11l2.5-2.4"/><path d="M6.5 14.2h3"/></g></svg>'
  var label = document.createElement('span')
  a.appendChild(label)
  a.addEventListener('click', function () { if (window.TM && TM.app) TM.app() })

  function setText() {
    var jp = byHtml ? document.documentElement.lang === 'ja' : (/[ぁ-んァ-ヶ一-龠]/.test(again.textContent) || !again.textContent.trim())
    label.textContent = jp ? 'iPhoneアプリ版をダウンロード' : 'Get the iPhone app'
  }
  setText()
  new MutationObserver(setText).observe(again, { childList: true, characterData: true, subtree: true })

  var ref = document.getElementById('tmSupport')
  if (ref) ref.parentNode.insertBefore(a, ref)
  else again.parentElement.parentElement.appendChild(a)
})()
