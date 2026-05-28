# Good crews get bumps, lucky crews get blades

An interactive data-journalism piece on two centuries of Oxford University **Summer Eights** bumps racing: how predictable it is, what makes one crew bump another, and how much of it is skill versus luck.

**Live site:** https://daxmavy.github.io/oxford-bumps/

## The short version
- Where a crew finishes is mostly settled before the week starts; most boats move only a place or two.
- A single day's bump is close to a coin toss between evenly matched neighbours — especially on day one (it becomes far more predictable as the week goes on).
- **Blades** (a bump on all four days) can't be fluked: they take genuine speed. Which fast crews complete the set, though, comes down to the draw.
- The biggest measurable edges are same-year **Torpids** form and **Oxford Blues** in the boat (about +0.8 places each, after controlling for where the crew started). Coaching continuity and the weather show little.

## Data
- **Bumps results:** [Anu Dudhia's Oxford bumps archive](https://eodg.atm.ox.ac.uk/user/dudhia/rowing/) and [bumps.live](https://bumps.live) — two independent reconstructions that agree on **99.99%** of the 20,617 crew-races they share (1826–2026).
- **Crews, coxes & coaches** (2007–): bumps.live.
- **Oxford Blues:** Wikipedia Boat Race crew tables.
- **Weather:** [Radcliffe Meteorological Station, University of Oxford](https://www.geog.ox.ac.uk/research/climate/rms/) — Britain's longest daily record, since 1815.

## Method, briefly
Three independent analyses — predictability, factor effects, and skill-versus-luck — were developed separately, adversarially cross-checked, and reconciled. Predictability is measured strictly out of sample (training on some years, scoring on years never seen). Factor effects come from models that hold starting position (and division, gender and year) fixed, so they read the *extra* push from each factor rather than the strength it is tangled with. The skill-versus-luck split uses a mechanistic simulator of the chase — including the rule that a crew whose target bumps out loses its bump — calibrated to reproduce the real rates of bumps, blades and spoons. Full notes are in the *How this was done* section of the site.

## Notes
Independent analysis; not affiliated with OURCs or any college. Figures cover Summer Eights; Torpids is used only as a predictor. Built with Python (pandas, scikit-learn, statsmodels) and a custom race simulator; charts with [Observable Plot](https://observablehq.com/plot/). Produced with substantial help from an AI system, with every headline figure cross-checked against the raw data.
