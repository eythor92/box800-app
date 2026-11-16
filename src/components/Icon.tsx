const P: Record<string, string> = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  home: 'M3 10l9-6 9 6M5 10v10h14V10M9 20v-6h6v6',
  cal: 'M3 4h18v17H3zM3 9h18M8 2v4M16 2v4',
  dumb: 'M6.5 6.5l11 11M3 10l7-7M14 21l7-7M2 13l2 2M20 9l2 2',
  check: 'M3 4h15v15H3zM3 9h15M7 2v4M14 2v4M15.5 17.5l1.5 1.5 2.5-2.5',
  people: 'M6 4a3 3 0 1 0 6 0 3 3 0 1 0-6 0M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4a3 3 0 0 1 0 6M21 20c0-3-1.7-5.2-4-5.8',
  user: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21c0-4 3.6-7 8-7s8 3 8 7',
  clock: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M17 3l4 4L8 20H4v-4zM14 6l4 4',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-3-1-5-3-7 0 4-4 6-4 12 0 5 3 8 7 8z',
  star: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  reuse: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 1 0-14 0M20 20l-4-4',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  chart: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  plus: 'M12 5v14M5 12h14',
}

export function Icon({ name, size = 22, stroke = 1.8, color = 'currentColor', style }: { name: string; size?: number; stroke?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={name === 'dots' ? 3.4 : stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={P[name]} />
    </svg>
  )
}

export function Avatar({ src, name, size = 44, ring }: { src?: string | null; name: string; size?: number; ring?: string }) {
  const st: React.CSSProperties = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }
  return src
    ? <img className="avatar" src={src} alt="" style={st} />
    : <span className="avatar" style={{ ...st, fontSize: size * 0.33 }}>{name.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</span>
}
