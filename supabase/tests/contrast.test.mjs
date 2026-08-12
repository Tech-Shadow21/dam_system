/**
 * TICKET-020 verification: WCAG AA contrast across the "Fortified Archive"
 * palette, computed rather than eyeballed.
 *
 * Run: node supabase/tests/contrast.test.mjs
 *
 * Thresholds: 4.5:1 for normal text, 3:1 for large text and for non-text UI
 * components whose boundary conveys state (WCAG 1.4.11).
 */

const hexToRgb = (h) => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
}
const linearize = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const luminance = (h) => {
  const [r, g, b] = hexToRgb(h).map(linearize)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** Flattens an alpha colour over a solid background — WCAG judges rendered pixels. */
const over = (fg, alpha, bg) => {
  const f = hexToRgb(fg)
  const b = hexToRgb(bg)
  return (
    '#' +
    f
      .map((c, i) => Math.round((c * alpha + b[i] * (1 - alpha)) * 255)
        .toString(16)
        .padStart(2, '0'))
      .join('')
  )
}

const PAIRS = [
  // --- Body text ---
  ['Text primary on canvas', '#1A1D23', '#F7F6F3', 'text'],
  ['Text primary on surface', '#1A1D23', '#FFFFFF', 'text'],
  ['Text secondary on canvas', '#5B6472', '#F7F6F3', 'text'],
  ['Text secondary on surface', '#5B6472', '#FFFFFF', 'text'],
  ['Placeholder ink on surface', '#5B6472', '#FFFFFF', 'text'],

  // --- Buttons / nav ---
  ['White on navy (primary button)', '#FFFFFF', '#1B2A4A', 'text'],
  ['Navy on brass (hero hover)', '#1B2A4A', '#C9A24B', 'text'],
  ['Brass on navy (active nav item)', '#C9A24B', '#1B2A4A', 'text'],
  ['Sidebar inactive item (white/70)', over('#FFFFFF', 0.7, '#1B2A4A'), '#1B2A4A', 'text'],
  ['Sidebar section label (white/40)', over('#FFFFFF', 0.4, '#1B2A4A'), '#1B2A4A', 'large'],

  // --- Semantic text ---
  ['Error text on surface', '#C4453D', '#FFFFFF', 'text'],
  ['Error text on canvas', '#C4453D', '#F7F6F3', 'text'],
  ['Success text on surface', '#2F7A5C', '#FFFFFF', 'text'],
  // The spec's warning #C98A2C only reaches 2.93:1 on white, so it is never used
  // for text or meaningful icons; `warning-ink` is the AA-compliant substitute.
  ['Warning ink as text on surface', '#8A5E1B', '#FFFFFF', 'text'],
  ['Badge accent text', '#8A6D28', '#FFFFFF', 'text'],
  ['Badge warning text', '#8A5E1B', '#FFFFFF', 'text'],

  // --- Dark mode chrome ---
  ['Dark mode text on dark canvas', '#E8E6E1', '#0E1116', 'text'],
  ['Dark mode text on dark surface', '#E8E6E1', '#161B22', 'text'],

  // --- Non-text UI ---
  ['Focus outline (navy) vs canvas', '#1B2A4A', '#F7F6F3', 'ui'],
  ['Focus outline (navy) vs surface', '#1B2A4A', '#FFFFFF', 'ui'],
  ['Progress track border vs surface', '#5B6472', '#FFFFFF', 'ui'],
]

/**
 * Documented, deliberate exceptions. Recorded here rather than silently omitted
 * so the trade-off is auditable.
 */
const ACCEPTED_EXCEPTIONS = [
  {
    name: 'Divider/border #E2E0DA on #FFFFFF (1.32:1)',
    why:
      'An explicit value in 04-frontend-specification.md. Kept as specified. It is ' +
      'not the sole means of identifying any control: every input carries a ' +
      'persistent visible label, and the focus ring is navy at 13.2:1. Raising it ' +
      'is a design-system decision for the founder, not a unilateral change.',
  },
  {
    name: 'Warning fill #C98A2C as border/background tint (2.93:1)',
    why:
      'Used only as a decorative container accent (SetupNotice border and 5% ' +
      'background wash). The same information is carried by a heading, an ' +
      'AA-compliant icon colour and body text, so no state depends on it.',
  },
  {
    name: 'Selected asset-card border (brass #C9A24B on white, 2.40:1)',
    why:
      '04-frontend-specification.md mandates a 2px brass border for the selected ' +
      'state specifically to avoid a colour fill. Selection is not conveyed by ' +
      'that border alone: the row/card checkbox is checked and becomes ' +
      'permanently visible when selected, so the state is exposed both visually ' +
      'and to assistive technology independent of colour.',
  },
  {
    name: 'Brand accent progress fill vs track (1.82:1)',
    why:
      'The fill is a brand colour and must stay. The track now carries a ' +
      'solid #5B6472 border (5.98:1) so the component boundary is perceivable, and the value ' +
      'is always stated in adjacent text plus role="progressbar" aria-valuenow.',
  },
]

let failures = 0
let passes = 0

console.log('TICKET-020 — WCAG AA contrast\n')
for (const [name, fg, bg, kind] of PAIRS) {
  const r = ratio(fg, bg)
  const required = kind === 'text' ? 4.5 : 3.0
  const ok = r >= required
  if (ok) passes += 1
  else failures += 1
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(6)}:1  (needs ${required})  ${name}`
  )
}

console.log('\nDocumented exceptions (not enforced):')
for (const e of ACCEPTED_EXCEPTIONS) {
  console.log(`  - ${e.name}\n      ${e.why.replace(/\s+/g, ' ')}`)
}

console.log('\n' + '-'.repeat(60))
if (failures === 0) {
  console.log(`ALL CONTRAST CHECKS PASSED (${passes})`)
  process.exit(0)
}
console.log(`${passes} passed, ${failures} FAILED`)
process.exit(1)
