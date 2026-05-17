# The Masonry Modeler — Codebase Guide

## Project
Landing page for themasonrymodeler.com. Masonry estimating software.
Built with **Astro 5** (static output). Deploy the `dist/` directory.

## Dev commands
```
npm install       # first time
npm run dev       # localhost:4321
npm run build     # outputs dist/
npm run preview   # preview dist/ locally
```

## Structure
```
src/
  pages/index.astro          ← page composition (edit here to add sections)
  components/
    Layout.astro              ← <head>, meta, JSON-LD schema, fonts
    MasonXMonogram.astro      ← SVG <defs> — include once at top of body
    TitleBlock.astro          ← sticky drafting-style header
    Hero.astro                ← hero section with render viewport
    SectionDivider.astro      ← black bar with scale-mark borders
    ProofSection.astro        ← proof section template (extensible)
    RuleCard.astro            ← individual rule card
    RulesSection.astro        ← rules grid with header + all 8 rule cards
  styles/global.css           ← all CSS (custom properties, layout, components)
  assets/
    pump-station-hero.png     ← hero render (Astro-optimized, LCP image)
    corner-detail.png         ← lintel/bond beam proof image
public/
  robots.txt
  sitemap.xml
  google8e2eb7d3d8a4355e.html
  assets/                    ← any additional static images (bypasses Astro pipeline)
```

## Adding a new proof section
One component call in `src/pages/index.astro`:
```astro
import newRender from '../assets/new-render.png';

<SectionDivider number="05" label="The Rake Test" />
<ProofSection
  sectionNum="05"
  sectionLabel="The other thing nobody gets right"
  headlinePre="Now look at the"
  accentWord="rake"
  body1="First paragraph copy..."
  body2="Second paragraph copy (optional)."
  masonxQuote="MasonX foreman-voice quote here."
  image={newRender}
  imageAlt="Descriptive alt text for the render"
  imageCaption="Rake · running bond · corner"
  imageCredit="<strong>Powder River Masonry</strong> · MasonX"
  reverse={true}
/>
```
Drop the new image in `src/assets/` and import it. Astro handles WebP/AVIF optimization.

## Design language

**Aesthetic:** Hybrid drafting / field-built. Engineering grid meets job-site pragmatism.

### Typography
| Role | Family | Weight |
|------|--------|--------|
| Display / headings | Oswald | 700, 600 |
| Body / italic accents | Fraunces | 400, 600, 900 |
| Labels, stats, MasonX voice | JetBrains Mono | 400, 500, 700 |

Google Fonts loaded via `<link>` in Layout.astro with `display=swap` (applies `font-display: swap`).

### Color tokens (CSS custom properties)
| Token | Hex | Use |
|-------|-----|-----|
| `--terracotta` | `#b8451a` | Primary accent, CTAs, MasonX badge |
| `--terracotta-dark` | `#8a3413` | Hover states |
| `--navy` | `#1a2942` | Proof section background |
| `--navy-deep` | `#0e1828` | Proof section deep background |
| `--chalk` | `#f4f1e8` | Page background |
| `--ink` | `#181818` | Primary text, dark surfaces |
| `--concrete` | `#c8c3bb` | Muted / secondary text |
| `--concrete-light` | `#e8e3d8` | Hover backgrounds |
| `--mortar` | `#8a8378` | Labels, captions |
| `--grid` | `rgba(26,41,66,0.08)` | Blueprint grid overlay |

### Grid / texture
- 32px engineering grid overlay on hero and rules sections
- Drafting-style borders, corner marks, stamp labels
- Hard-edged box shadows (offset, no blur): `14px 14px 0 var(--terracotta)`

## MasonX — character brief
MasonX is the foreman who built the engine. Not a brand mascot.

- **Visual:** Hardhat SVG monogram (defined in `MasonXMonogram.astro` as `<symbol id="mx-monogram">`). Reference anywhere via `<use href="#mx-monogram"/>` inside `.mx-mark`.
- **Voice:** First-person, terse, field-authoritative. "I won't produce a cut under 4 inches. Ever."
- **Inverted variant:** Add `.inverted` class to `.mx-mark` for use on dark (navy) backgrounds.
- **Appears in:** header, hero speech bubble, proof section quotes, rules signature
- **Tone rule:** He explains *why* the rule exists, not what the software does.

## ProofSection template
Dark navy background (`--navy-deep`). Pattern: H2 headline with accent word → two Fraunces paragraphs → MasonX quote callout (JetBrains Mono, terracotta left border) → drafting-framed render image with caption.

Layouts alternate left/right via `reverse` prop for visual rhythm.

## Content rules
- **Never name competitors.** Let renders prove the difference.
- Rule card titles are MasonX first-person quotes. Keep that voice.
- Proof section H2s follow "Look at the X" / "Now watch the Y" pattern.
- Body copy uses Fraunces for warmth; JetBrains Mono only for numbers, labels, MasonX voice.
- "Masonry estimating software" must appear in the first 150 words of body copy for SEO.

## Production checklist
- [ ] Crop cursor out of corner-detail.png before shipping (visible in lower-left)
- [ ] Crop cursor out of pump-station-hero.png
- [ ] Verify meta description ≤155 chars in Layout.astro
- [ ] Submit sitemap.xml to Google Search Console (domain property already set up)
- [ ] Pitch IMI directory listing (imiweb.org/software-and-design-aids)
- [ ] Confirm og:image renders correctly (test with og:debugger)
- [ ] Validate JSON-LD schema at schema.org/validator

## SEO
- Title: set in Layout.astro `title` prop default
- Description: set in Layout.astro `description` prop default (≤155 chars)
- JSON-LD: SoftwareApplication + Organization + FAQPage (rules as Q&A) — all in Layout.astro
- og:image → /assets/pump-station-hero.png
