# The Masonry Modeler — Codebase Guide

## Project
Landing page for themasonrymodeler.com. Masonry estimating software.
Built with **Astro 5** (static output). Deployed to **Cloudflare Pages** — ship the `dist/` directory.

## Dev commands
```
npm install                # first time
npm run dev                # localhost:4321
npm run build              # outputs dist/ (sitemap-index.xml is auto-generated here)
npm run preview            # preview dist/ locally
node generate-og.mjs       # regenerate public/assets/og-image.png (only when hero changes)
```

No test runner, no linter, no formatter wired up. Astro's build is the only gate.

## Structure
```
src/
  pages/
    index.astro                      ← homepage composition
    cmu-block-count.astro            ← SEO landing page
    bond-beam-estimating.astro       ← SEO landing page
    masonry-takeoff-accuracy.astro   ← SEO landing page
    blog/
      index.astro                    ← post listing
      why-i-built-this.astro         ← founder story (B1.1)
  components/
    Layout.astro                     ← <head>, meta, OG/Twitter, JSON-LD, fonts. Accepts title/description/canonical + named slot="head" for per-page JSON-LD.
    MasonXMonogram.astro             ← SVG <defs> for the hardhat symbol. Include once per page.
    TitleBlock.astro                 ← sticky drafting-style header. Props: sheet, ctaLabel, ctaHref.
    Hero.astro                       ← homepage hero + Formspree waitlist form (action: formspree.io/f/mykvgeld)
    SectionDivider.astro             ← black bar with scale-mark borders (number + label + "Section")
    ProofSection.astro               ← homepage proof template (text + drafting-framed render)
    RuleCard.astro                   ← individual rule card
    RulesSection.astro               ← rules grid + all 8 rule cards (data lives in this file)
    FAQSection.astro                 ← FAQ block (used on homepage and every SEO page)
    PageHero.astro                   ← SEO/blog page hero (kicker + h1 + lead)
    PageCTA.astro                    ← bottom-of-page waitlist CTA (links back to /#waitlist)
  styles/global.css                  ← ALL CSS (custom properties + every component)
  assets/
    pump-station-hero.png            ← hero render (Astro-optimized, LCP image)
    corner-detail.png                ← lintel/bond beam proof image
public/                              ← copied verbatim to dist/ root
  favicon.svg
  _headers                           ← Cloudflare Pages cache rules (/_astro/* immutable)
  robots.txt                         ← points to sitemap-index.xml
  google8e2eb7d3d8a4355e.html        ← Google Search Console verification
  assets/
    og-image.png                     ← 1200×630 OG card (built by generate-og.mjs)
    pump-station-hero.png            ← duplicated for direct URL access (used by JSON-LD og:image fallbacks)
generate-og.mjs                      ← one-shot Sharp script that composites the OG image
```

`@astrojs/sitemap` (configured in `astro.config.mjs`) emits `sitemap-index.xml` + `sitemap-0.xml` into `dist/` at build time. The root-level `sitemap.xml` and `robots.txt` files are vestigial — only `public/` ships.

## Page types

### Homepage (`pages/index.astro`)
Composition only. Imports the components, defines `faqItems`, injects a FAQPage JSON-LD into Layout's `head` slot. Renders: `MasonXMonogram → TitleBlock → Hero → SectionDivider → ProofSection ×2 → SectionDivider → RulesSection → SectionDivider → FAQSection`.

