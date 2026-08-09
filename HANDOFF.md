# HANDOFF — session of 2026-08-05 → 2026-08-09

For the next working session (terminal or otherwise). `CLAUDE.md` is the codebase
guide and stays authoritative for conventions; this file is the *state* — what's
in flight, what's decided, what's waiting on Ryan. Delete it when it's stale.

**Privacy note:** this file names customers and leads for continuity. None of it
goes on the site, in a post, or in anything published without Ryan's explicit OK.
This file itself never ships (only `public/` and `src/` reach the build).

---

## 1. Git state — READ FIRST

- Work branch: **`claude/shop-drawings-page-nav-sheets-cnqn2c`** — currently
  **5 commits ahead of `origin/master`, unmerged, undeployed**:
  - `d1f57ae` Internal-link trailing slashes (24 links), 3 blog dead-ends linked, llms.txt refresh
  - `d709bd8` "CMU shop drawings" targeting on /masonry-shop-drawings (H2 + FAQ + meta)
  - `9fa5882` "Masonry shop drawing software" targeting — **title change**, H1, lead FAQ, llms.txt
  - `53c96ce` + `c44d897` B1.10 draft (drafts/ only, nothing publishes)
- Deploy = merge to `master`, then Cloudflare Pages builds `dist/`. Nothing above
  is live until merged. Ryan merges; don't merge for him.
- Build gate: `npm run build` (no tests/linter). 15 pages expected in sitemap.

## 2. In flight: B1.10 blog post (partial grout / annotations)

Draft at **`drafts/2026-08-09-partial-grout-is-a-map.md`** — decisions block up
top, full ~900-word post below. Covers the new engine features (beam placements,
plate placements, spot horizontal bars, partial grout by cell) as one argument:
buried work lands in specific cells; a percentage can't say which.

**Waiting on Ryan (3 things):**
1. Clean PNG from TMM on desktop (NOT a YouTube/phone screenshot — compression
   smears labels). Needs in frame: plate annotation with T.O./B.O. callouts,
   hatched grout cells, course ladder on the right.
2. Title pick — recommended: "Partial Grout Is a Map, Not a Percentage".
3. Keep or strike the anonymized "a contractor asked me this month" line.

