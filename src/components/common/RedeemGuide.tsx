import { useState } from 'react'

export type RedeemAssetType =
  | 'zerodha-stocks' | 'zerodha-mf' | 'aionion-stocks' | 'amc-mf'
  | 'fd' | 'ef' | 'bonds' | 'foreign-stocks' | 'crypto' | 'bank-savings'

interface Step { n: string; title: string; desc: string; t?: string; fast?: boolean; slow?: boolean; bank?: boolean }
interface GuideData { steps: Step[]; warn?: string | null; tip?: string | null }

const GUIDES: Record<RedeemAssetType, GuideData> = {
  'zerodha-stocks': {
    steps: [
      { n:'1', title:'Open Kite app or website', desc:'Log in to kite.zerodha.com or the Kite mobile app.' },
      { n:'2', title:'Go to Portfolio → Holdings', desc:'Navigate to the Holdings tab — these are your delivery (long-term) shares.' },
      { n:'3', title:'Select stock → click Sell', desc:'Enter quantity, choose Market or Limit order and confirm. Trading hours: 9:15 AM – 3:30 PM IST.', t:'Same day', fast:true },
      { n:'4', title:'Proceeds credited to Zerodha trading account', desc:'Sale amount after brokerage and STT credited to your Zerodha funds balance.', t:'1 business day' },
      { n:'5', title:'Withdraw to bank', desc:'Kite → Funds → Withdraw. Submit before 11 AM for same-day transfer.', t:'Same or next day' },
      { n:'🏦', title:'Money in your bank account', desc:'IMPS from Zerodha — funds appear within minutes.', t:'Instant', fast:true, bank:true },
    ],
    warn: 'STT 0.1% on delivery sell. STCG 20% if held < 1 year. LTCG 12.5% on gains above ₹1.25L if held > 1 year.',
    tip: null,
  },
  'zerodha-mf': {
    steps: [
      { n:'1', title:'Open Coin app or website', desc:'Log in to coin.zerodha.com or the Coin mobile app.' },
      { n:'2', title:'Go to Portfolio → select fund', desc:'Find the mutual fund you want to redeem.' },
      { n:'3', title:'Click Redeem', desc:'Enter units or amount. Confirm with Zerodha PIN. Submit before 3 PM for same-day NAV.' },
      { n:'4', title:'Coin submits request to AMC', desc:'Zerodha forwards the request to the AMC. Your role ends here — no further action needed.', t:'Same day' },
      { n:'5', title:'AMC processes at applicable NAV', desc:'Equity funds: 2–3 business days. Debt funds: 1 business day.', t:'1–3 business days', slow:true },
      { n:'🏦', title:'AMC credits directly to your bank account', desc:'Proceeds sent directly from the AMC to your bank account registered with Coin — does NOT go via Zerodha trading account.', t:'2–3 business days', slow:true, bank:true },
    ],
    warn: 'STCG 20% if held < 1 year. LTCG 12.5% above ₹1.25L if held > 1 year. Exit load typically 1% if redeemed within 1 year — check fund factsheet.',
    tip: 'Pause your SIP on Coin separately before redeeming.',
  },
  'aionion-stocks': {
    steps: [
      { n:'1', title:'Open the Aionion app', desc:'Log in to the Aionion mobile app or web portal.' },
      { n:'2', title:'Go to Portfolio → Holdings', desc:'Navigate to your holdings in your Aionion demat account.' },
      { n:'3', title:'Select stock → tap Sell', desc:'Enter quantity, choose Market or Limit order and confirm. Trading hours: 9:15 AM – 3:30 PM IST.', t:'Same day', fast:true },
      { n:'4', title:'Proceeds credited to Aionion trading account', desc:'Sale amount after brokerage and STT credited to your Aionion funds balance.', t:'1 business day' },
      { n:'5', title:'Withdraw to bank', desc:'Aionion app → Funds → Withdraw. Enter amount and submit.', t:'Same or next day' },
      { n:'🏦', title:'Money in your bank account', desc:'IMPS/NEFT from Aionion to your registered bank account.', t:'Instant', fast:true, bank:true },
    ],
    warn: 'STT 0.1% on delivery sell. STCG 20% if held < 1 year. LTCG 12.5% on gains above ₹1.25L if held > 1 year.',
    tip: null,
  },
  'amc-mf': {
    steps: [
      { n:'1', title:'Log in to AMC portal', desc:'Go to nipponindiaim.com for Nippon MF or tatamutualfund.com for Tata MF. Or use mfcentral.in for all AMCs.' },
      { n:'2', title:'Enter PAN or folio number', desc:'Use your PAN or folio number from WealthTrack to locate your holdings.' },
      { n:'3', title:'Select fund → click Redeem', desc:'Enter units or amount and select your bank account for payout.' },
      { n:'4', title:'OTP verification', desc:'Confirm with OTP sent to your registered mobile number.' },
      { n:'5', title:'AMC processes at NAV', desc:'Same-day NAV if submitted before 3 PM.', t:'Same day' },
      { n:'🏦', title:'AMC credits directly to your bank account', desc:'Proceeds sent directly from Nippon / Tata MF to your registered bank account via NEFT/RTGS.', t:'2–3 business days', slow:true, bank:true },
    ],
    warn: 'Exit load varies by fund — check factsheet before redeeming. SIP auto-debit continues unless paused separately.',
    tip: 'MFCentral.in lets you redeem from Nippon, Tata, and all AMCs in one place using your PAN.',
  },
  'fd': {
    steps: [
      { n:'1', title:'Note your maturity dates', desc:'Check maturity dates in WealthTrack for your HDFC Bank and Equitas Bank FDs. Best to hold until maturity.' },
      { n:'2', title:'On maturity — HDFC Bank', desc:'HDFC Bank automatically credits principal + interest to your linked savings account. You will receive an SMS and email confirmation.', t:'Maturity date', fast:true },
      { n:'3', title:'On maturity — Equitas Bank', desc:'Equitas Bank automatically credits principal + interest to your linked savings account on the maturity date.', t:'Maturity date', fast:true },
      { n:'🏦', title:'Money in your savings account', desc:'Credited automatically by the bank on maturity. No login or withdrawal step needed.', t:'Automatic', fast:true, bank:true },
    ],
    warn: 'TDS at 10% if total FD interest exceeds ₹40,000/year. Submit Form 15G/H at start of each financial year if income is below taxable limit.',
    tip: 'Set a calendar reminder a week before each FD matures to decide whether to reinvest or redeploy.',
  },
  'ef': {
    steps: [
      { n:'1', title:'Your emergency fund is in an HDFC Bank FD', desc:'Hold until maturity. HDFC Bank will automatically credit principal + interest to your linked savings account on the maturity date.' },
      { n:'2', title:'On maturity date', desc:'HDFC Bank credits funds automatically to your linked savings account with SMS and email confirmation.', t:'Maturity date', fast:true },
      { n:'3', title:'Funds available in HDFC savings account', desc:'Instantly accessible via UPI, IMPS or debit card.', t:'Instant', fast:true },
      { n:'🏦', title:'Money in your HDFC savings account', desc:'Credited automatically on maturity. Transfer anywhere via IMPS/UPI instantly.', t:'Automatic', fast:true, bank:true },
    ],
    warn: null,
    tip: 'Only break the FD early in a genuine emergency — premature closure attracts a 0.5–1% interest penalty.',
  },
  'bonds': {
    steps: [
      { n:'1', title:'Best approach: hold to maturity', desc:'If purchased via GoldenPI, hold until the maturity date. The issuer registrar (NSDL/CAMS) automatically credits principal + final coupon to your bank account.' },
      { n:'2', title:'Maturity credit is fully automatic', desc:'GoldenPI and the bond registrar handle the payout. You will receive a bank credit confirmation on the maturity date.', t:'Maturity date', fast:true },
      { n:'🏦', title:'Money in your bank account', desc:'Principal + final coupon credited automatically by the issuer registrar. No withdrawal step needed.', t:'Automatic', fast:true, bank:true },
    ],
    warn: 'If you need to exit early, GoldenPI has a secondary market but liquidity can be limited. Early exit may result in a capital loss.',
    tip: 'Holding to maturity gives you the full promised yield with zero effort.',
  },
  'foreign-stocks': {
    steps: [
      { n:'1', title:'Open Trading 212 app', desc:'Log in to the Trading 212 app or trading212.com. US market: 2:30 PM – 9:00 PM IST. UK market: 8:00 AM – 4:30 PM IST.' },
      { n:'2', title:'Portfolio → find stock → Sell', desc:'Tap the stock, tap Sell, enter quantity, choose Market or Limit order, confirm.', t:'Same day', fast:true },
      { n:'3', title:'Proceeds in Trading 212 free funds', desc:'GBP credited to your Trading 212 balance after settlement.', t:'2 business days' },
      { n:'4', title:'Withdraw GBP to HSBC', desc:'Trading 212 → Menu → Withdraw funds → select HSBC account → confirm. Sent via Faster Payments.', t:'1–2 business days' },
      { n:'5', title:'GBP arrives in HSBC', desc:'GBP credited to your HSBC current account via Faster Payments.', t:'Instant once sent', fast:true },
      { n:'6', title:'Convert GBP → INR via Aspora', desc:'Send GBP from HSBC to Aspora. Create a GBP → INR transfer to your Indian bank account.', t:'Same day', fast:true },
      { n:'🏦', title:'Money in your Indian bank account (INR)', desc:'INR credited to your Indian savings account via Aspora. Keep LRS annual limit of $250,000 in mind.', t:'Same day', fast:true, bank:true },
    ],
    warn: 'Trading 212 charges 0.15% FX fee if stock is in USD/EUR. Gains taxable in India — STCG at slab rate if held < 2 years, LTCG 12.5% if held > 2 years.',
    tip: 'Always use Aspora from HSBC for GBP → INR — much better rates than HSBC\'s own international transfer.',
  },
  'crypto': {
    steps: [
      { n:'1', title:'Open Kraken or Revolut', desc:'Log in to Kraken (pro.kraken.com or app) or the Revolut app.' },
      { n:'2', title:'Kraken: Trade → Sell', desc:'Select pair (e.g. BTC/GBP), enter quantity, place Sell order. GBP credited to Kraken balance instantly.', t:'Instant', fast:true },
      { n:'3', title:'Revolut: tap crypto → Sell', desc:'Revolut → Crypto → tap asset → Sell → confirm. Proceeds in Revolut GBP balance instantly.', t:'Instant', fast:true },
      { n:'4', title:'Withdraw GBP to HSBC', desc:'Kraken → Funding → Withdraw GBP → HSBC details (1 business day). Revolut → Transfer → HSBC via Faster Payments (instant).', t:'Instant (Revolut) / 1 business day (Kraken)' },
      { n:'5', title:'GBP arrives in HSBC', desc:'GBP credited to your HSBC current account.', t:'Instant once sent', fast:true },
      { n:'6', title:'Convert GBP → INR via Aspora', desc:'Send GBP from HSBC to Aspora. Create GBP → INR transfer to your Indian bank account.', t:'Same day', fast:true },
      { n:'🏦', title:'Money in your Indian bank account (INR)', desc:'INR credited to your Indian savings account via Aspora.', t:'Same day', fast:true, bank:true },
    ],
    warn: 'UK Capital Gains Tax (CGT) applies — basic rate 18%, higher rate 24%. Annual CGT allowance £3,000. Keep full records for Self Assessment.',
    tip: 'Revolut → HSBC via Faster Payments is instant. Use Aspora from HSBC for the best GBP → INR rate.',
  },
  'bank-savings': {
    steps: [
      { n:'1', title:'Log in to Lloyds Bank or First Direct', desc:'Open the Lloyds Bank app or First Direct app / firstdirect.com.' },
      { n:'2', title:'For UK transfer: use Faster Payments', desc:'Instant, free, available 24/7 to any UK bank account.', t:'Instant', fast:true },
      { n:'3', title:'For India transfer: send GBP to Aspora', desc:'Transfer GBP from Lloyds or First Direct to Aspora via Faster Payments. Arrives in seconds.' },
      { n:'4', title:'Create GBP → INR transfer on Aspora', desc:'Set up transfer to your Indian bank account (IFSC + account number). Aspora shows exact rate upfront.', t:'Few minutes' },
      { n:'5', title:'Aspora converts and sends INR', desc:'Aspora converts at a competitive rate and sends INR directly to your Indian savings account.', t:'Same day', fast:true },
      { n:'🏦', title:'Money in your Indian bank account (INR)', desc:'INR credited to your Indian savings account. For large transfers, Lloyds or First Direct may request source of funds documentation.', t:'Same day', fast:true, bank:true },
    ],
    warn: null,
    tip: 'First Direct is generally faster for international transfers than Lloyds. Both work seamlessly with Aspora for GBP → INR.',
  },
}