### SEO landing pages (`pages/<slug>.astro`)
All three follow the same shape. Pattern:
```astro
---
import Layout from '../components/Layout.astro';
import MasonXMonogram from '../components/MasonXMonogram.astro';
import TitleBlock from '../components/TitleBlock.astro';
import PageHero from '../components/PageHero.astro';
import PageCTA from '../components/PageCTA.astro';
import FAQSection from '../components/FAQSection.astro';

const title = '...';        // <70 chars, ends with "| The Masonry Modeler"
const description = '...';  // ≤155 chars
const canonical = 'https://themasonrymodeler.com/<slug>';

const faqItems = [ { question, answer }, ... ];   // 4 items, MasonX-tone answers
const schema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(item => ({
    "@type": "Question",
    "name": item.question,
    "acceptedAnswer": { "@type": "Answer", "text": item.answer },
  })),
};
---
<Layout title={title} description={description} canonical={canonical}>
  <Fragment slot="head">
    <script type="application/ld+json" set:html={JSON.stringify(schema)} />
  </Fragment>

  <MasonXMonogram />
  <TitleBlock />
  <PageHero kicker="..." headline="..." lead="..." />

  <section class="page-section">
    <div class="page-section-inner">
      <h2>...</h2>
      <p>...</p>
      <!-- Optional: .code-diagram, .comparison-block, .stat-block -->
    </div>
  </section>

  <section class="page-section page-section-dark">     <!-- alternate light/dark -->
    <div class="page-section-inner"> ... </div>
  </section>

  <FAQSection items={faqItems} sectionNum="FAQ" label="..." headline="..." />
  <PageCTA headline="..." body="..." />
</Layout>
```

Available content blocks (styled in `global.css`):
- `.page-section` / `.page-section-dark` — alternating background sections
- `.comparison-block` with two `.comparison-col`s — "what you produce" vs. "what TMM produces"
- `.stat-block` — large numeric callouts
- `.code-diagram` — monospace ASCII diagrams with `.bright` / `.highlight` / `.dim` spans

### Blog (`pages/blog/`)
Sheet numbering convention: `B0 — Blog` for the index, `B1.1`, `B1.2`, … for posts. Posts use `.blog-post-hero` + `<article class="blog-post-body">`. Index uses `.blog-index-section` with `.blog-post-card` items.

## Adding a new proof section (homepage)
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
Drop the new image in `src/assets/` and import it — Astro handles WebP/AVIF optimization via the Sharp service.

## Adding a new SEO landing page
1. Create `src/pages/<slug>.astro` following the template above.
2. Pick a target keyword phrase and put it in the title, lead, and an H2.
3. Write 4 FAQ items in MasonX voice (terse, first-person where natural, why-not-what).
4. Mention "masonry estimating software" in the first 150 words of body copy.
5. End with `<PageCTA />` — its default copy is fine; override only if the page has a specific angle.
6. Sitemap entry generates automatically on next `npm run build`.

## TitleBlock sheet numbers
Drafting convention. Default `sheet="A1.0 — Home"`. Override per page:
- Homepage: default
- SEO pages: don't override (they use the home sheet number — keep the header consistent)
- Blog index: `sheet="B0 — Blog"`
- Blog posts: `sheet="B1.1 — Why I Built This"`, `B1.2 — …`

## Design language

**Aesthetic:** Hybrid drafting / field-built. Engineering grid meets job-site pragmatism.

### Typography
| Role | Family | Weight |
|------|--------|--------|
| Display / headings | Oswald | 500, 600, 700 |
| Body / italic accents | Fraunces | 400, 600, 900 |
| Labels, stats, MasonX voice | JetBrains Mono | 400, 500, 700 |

Google Fonts loaded via `<link>` in `Layout.astro` with `display=swap`.

### Color tokens (CSS custom properties — defined at the top of `global.css`)
| Token | Hex | Use |
|-------|-----|-----|
| `--terracotta` | `#b8451a` | Primary accent, CTAs, MasonX badge |
| `--terracotta-dark` | `#8a3413` | Hover states |
| `--navy` | `#1a2942` | Proof section background |
| `--navy-deep` | `#0e1828` | Proof section deep background, dark page sections |
| `--chalk` | `#f4f1e8` | Page background, dark-bg text |
| `--ink` | `#181818` | Primary text, dark surfaces |
| `--concrete` | `#c8c3bb` | Muted / secondary text |
| `--concrete-light` | `#e8e3d8` | Hover backgrounds |
| `--mortar` | `#8a8378` | Labels, captions |
| `--grid` | `rgba(26,41,66,0.08)` | Blueprint grid overlay |

### Grid / texture
- 32px engineering grid overlay on hero and rules sections
- Drafting-style borders, corner marks, stamp labels
- Hard-edged box shadows (offset, no blur): `14px 14px 0 var(--terracotta)`

