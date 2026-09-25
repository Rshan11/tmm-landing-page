# The Masonry Modeler — Codebase Guide

## Project
Landing page for themasonrymodeler.com. Masonry estimating software.
Built with **Astro 5** (static output). Published from `master` by **Cloudflare Workers Builds**, service `tmm-landing-page`. Build output is `dist/`; verify the GitHub Cloudflare check and live content after merging.

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
    Hero.astro                       ← homepage hero + Formspree demo request form (action: formspree.io/f/mkodkqyy)
    SectionDivider.astro             ← black bar with scale-mark borders (number + label + "Section")
    ProofSection.astro               ← homepage proof template (text + drafting-framed render)
    RuleCard.astro                   ← individual rule card
    RulesSection.astro               ← rules grid + all 8 rule cards (data lives in this file)
    FAQSection.astro                 ← FAQ block (used on homepage and every SEO page)
    PageHero.astro                   ← SEO/blog page hero (kicker + h1 + lead)
    PageCTA.astro                    ← bottom-of-page demo CTA (links back to /#demo)
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

<SectionDivider number="07" label="The Rake Test" />
<ProofSection
  sectionNum="07"
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

### Video proof variant
`ProofSection` also accepts `videoId` (YouTube ID) + `videoTitle` in place of `image` + `imageAlt`. The render slot becomes a lazy-loaded `<iframe>` to `youtube-nocookie.com` with a 16:9 frame (via `.proof-image.is-video`). Whenever you embed video, also add a `VideoObject` JSON-LD block in the page's `slot="head"` so AI engines can cite it.

For embedding video on the SEO landing pages (chalk-bg `.page-section`s), use the `.video-frame` utility class — same drafting aesthetic, ink border. Add `.on-dark` modifier when nesting inside `.page-section-dark`.

## Adding a new SEO landing page
1. Create `src/pages/<slug>.astro` following the template above.
2. Pick a target keyword phrase and put it in the title, lead, and an H2.
3. Write 4 FAQ items in MasonX voice (terse, first-person where natural, why-not-what).
4. Mention "masonry estimating software" in the first 150 words of body copy.
5. End with `<PageCTA />` — its default copy is fine; override only if the page has a specific angle.
6. Sitemap entry generates automatically on next `npm run build`.

## TitleBlock sheet numbers
Drafting convention. Default `sheet="A1.0 — Home"`. Override per page so the value shown matches the entry in the sheet-index dropdown:
- Homepage: default (`A1.0 — Home`)
- SEO landing pages: `A2.1`, `A2.2`, `A2.3`, …
- Blog index: `B0 — Blog`
- Blog posts: `B1.1`, `B1.2`, …

When you add a new page, also add it to the `sheetIndex` array inside `TitleBlock.astro` so it appears in the header dropdown on every page. The dropdown auto-highlights the current page by matching `Astro.url.pathname`.

## Design language

**Aesthetic:** Hybrid drafting / field-built. Engineering grid meets job-site pragmatism.

### Typography
| Role | Family | Weight |
|------|--------|--------|
| Display / headings | Oswald | 500, 600, 700 |
| Body / explanations | Barlow | 400, 500, 600, 700 |
| Labels, stats, MasonX voice | JetBrains Mono | 400, 500, 700 |

Google Fonts loaded via `<link>` in `Layout.astro` with `display=swap`.

### Color tokens (updated at Ryan's request, September 25, 2026)

The website uses cool concrete, charcoal, and restrained brick red. Avoid returning to warm cream/rust, italic editorial-serif headings, decorative grid overlays, or large offset shadows. Use upright Oswald headings and Barlow prose.

Semantic text colors depend on the surrounding light/dark surface; deep brick red is for actions and light-surface text; use the lighter red text accent on charcoal. Existing `--terracotta` names are compatibility aliases, not the old orange palette.

CSS custom properties are defined at the top of `global.css`.
| Token | Hex | Use |
|-------|-----|-----|
| `--signal` | `#b83c36` | Brick red actions and highlights |
| `--signal-ink` | `#922d29` | Readable red text on light surfaces |
| `--signal-light` | `#ed8178` | Readable red text on dark surfaces |
| `--on-signal` | `#ffffff` | White text on red actions |
| `--navy` | `#292f34` | Charcoal panels |
| `--navy-deep` | `#171b1e` | Header, hero, dark sections |
| `--chalk` | `#f2f4f5` | Light concrete surface / light text |
| `--ink` | `#171b1e` | Primary text on light |
| `--concrete` | `#c3cbd0` | Secondary light text |
| `--concrete-light` | `#e1e6e9` | Concrete surface |
| `--text-muted` | context-dependent | Muted readable text |
| `--accent-text` | context-dependent | Light red on dark, deep red on light |

### Grid / texture
- Keep the useful sheet navigation and concise drawing labels.
- Use restrained borders and level surfaces; no decorative hero grid or offset colored shadows.
- The hero features a native, click-to-play rake-wall video with an actual frame as its poster. Preserve controls, `playsinline`, `preload="none"`, the direct video link, and no autoplay.

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
Dark navy background (`--navy-deep`). Pattern: H2 headline with accent word → one or two Barlow paragraphs → MasonX quote callout (JetBrains Mono, terracotta left border) → drafting-framed render image with caption + credit.

Layouts alternate left/right via `reverse` prop for visual rhythm.

## Demo request form
Homepage `Hero.astro` requests a demo and posts to **Formspree** (`https://formspree.io/f/mkodkqyy` — the "Sign Up" form) with a vanilla `fetch` submit handler. The two sample-set download forms on `/masonry-shop-drawings` post to a separate endpoint (`https://formspree.io/f/xrenwboe` — "Sample Downloads") so downloads can't crowd signups out of the plan quota. Both carry a `_gotcha` honeypot and a `_subject`. On success it hides the form and shows `#waitlist-success`. The current form anchor is `#demo`, with `#waitlist` retained for old links. Only email is required; lead-source attribution is optional. Preserve accessible success/error messages, timeout and duplicate-submit protection. Test with mocks; do not send test leads without permission.

## SEO
- **Per-page:** `Layout` props (`title`, `description`, `canonical`) — set on every page. Defaults are tuned for the homepage.
- **OG/Twitter card:** `/assets/og-image.png` (1200×630). Regenerate with `node generate-og.mjs` whenever `pump-station-hero.png` changes.
- **Global JSON-LD** in `Layout.astro` `<head>`: SoftwareApplication + Organization (two separate `<script>` blocks).
- **Per-page JSON-LD** via the `slot="head"` named slot. Coverage by page type:
  - Homepage: FAQPage + VideoObject
  - SEO landing pages: FAQPage + HowTo + BreadcrumbList (+ VideoObject on `/cmu-block-count` and `/masonry-takeoff-accuracy`)
  - Blog index: BreadcrumbList
  - Blog posts: BlogPosting (with Person author + Organization publisher) + BreadcrumbList
- **Sitemap:** auto-generated by `@astrojs/sitemap`. `public/robots.txt` points to `/sitemap-index.xml`.
- **Favicon:** `public/favicon.svg` (SVG only — no PNG fallbacks needed for modern browsers).
- **Keyword rule:** "masonry estimating software" must appear in the first 150 words of body copy on every page that targets organic search.

## AEO (AI answer engines)
- **`public/llms.txt`** — markdown index following the llmstxt.org convention. Lists every page with a short description and core technical rules the engine enforces. Hand-edited; update when pages are added or core rules change.
- **`robots.txt` is wide open** (allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended). Don't restrict AI crawlers without a reason.
- **Quotable content matters** — AI engines synthesize answers from terse, factual lines. Keep MasonX voice tight and specific (named numbers, named units, no marketing softeners).

## Content rules
- **Never name competitors.** Let renders prove the difference.
- Rule card titles are MasonX first-person quotes. Keep that voice.
- Proof section H2s follow "Look at the X" / "Now watch the Y" pattern.
- Body copy uses Barlow; Oswald headings stay upright. JetBrains Mono is reserved for short numbers and labels.
- FAQ answers stay in MasonX voice — terse, foreman cadence, no marketing softeners.
- SEO page titles: lead with the user-search phrasing, end with `| The Masonry Modeler`.

## Deployment notes
- Cloudflare Workers Builds publishes `master` through the existing integration. `public/_headers` controls cache: hashed `/_astro/*` assets are `immutable, max-age=31536000`; everything else is `max-age=0, must-revalidate`.
- Google Search Console is set up as a domain property — verification file is `public/google8e2eb7d3d8a4355e.html`.
- No environment variables, no API keys, no server-side anything. Pure static build.

## Production checklist
- [ ] Verify meta description ≤155 chars on every page
- [ ] Confirm canonical URL matches the deployed path on every new page
- [ ] Run `node generate-og.mjs` if the hero render was updated
- [ ] Validate JSON-LD at schema.org/validator after FAQ or schema changes
- [ ] Confirm og:image renders correctly (test with og:debugger)
- [ ] After `npm run build`, spot-check `dist/sitemap-0.xml` lists every public page
