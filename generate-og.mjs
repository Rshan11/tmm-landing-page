// Generates public/assets/og-image.png (1200x630) for Open Graph / Twitter Cards.
// Run once: node generate-og.mjs
// Uses Sharp (bundled with Astro) — no extra dependencies needed.

import sharp from './node_modules/sharp/lib/index.js';
import { readFileSync, writeFileSync } from 'fs';

const W = 1200;
const H = 630;

// ── Overlay SVG ──────────────────────────────────────────────────────────────
// MX hardhat monogram (top-left) + charcoal bar + tagline (bottom)
const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">

  <!-- Bottom bar: charcoal -->
  <rect x="0" y="${H - 110}" width="${W}" height="110" fill="rgba(17,23,27,0.94)"/>

  <!-- Signal accent line above bar -->
  <rect x="0" y="${H - 112}" width="${W}" height="3" fill="#b83c36"/>

  <!-- Tagline -->
  <text
    x="40" y="${H - 52}"
    font-family="'Arial Black', 'Arial Bold', Arial, sans-serif"
    font-weight="900"
    font-size="32"
    letter-spacing="-0.5"
    fill="#f3f5f5"
    text-anchor="start"
  >MASONRY ESTIMATING SOFTWARE. BUILT BY A MASON.</text>

  <!-- Sub-label: JetBrains Mono style -->
  <text
    x="40" y="${H - 22}"
    font-family="'Courier New', Courier, monospace"
    font-weight="700"
    font-size="13"
    letter-spacing="2"
    fill="#ed8178"
    text-anchor="start"
  >FULLS. HALVES. CORNERS. COUNTED FROM THE FIRST CLICK.</text>

  <!-- MX hardhat monogram (top-left, 72px) -->
  <g transform="translate(32, 24) scale(2.0)">
    <!-- Hat dome -->
    <path d="M 4 24 Q 4 8, 20 6 Q 36 8, 36 24 L 32 24 Q 32 14, 20 12 Q 8 14, 8 24 Z" fill="#b83c36"/>
    <!-- Crown ridge -->
    <rect x="19" y="6" width="2" height="4" rx="1" fill="#b83c36"/>
    <!-- Brim -->
    <path d="M 2 24 L 38 24 L 38 28 Q 38 30, 36 30 L 4 30 Q 2 30, 2 28 Z" fill="#922d29"/>
    <!-- MX letters -->
    <text
      x="20" y="22"
      text-anchor="middle"
      font-family="Arial, sans-serif"
      font-weight="700"
      font-size="11"
      letter-spacing="1"
      fill="#f3f5f5"
    >MX</text>
  </g>

  <!-- "TMM" wordmark next to monogram -->
  <text
    x="120" y="80"
    font-family="'Arial Black', Arial, sans-serif"
    font-weight="900"
    font-size="28"
    letter-spacing="2"
    fill="#f3f5f5"
  >TMM</text>

</svg>
`;

// ── Compose ───────────────────────────────────────────────────────────────────
const overlayBuf = Buffer.from(overlay);

await sharp('src/assets/product/tmm-plan-view.jpg')
  .resize(W, H, { fit: 'cover', position: 'centre' })
  .composite([{ input: overlayBuf, top: 0, left: 0 }])
  .png({ quality: 90 })
  .toFile('public/assets/og-image.png');

console.log('✓ public/assets/og-image.png written (1200×630)');