### `global.css` section map
Major comment-block headers, in order: `TITLE BLOCK HEADER`, `MASONX MONOGRAM`, `MASONX SIGNATURE LINE`, `HERO`, `SECTION DIVIDER`, `SECTION NUMBER BADGE`, `PROOF SECTIONS`, `RULES SECTION`, `RULE CARD`, `HERO KICKER`, `LANDING PAGE HERO`, `LANDING PAGE CONTENT`, `COMPARISON BLOCK`, `STAT BLOCK`, `CODE DIAGRAM`, `PAGE CTA`, `FAQ SECTION`, `BLOG`, `RESPONSIVE`. Add new sections at the bottom (before `RESPONSIVE`) with the same banner style.

## MasonX — character brief
MasonX is the foreman who built the engine. Not a brand mascot.

- **Visual:** Hardhat SVG monogram (defined in `MasonXMonogram.astro` as `<symbol id="mx-monogram">`). Reference anywhere via `<use href="#mx-monogram"/>` inside `.mx-mark`.
- **Voice:** First-person, terse, field-authoritative. "I won't produce a cut under 4 inches. Ever."
- **Inverted variant:** Add `.inverted` class to `.mx-mark` for use on dark (navy) backgrounds.
- **Appears in:** header, hero speech bubble, proof section quotes, rules signature
- **Tone rule:** He explains *why* the rule exists, not what the software does.

## ProofSection template
Dark navy background (`--navy-deep`). Pattern: H2 headline with accent word → one or two Fraunces paragraphs → MasonX quote callout (JetBrains Mono, terracotta left border) → drafting-framed render image with caption + credit.

Layouts alternate left/right via `reverse` prop for visual rhythm.

## Waitlist form
Homepage `Hero.astro` posts to **Formspree** (`https://formspree.io/f/mykvgeld`) with a vanilla `fetch` submit handler. On success it hides the form and shows `#waitlist-success`. The form anchor is `#waitlist`, which is what `PageCTA` links back to from interior pages.

## SEO
- **Per-page:** `Layout` props (`title`, `description`, `canonical`) — set on every page. Defaults are tuned for the homepage.
- **OG/Twitter card:** `/assets/og-image.png` (1200×630). Regenerate with `node generate-og.mjs` whenever `pump-station-hero.png` changes.
- **Global JSON-LD** in `Layout.astro` `<head>`: SoftwareApplication + Organization (two separate `<script>` blocks).
- **Per-page JSON-LD** via the `slot="head"` named slot: every page that has FAQs injects a FAQPage block.
- **Sitemap:** auto-generated by `@astrojs/sitemap`. `public/robots.txt` points to `/sitemap-index.xml`.
- **Favicon:** `public/favicon.svg` (SVG only — no PNG fallbacks needed for modern browsers).
- **Keyword rule:** "masonry estimating software" must appear in the first 150 words of body copy on every page that targets organic search.

## Content rules
- **Never name competitors.** Let renders prove the difference.
- Rule card titles are MasonX first-person quotes. Keep that voice.
- Proof section H2s follow "Look at the X" / "Now watch the Y" pattern.
- Body copy uses Fraunces for warmth; JetBrains Mono only for numbers, labels, MasonX voice.
- FAQ answers stay in MasonX voice — terse, foreman cadence, no marketing softeners.
- SEO page titles: lead with the user-search phrasing, end with `| The Masonry Modeler`.

## Deployment notes
- Cloudflare Pages serves `dist/` directly. `public/_headers` controls cache: hashed `/_astro/*` assets are `immutable, max-age=31536000`; everything else is `max-age=0, must-revalidate`.
- Google Search Console is set up as a domain property — verification file is `public/google8e2eb7d3d8a4355e.html`.
- No environment variables, no API keys, no server-side anything. Pure static build.

## Production checklist
- [ ] Verify meta description ≤155 chars on every page
- [ ] Confirm canonical URL matches the deployed path on every new page
- [ ] Run `node generate-og.mjs` if the hero render was updated
- [ ] Validate JSON-LD at schema.org/validator after FAQ or schema changes
- [ ] Confirm og:image renders correctly (test with og:debugger)
- [ ] After `npm run build`, spot-check `dist/sitemap-0.xml` lists every public page