function TimeBadge({ step }: { step: Step }) {
  if (!step.t) return null
  const cls = step.fast
    ? 'bg-green/10 text-green2'
    : step.slow
      ? 'bg-amber/10 text-amber2'
      : 'bg-surface2 text-textmut'
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cls} shrink-0 whitespace-nowrap`}>
      {step.t}
    </span>
  )
}

export function RedeemGuide({ assetType }: { assetType: RedeemAssetType }) {
  const [open, setOpen] = useState(false)
  const guide = GUIDES[assetType]

  return (
    <div className="relative">
      {/* Trigger — pure teal text span, no button element */}
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none"
        style={{ color: '#0F766E' }}
      >
        {/* Curved arrow icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
        </svg>
        <span>How to redeem</span>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <polyline points="2 3 5 7 8 3" />
        </svg>
      </span>

      {/* Panel — absolute, drops below the header row */}
      {open && (
        <div className="absolute right-0 top-7 z-40 w-[min(520px,90vw)] bg-[#F7FDFB] border border-[#C8E8E4] rounded-2xl p-4 shadow-xl animate-fade-in">
          <div className="flex flex-col">
            {guide.steps.map((step, i) => (
              <div key={i} className="flex gap-3 py-1.5 relative">
                {i < guide.steps.length - 1 && (
                  <div className="absolute left-[11px] top-7 bottom-0 w-px bg-[#C8E8E4]" />
                )}
                <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5
                  ${step.bank ? 'bg-green/15 text-green2' : 'bg-[#CCE9E4] text-[#0F766E]'}`}>
                  {step.bank ? '🏦' : step.n}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-textprim">{step.title}</span>
                    <TimeBadge step={step} />
                  </div>
                  <p className="text-[11px] text-textsec mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {guide.warn && (
            <div className="flex gap-2 mt-3 bg-amber/8 border border-amber/20 rounded-xl px-3 py-2.5">
              <span className="text-amber2 text-[11px] shrink-0 mt-0.5">⚠</span>
              <p className="text-[11px] text-amber2 leading-relaxed">
                <span className="font-bold">Tax & charges: </span>{guide.warn}
              </p>
            </div>
          )}
          {guide.tip && (
            <div className="flex gap-2 mt-2 bg-green/8 border border-green/20 rounded-xl px-3 py-2.5">
              <span className="text-green2 text-[11px] shrink-0 mt-0.5">💡</span>
              <p className="text-[11px] text-green2 leading-relaxed">{guide.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
