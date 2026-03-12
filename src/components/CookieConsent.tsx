import { useState, useEffect } from 'react'

const COOKIE_KEY = 'wealthtrack_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(COOKIE_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(COOKIE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ fontFamily: 'Mulish, system-ui, sans-serif' }}
    >
      <div
        className="mx-auto max-w-5xl mb-3 mx-3 sm:mx-6 rounded-2xl border border-[#E0DDD6] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        {/* Icon + text */}
        <div className="flex items-start sm:items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#F5F4F0] border border-[#E0DDD6] flex items-center justify-center text-sm shrink-0">
            🍪
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#1A1A1A] mb-0.5">We use cookies for authentication only</p>
            <p className="text-[11px] text-[#767676] leading-relaxed">
              WealthTrack uses strictly necessary cookies to keep you signed in. No tracking, no analytics, no ads — ever.{' '}
              <span className="text-[#1A1A1A] font-semibold">Chaz Tech Ltd.</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
          <a
            href="https://chaztech.co.uk/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-[#767676] hover:text-[#1A1A1A] transition-colors underline underline-offset-2"
          >
            Privacy Policy
          </a>
          <button
            onClick={dismiss}
            className="h-8 px-4 rounded-xl bg-[#1A1A1A] hover:bg-[#333] text-white text-[11px] font-bold transition-all shadow-sm active:scale-[0.97]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