**Conversion spec when approved:** `src/pages/blog/<slug>.astro`, sheet `B1.10`,
BlogPosting + BreadcrumbList + **VideoObject** schema; embed YouTube
**`SO7nta9fjOI`** ("Editing a Masonry Takeoff in TMM — Annotations and Solid
Grout") via the `.video-frame` pattern; add to `sheetIndex` in `TitleBlock.astro`,
the blog index `posts` array, and `public/llms.txt`. Meta is 147 chars, done.
Internal links (WITH trailing slashes): `/masonry-shop-drawings/`,
`/bond-beam-estimating/`, `/blog/what-skipping-the-shop-drawing-costs/`.

## 3. Launch in ~2 weeks (Ryan's date: ~Aug 23)

App status per Ryan: multi-tenant login close; he logged into the web app 8/8.
The marketing site is still 100% waitlist-architected. Launch flip needed:

- **69 "waitlist" references** in `src/` — primary CTA becomes the thing that's
  actually closing customers: "Send me your elevations" (2-for-2 this week).
- **No sign-in/login link exists anywhere.** Header needs one; need the app's
  login URL from Ryan.
- `public/llms.txt` line 3 says "Currently in pre-launch" — remove at launch.
- SoftwareApplication schema in `Layout.astro`: no availability field; revisit.
- Seat count: pricing says "first 10 companies". **2 committed** (Gilbert,
  Great Northern) + 1 likely (Spokane). An honest live counter is now viable.
- **Stripe does not exist yet.** Two committed buyers, no way to charge. This is
  the bottleneck; it beats all site work.

## 4. SEO/AEO ground truth (GSC 3-mo, screenshots 8/8–8/9)

Site: 276 impressions, 9 clicks, 3.3% CTR (was 158/2/1.3% on 7/27). All 16 queries:

| Query | Pos | Notes |
|---|---|---|
| masonry shop drawings | **5.8** | page one; the page's anchor term |
| cmu shop drawings | **11.0** | produced 1 click (100% CTR); now targeted on-page |
| douglas masonry | 18.0 | brand/local |
| masonry modeling | 41.0 | KEEP the word — see below |
| beam schedule | 42.0 | |
| block masonry takeoff | 47.0 | |
| everything in a masonry takeoff | 52.0 | = Task 1 page, almost verbatim |
| masonry takeoff | 57.0 | |
| mason estimating software | 76.5 | |
| masonry estimating software | 78.2 | |
| masons estimating software | 78.3 | |
| masonry estimation software | 81.7 | |
| size of cmu / r value of cmu block / where are bond beams required | 87–98 | spec lookups, wrong intent, ignore |

**The two queries that ever converted were phrases the site didn't contain:**
"cmu shop drawings" (1 click) and "masonry shop drawing software" (→ Gilbert
signup, confirmed in his own email). Both are now targeted on
`/masonry-shop-drawings/`.

**AI Overview:** TMM is listed FIRST in Google's AI Overview for "masonry shop
drawing software", ahead of 3DiQ and NCMA Direct Design, described in our own
vocabulary ("keyed elevations, placing sets, piece counts, cut lists straight
from the modeling phase"). Our wording shapes the AI description → keep MasonX
voice tight; `llms.txt` matters; keep the word "modeling" on the page (it was
restored deliberately in `9fa5882`).

**Strategy decisions made (don't relitigate without new data):**
- Aug 2 WO **Task 2 (modeling→estimating vocab swap) is DEAD** — we rank 41 for
  modeling, 76–82 for the estimating cluster; the swap trades better for worse.
- Estimating-software head terms: parked. Links-and-time problem (5-yr-old
  competitor domain, roundup-shaped SERP). Not a copy problem.
- Aug 2 WO **Task 1 still good**: "What's Included in a Masonry Takeoff" page
  targeting "everything in a masonry takeoff" (52) / "masonry takeoff" (57).
  Next site build after B1.10.
- **WATCH:** `9fa5882` changed the title of the page holding 5.8 (now "Masonry
  Shop Drawing Software | The Masonry Modeler"). Justified by a customer's own
  search words, but check GSC ~2 weeks post-deploy; revert is one line if 5.8 slips.

## 5. Customers / pipeline (private — never on the site without written OK)

1. **Gilbert Masonry Inc** (est. 1986) — Jake Church, jake.church@gilbertmasonryinc.com.
   FOUNDER SIGNUP via Google search "masonry shop drawing software". Feature ask:
   highlight cells that need filling (ladder attachments, embeds) — the partial-grout
   feature answers it; tell him when it ships.
2. **Great Northern Masonry** — Gunnar Elofson, gelofson@greatnorthernmasonry.com.
   COMMITTED in writing ("I'll commit and pull the trigger"). Came via elevations→
   TMM set→closed in 3 days. Knows Ryan (scaffolding sale ~3 yrs ago). His own
   drawings do things TMM's don't yet — Ryan to capture the specifics as roadmap
   items. Get permission to quote his commit line.
3. **Spokane lead** — described by Ryan as "about official". No details captured;
   ask Ryan for name/company/source.
4. **Joe Soliz Masonry** (TX, since 1950) — Instagram DM, wants shop drawings for
   a small CMU project; emailed drawings to ryan@themasonrymodeler.com. Ryan
   working the set. Play: deliver the drawing AS the demo, then offer a seat.
5. Aged stain-job inquiry in legacy PM4Subs Formspree — Ryan to reply (old).

Sales pattern that's 2-for-2: send elevations → real set back → committed.
That's the CTA the site should lead with at launch.

## 6. Link-building / distribution (all free, none started)

- **powderrivermasonry.com + milnemasonry.com** (both Ryan's): add contextual
  body-copy links to themasonrymodeler.com. Different anchor/context on each;
  stop at two — no site networks. Case-study page on PRM is the strong version.
  (Both 403 automated fetches; could not verify links exist — check by hand.)
- **MCAA**: Ryan is a member via his local association. Claim/fill the contractor
  directory listing; check if it takes a URL and whether it's followed.
- **MASONRY Magazine editorial pitch**: member contractor who built the tool —
  earned story, not the $1k/mo Masonry Alliance sponsorship (that's Revailo's
  route; explicitly rejected on cost).
- Free software directories (Capterra/G2/etc.) — form-filling.
- IG bio link should be `themasonrymodeler.com/masonry-shop-drawings/?utm_source=instagram#sample-set`
  (offer + tracking, currently bare homepage link). YouTube descriptions:
  `?utm_source=youtube`.
- External-link reality: a web search for "The Masonry Modeler" returns only our
  own pages. Zero third-party mentions found = the position-78 diagnosis.

## 7. Product feedback log (for the engine, NOT this repo)

- **T.O. formatter bug**: elevation callout rendered "T.O. 58'-12"" — inches
  don't carry into feet at 12 (should be 59'-0"). Ryan says he'll fix.
  Repro: B.O. 58'-4" + 8" tall plate.
- Jake (Gilbert): highlight cells to be filled — SHIPPED as partial-grout feature.
- Gunnar (Great Northern): unspecified gaps vs his hand drawings — Ryan to list.

## 8. Repo gotchas that bit us this session

- **Internal links need trailing slashes** (`/cmu-block-count/` not
  `/cmu-block-count`) — slash-less 307s. All 24 fixed in `d1f57ae`; every NEW
  link must comply or it creeps back.
- **FAQ schema/rendered parity**: `faqItems` feeds both HTML and FAQPage JSON-LD.
  Never put HTML in answers. Verify after edits (11 questions on
  /masonry-shop-drawings currently, parity OK).
- Meta descriptions ≤155 chars; titles <70, end "| The Masonry Modeler".
- Formspree: waitlist = `mkodkqyy`, sample downloads = `xrenwboe`. The old
  `mykvgeld` belongs to the abandoned PM4Subs account — never reuse.
- Content rules in force: never name competitors (SF × factor is the only foil);
  no invented statistics; MasonX voice terse, first person, why-not-what;
  "masonry estimating software" in first 150 words of body copy on SEO pages.
- If Playwright gets installed for verification: `npm uninstall -D playwright`
  and `git checkout package.json package-lock.json` afterward.
- Sitemap is one line — `grep -c "<loc>"` returns 1; count with `grep -o | wc -l`
  (expected 15).
- Engine repos (`C:\MasonIQ`, `C:\masoniq-levels`) are off-limits from this repo's
  sessions.
