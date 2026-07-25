# Landing redraft — handoff for the site agent (2026-07-24)

**How to use this:** `landing-redraft.html` is a REFERENCE implementation, not a
drop-in replacement — Ryan approved its direction, copy, and structure. Integrate
it into the existing Astro components (Hero/ProofSection/RulesSection/etc.) and
the site's drafting design language; where the two conflict on look, the site's
own system wins, but the POSITIONING RULES below are Ryan's and always win.
The waitlist already exists (Formspree, Hero.astro) — point every CTA at
/#waitlist. The `assets/` here are real product screenshots taken 2026-07-24
from the live program (current realistic palette) + the real 15th pod shop
drawing sheet — move them into public/assets/ as needed.

---

**What this is:** a full redraft of the landing page, approved in direction by Ryan
(2026-07-24). `index.html` is self-contained — every style inline, every image
embedded as a data URI — so it renders anywhere with zero setup. Open it in a
browser first.

## Positioning rules (Ryan's, non-negotiable)

1. **Never name or allude to competitors.** No "AI takeoff" columns, no "the other
   guys" pricing anchors. They are a non-factor. The ONLY foil allowed is
   **"SF × factor takeoff"** — the old manual way.
2. The claim is **"It doesn't estimate the wall. It builds it."** Exactness and
   visible math, not speed. Don't drift the copy toward "faster."
3. **Real artifacts only.** Every screenshot is from the live program; the shop
   drawing is an actual generated sheet (15th pod, Elevation A), unretouched.
   Never substitute stock imagery, illustrations, or retouched shots.
4. **No brick shop-drawing claims yet.** Brick sheets aren't ready; the CMU 15th
   pod sheet is the drawings proof. Brick *takeoff/counting* claims are fine.
5. Colors on product shots must be the **realistic palette** (current app), never
   the old test colors.

## What needs wiring before this goes live

- **Video URL** — the "Watch: pump station — trace → takeoff in 3 minutes" card
  points at `#VIDEO-URL`. Replace with the real video (embed is fine on the real
  site; the mock uses a link card).
- **Waitlist CTA** — all "Join the waitlist" buttons are `#`/dead. Point them at
  the real signup.
- **Founder seat count** — "10 available" is hardcoded. Show the true remaining
  count; a real number sells, a stale one gets noticed.
- **Images** — the data URIs work as-is, but for the real site swap them for the
  files in `assets/` (better caching, smaller HTML):
  - `assets/plan-view.jpg` — plan view, Landmark print, traced walls
  - `assets/3d-view.jpg` — 3D walls standing out of the plan (consider re-shooting
    from inside the app with a nicer camera angle + Capture button; this one was
    taken headless)
  - `assets/takeoff.jpg` — the takeoff/material-order screen
  - `assets/shopdrawing-15thpod-elevA.jpg` — the real sheet (page 2 of the 15th pod
    set, rendered at 150dpi)
- **SEO** — keep the title pattern ("masonry estimating software", "shop
  drawings", "CMU & brick takeoff" are the search phrases). Add on the real site:
  meta description, OG/Twitter cards using `plan-view.jpg`, canonical URL, and a
  `Product`/`SoftwareApplication` JSON-LD block. The incumbent's site is currently
  a placeholder — these searches are winnable now.
- **Reduced motion** — the hero wall animation already respects
  `prefers-reduced-motion` (draws instantly). Keep that behavior.

## Page structure (top to bottom)

nav → hero (headline + live course-by-course wall animation with piece tallies) →
Powder River proof strip → **See it** (video card + 3 real screenshots) →
**Why it's right** (3 pillars: lays the bond / shows the math / bid becomes the
paper) → **Shop drawings** (real 15th pod sheet as a white "paper" moment) →
**The difference** (SF takeoff vs TMM, 5 rows) → PM4Subs suite strip →
**Pricing** (founder $300/mo-for-life card + "what a seat covers") → final CTA →
footer.

Design tokens (match the product): canvas #0a0a0b, card #151517, borders #232327,
orange #e08a3e = brand/money, green #2f7d4f/#5fb583 = action/selected, mono
tabular numerals for every count. The page deliberately looks like the program —
the look is the credibility.
