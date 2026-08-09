# DRAFT — not published, not in the build

Location: `drafts/` — outside `src/pages/`, so Astro will not render or publish this.
When you approve it I'll convert to `.astro` with BlogPosting + VideoObject +
BreadcrumbList schema, sheet number, the video embed, internal links, and meta wiring.

---

## Decisions for you

**Title** (leads with the argument, not the feature):
- **A. Partial Grout Is a Map, Not a Percentage** ← my pick
- B. The Cells You Fill for a Reason
- C. Grout Day Shouldn't Be a Memory Test

**Meta description** (147 chars):
> Solid grout is one line on the bid. Partial grout is a map of cells — rebar, bearing
> plates, embeds — and if the map isn't drawn, somebody guesses.

**Sheet number:** B1.10 (next in sequence — B1.9 is the skipping-costs post)

**Video:** `SO7nta9fjOI` — "Editing a Masonry Takeoff in TMM — Annotations and Solid
Grout" — embedded mid-post in a `.video-frame`, with a `VideoObject` JSON-LD block in
`slot="head"` per the site convention. The video is the proof image; no screenshots needed.

**Internal links:** `/masonry-shop-drawings/` (primary, at the close),
`/bond-beam-estimating/` (on the bond beam paragraph), `/blog/what-skipping-the-shop-drawing-costs/`
(on the "map exists or it doesn't" argument)

**Word count:** ~1,150

**Numbers:** none. Everything stays qualitative per the no-invented-stats rule. If you
want real figures (grout volume on a recent job, cell counts), send them and I'll work
them in — otherwise this publishes clean without any.

**Anecdote check:** the draft includes one anonymized line — "I got asked this month
whether the drawing could show which cells get filled." No name, no company, no job
details. Strike it if you'd rather not reference customer conversations at all.

---
---

# Partial Grout Is a Map, Not a Percentage

Solid grout is the easy version. Every cell, every course, fill it all — one line on the
bid, one number for the pump, nothing to remember. You pay for the simplicity in yardage,
but nobody standing at the wall has to know anything.

The wall that *isn't* solid grouted is where the thinking lives. Now some cells get filled
and most don't, and the whole job turns on one question: **which ones?**

## Three kinds of filled cells

The first kind is obvious. Every cell with a vertical bar in it gets grouted — that's not
a decision, that's the structural drawings. Follow the rebar schedule and you can't miss
them.

The second kind is the horizontal steel. Bond beam courses get grouted with their bars,
and where the schedule calls extra horizontal bars — over an opening, under a bearing
condition, at a course the engineer flagged — those cells fill too. Still on the drawings,
if you know where to look.

The third kind is the one that gets missed, because it isn't about steel at all. Cells get
filled because something is going to *land* there:

- Under a bearing plate, so the plate sits on grout instead of face shell.
- Where a beam pockets into the wall.
- At a bolted attachment — a ladder on a pit wall, gate hardware, a rail post — anywhere
  an anchor needs solid material to bite.
- Around embed locations, in case the connection gets drilled and bolted instead of welded.

None of that shows up in the rebar schedule. Some of it shows up in the steel drawings, some
in the architectural details, some of it only in a phone call. It's real, it's structural in
the plainest sense — something heavy is counting on that cell being solid — and it lives
scattered across the document set, or nowhere.

## The percentage method

Ask how partial grout usually gets estimated and you'll hear a percentage. Figure the wall,
call it some fraction grouted, carry the yardage.

A percentage answers the yardage question badly and doesn't answer the location question at
all. Area math has no cells in it. It can tell you *roughly how much* — it can never tell
you *which* — and on grout, "which" is the whole game, twice:

**Once at the order.** Guess the fraction high and you're paying for yardage that goes home
in the truck. Guess it low and the pump is standing there while somebody drives for more
grout, with lifts half-poured and the crew on the clock.

**And again at the wall.** The cells have to be right *before* the pour — cleanouts,
verification, bars tied. A cell that was supposed to be filled and wasn't doesn't announce
itself. It waits. It shows up months later as an anchor bolt spinning in a hollow cell,
or a bearing plate crushing face shell, and now somebody is drilling and epoxying a fix
onto a finished wall.

Between the order and the pour, the map of which cells get filled lives somewhere. On the
good jobs it's a marked-up print in the foreman's box. On most jobs it's in somebody's
head. Either way, the day the pump shows up is a bad day to be reconstructing it.

## The map should be on the drawing

I got asked this month whether the drawing could show which cells get filled. It should.
It's the same argument as every other piece of [what skipping the shop drawing
costs](/blog/what-skipping-the-shop-drawing-costs/): the wall's decisions get made once,
on paper, by whoever was going to make them anyway — or they get made at the wall, five
times, by five different people.

So that's what TMM does now. The elevation carries the grout.

Cells with vertical bars fill from the schedule. [Bond beam courses fill with their
steel](/bond-beam-estimating/). And any cell you need filled for a reason the schedule
doesn't know about — bearing, embeds, hardware — you tag it, and it shows on the elevation
like everything else: marked, in its course, in its cell. Beam placements and plate
placements go on the sheet the same way, so the buried work sits right next to the block
it's buried in.

Two things fall out of that, and they're the same two things that always fall out:

**The count comes off the wall.** Grout quantity is a cell count now, not a fraction of an
area. The order matches the map because the order *is* the map.

**The crew reads it instead of remembering it.** Grout day, the elevation says which cells.
Before grout day, it says which cells to verify. Months later, when somebody asks whether
there's solid material behind that bracket, the drawing answers.

*[VIDEO EMBED HERE — SO7nta9fjOI, "Editing a Masonry Takeoff in TMM — Annotations and
Solid Grout" — caption: "Tagging annotations and grout on a takeoff, then watching the
elevation carry them."]*

## Buried work is still work

Grout is invisible the day after the pour, which is exactly why it has to be visible the
day before. Same for the plate under the beam and the extra bars over the door. The wall
knows where all of it goes. The takeoff should too.

That's the standard the whole set is built to: if the crew needs to know it at the wall,
it's [on the shop drawing](/masonry-shop-drawings/) — coursing, cuts, steel, and now the
grout map. Trace the wall once. Everything buried in it comes out on paper.
