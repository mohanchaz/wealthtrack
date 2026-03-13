interface Props {
  variant?: 'light' | 'dark' | 'hero'
  height?: number
  iconOnly?: boolean
}

export function INFolioLogo({ variant = 'hero', height = 36, iconOnly = false }: Props) {

  if (iconOnly) {
    return (
      <svg width={height} height={height} viewBox="0 0 100 100" fill="none"
        xmlns="http://www.w3.org/2000/svg" aria-label="INFolio">
        <defs>
          <linearGradient id="ig" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#0D4F4A"/>
            <stop offset="55%"  stopColor="#0F766E"/>
            <stop offset="100%" stopColor="#14B8A6"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#ig)"/>
        {/* Cloud: 3 bumps + flat base */}
        <circle cx="26" cy="62" r="22" fill="rgba(255,255,255,0.17)"/>
        <circle cx="48" cy="44" r="28" fill="rgba(255,255,255,0.17)"/>
        <circle cx="70" cy="56" r="22" fill="rgba(255,255,255,0.17)"/>
        <rect   x="4"  y="62" width="88" height="28" fill="rgba(255,255,255,0.17)"/>
        {/* C */}
        <text x="16" y="86" fontFamily="Inter,system-ui,sans-serif" fontWeight="800" fontSize="38" fill="#99F6E4">C</text>
        {/* Green dot — drawn last so it's always on top, fully inside viewBox */}
        <circle cx="80" cy="20" r="12" fill="#2ECC71"/>
      </svg>
    )
  }

  const nameColor = variant === 'light' ? '#1A1A1A' : '#FFFFFF'
  const tagColor  = variant === 'light' ? '#888888'
                  : variant === 'dark'  ? '#555555'
                  : 'rgba(255,255,255,0.45)'
  const fSize     = variant === 'hero' ? 34 : 32
  const vbW       = variant === 'hero' ? 340 : 290
  const width     = Math.round(height * (vbW / 68))

  return (
    <svg width={width} height={height} viewBox={`0 0 ${vbW} 68`} fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-label="INFolio">
      <defs>
        <linearGradient id="imark" x1="0" y1="5" x2="58" y2="63" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0D4F4A"/>
          <stop offset="55%"  stopColor="#0F766E"/>
          <stop offset="100%" stopColor="#14B8A6"/>
        </linearGradient>
      </defs>

      {/* Icon rounded square */}
      <rect x="0" y="5" width="58" height="58" rx="13" fill="url(#imark)"/>
      {/* Cloud: 3 bumps + flat base */}
      <circle cx="16" cy="40" r="13" fill="rgba(255,255,255,0.18)"/>
      <circle cx="29" cy="29" r="17" fill="rgba(255,255,255,0.18)"/>
      <circle cx="43" cy="36" r="13" fill="rgba(255,255,255,0.18)"/>
      <rect   x="3"  y="40" width="52" height="19" fill="rgba(255,255,255,0.18)"/>
      {/* C */}
      <text x="10" y="58" fontFamily="Inter,system-ui,sans-serif" fontWeight="800" fontSize="22" fill="#99F6E4">C</text>
      {/* Green dot inside icon — drawn last, on top */}
      <circle cx="49" cy="14" r="7" fill="#2ECC71"/>

      {/* INFolio. — dot on same baseline, same font-size */}
      <text fontFamily="Inter,system-ui,sans-serif" fontWeight="700" fontSize={fSize} letterSpacing="-0.5">
        <tspan x="72" y="50" fill={nameColor}>INFolio</tspan>
        <tspan fill="#2ECC71" dx="1" fontSize={fSize}>.</tspan>
      </text>

      {/* Tagline */}
      <text x="72" y="62" fontFamily="DM Sans,system-ui,sans-serif" fontSize="8.5" fill={tagColor} letterSpacing="2.5">
        PORTFOLIO INTELLIGENCE
      </text>
    </svg>
  )
}
