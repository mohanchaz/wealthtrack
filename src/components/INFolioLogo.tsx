interface Props {
  variant?: 'light' | 'dark' | 'hero'
  height?: number
  iconOnly?: boolean
}

/**
 * INFolio brand logo
 * variant='hero'  — white wordmark (for teal hero banners / gradient bg)
 * variant='light' — ink wordmark (for white/off-white surfaces)
 * variant='dark'  — white wordmark (for dark/ink surfaces)
 * iconOnly        — renders just the cloud C mark with no text
 */
export function INFolioLogo({ variant = 'hero', height = 36, iconOnly = false }: Props) {
  const nameColor = variant === 'light' ? '#1A1A1A' : '#FFFFFF'
  const cloudFill = variant === 'light' ? '#0F766E'  : 'rgba(255,255,255,0.18)'
  const cColor    = variant === 'light' ? '#FFFFFF'  : '#99F6E4'
  const tagColor  = variant === 'light' ? '#767676'
                  : variant === 'dark'  ? '#555555'
                  : 'rgba(153,246,228,0.6)'

  if (iconOnly) {
    // Square icon mark — cloud C + green dot, teal gradient bg
    const s = height
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="INFolio">
        <rect width="100" height="100" rx="22" fill="url(#iconBg)"/>
        <circle cx="28"  cy="58" r="19"  fill="#0B5E58"/>
        <circle cx="42"  cy="40" r="22"  fill="#0B5E58"/>
        <circle cx="62"  cy="50" r="20"  fill="#0C6960"/>
        <circle cx="77"  cy="58" r="17"  fill="#0C6960"/>
        <rect   x="9"    y="58"  width="74" height="28" fill="#0B5E58"/>
        <text x="26" y="82" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="37" fill="#99F6E4">C</text>
        <circle cx="84" cy="16" r="10" fill="#2ECC71"/>
        <defs>
          <linearGradient id="iconBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stop-color="#0D4F4A"/>
            <stop offset="55%"  stop-color="#0F766E"/>
            <stop offset="100%" stop-color="#14B8A6"/>
          </linearGradient>
        </defs>
      </svg>
    )
  }

  // Full horizontal logo — viewBox 280×58
  const width = Math.round(height * (280 / 58))
  return (
    <svg width={width} height={height} viewBox="0 0 280 58" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="INFolio">
      {/* Cloud C mark */}
      <ellipse cx="16"  cy="28" rx="13" ry="13" fill={cloudFill}/>
      <ellipse cx="26"  cy="17" rx="14" ry="14" fill={cloudFill}/>
      <ellipse cx="39"  cy="24" rx="12" ry="12" fill={cloudFill}/>
      <ellipse cx="49"  cy="30" rx="10" ry="10" fill={cloudFill}/>
      <rect x="3" y="28" width="56" height="14" fill={cloudFill}/>
      {/* C letterform */}
      <text x="19" y="42" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="18" fill={cColor}>C</text>
      {/* INFolio. wordmark */}
      <text font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="30" letter-spacing="-0.8">
        <tspan x="68" y="42" fill={nameColor}>INFolio</tspan>
        <tspan fill="#2ECC71" dx="1" font-size="38" dy="5">.</tspan>
      </text>
      {/* Tagline */}
      <text x="68" y="54" font-family="DM Sans,system-ui,sans-serif" font-size="8.5" fill={tagColor} letter-spacing="2">
        PORTFOLIO INTELLIGENCE
      </text>
    </svg>
  )
}
