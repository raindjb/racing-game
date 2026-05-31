# Game Concept: Rail Runner (Working Title)

*Created: 2026-05-17*
*Status: Draft*

> **Creative Director Review (CD-PILLARS)**: CONCERNS (resolved) 2026-05-17
> **Art Director Review (AD-CONCEPT-VISUAL)**: STRONG — Direction A "Paint in Motion" selected 2026-05-17
> **Technical Director Review (TD-FEASIBILITY)**: CONCERNS 2026-05-17
> **Producer Review (PR-SCOPE)**: OPTIMISTIC — scope tiered 2026-05-17

---

## Elevator Pitch

> It's a 2.5D isometric infinite runner where you dodge trains and obstacles on active railroad tracks in a vibrant graffiti-painted city. Pure skill-driven arcade action — you get better, not your character.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Arcade / Infinite Runner |
| **Platform** | Web (Browser — Desktop + Mobile) |
| **Target Audience** | Achievers + Competitors (see Player Profile section) |
| **Player Count** | Single-player |
| **Session Length** | 5–10 minutes per run |
| **Monetization** | None (free web game) |
| **Estimated Scope** | Medium (8–13 weeks, solo) — delivered in 3 tiers |
| **Comparable Titles** | Subway Surfers, Temple Run, Alto's Adventure |

---

## Core Fantasy

The thrill of pure speed and mastery. The player enters a flow state where reaction becomes instinct — dodging, jumping, and sliding through an increasingly chaotic railroad world at breakneck speed. The fantasy is not about becoming more powerful; it's about *being* faster, sharper, and more in control than you were last run. The player improves, not the character.

---

## Unique Hook

"Like Subway Surfers, **AND ALSO** you run on active train tracks with a 2.5D isometric perspective where trains are obstacles you can climb onto and ride, not just dodge."

The 2.5D isometric view creates a genuine vertical dimension — trains aren't just barriers to avoid, they're mobile terrain with risk-reward decisions layered on top.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 1 | Speed-responsive visual effects (Paint in Motion), audio feedback, 60fps fluidity |
| **Challenge** (obstacle course, mastery) | 2 | Progressive speed increase, 3-tier obstacle system, risk-reward path decisions |
| **Fantasy** (make-believe, role-playing) | 3 | Urban graffiti runner identity, cohesive railroad world |
| **Discovery** (exploration, secrets) | 4 | Train-top routes, optimal coin paths, emergent path discoveries |
| **Submission** (relaxation, comfort zone) | 5 | Flow state at matched challenge-skill balance |
| **Narrative** (drama, story arc) | N/A | Explicitly excluded — no story, no cutscenes |
| **Fellowship** (social connection) | N/A | High score comparison only (localStorage) |
| **Expression** (self-expression, creativity) | N/A | No customization beyond possible future cosmetic unlocks |

### Key Dynamics (Emergent player behaviors)

- Players will develop instinctive threat assessment — reading the track ahead without conscious thought
- Players will weigh risk vs. reward in split seconds: "Is that train-top coin line worth the extra danger?"
- Players will discover optimal lane positions and develop rhythmic patterns for different speed tiers
- Players will chase "one more run" psychology after near-miss deaths

### Core Mechanics (Systems we build)

1. **Lane-based movement** — 3 tracks, instant lane switching, jump, and slide inputs
2. **Progressive difficulty** — speed increases over time, obstacle density and complexity scale with speed tiers
3. **Obstacle taxonomy** — 3 height tiers (low/slide, mid/jump, high/dodge) + dynamic train obstacles
4. **Vertical interaction** — train-climbing, elevated track sections, train-roof transitions
5. **Risk-reward economy** — higher danger paths offer proportionally higher score rewards

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | Lane choice, risk-reward path decisions, power-up pickup prioritization | Supporting |
| **Competence** (mastery, skill growth) | Score is direct reflection of player skill improvement over time. Progressive speed demands real mastery. | **Core** |
| **Relatedness** (connection, belonging) | Minimal — high score comparison only | Minimal |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (goal completion, collection, progression) — How: High score chasing, distance milestones, visible score during gameplay
- [x] **Explorers** (discovery, understanding systems, finding secrets) — How: Train-top routes, optimal coin paths, terrain system rewards exploration of vertical space
- [ ] **Socializers** (relationships, cooperation, community) — How: N/A (single-player, no multiplayer)
- [x] **Killers/Competitors** (domination, PvP, leaderboards) — How: High score persistence (localStorage), personal best comparison

### Flow State Design

- **Onboarding curve**: First 30 seconds — slow speed, only low obstacles, natural skill acquisition. Player learns jump and slide without explicit tutorial.
- **Difficulty scaling**: Progressive speed increase with tiered obstacle introduction. New obstacle types appear at predictable distance milestones before speed makes them hard.
- **Feedback clarity**: Distinct audio cues per action (coin chime, hit thud, train horn). Visual feedback: invincibility flash, screen effects, score popup text.
- **Recovery from failure**: Death → restart in under 3 seconds. No punishment. "One More Run" is a design pillar.

---

## Core Loop

### Moment-to-Moment (30 seconds)
The player constantly scans the track ahead, reacting to obstacles by switching lanes (left/right), jumping (up), or sliding (down). Coins and power-ups are collected by moving through them. The camera follows behind at the isometric angle.

### Short-Term (5–15 minutes)
A single run — from start to death. Progressive speed increase means the first 2 minutes feel different from minutes 5–8. The player enters flow state when challenge matches skill. "One more run" is triggered by near-miss deaths or beating a personal checkpoint.

### Session-Level (30–120 minutes)
Multiple runs in a session. The player cycles between runs, gradually improving. A session might include 5–15 runs. The primary session goal is beating the personal high score.

### Long-Term Progression
Pure player skill growth. No character upgrades, no unlocks, no meta-progression. The only persistent state is the high score (localStorage). Players return to prove they've gotten better.

### Retention Hooks
- **Mastery**: The only way to get a higher score is to get better. This is the primary retention driver.
- **Curiosity**: Discovering optimal train-top routes and risk-reward paths
- **Investment**: High score preservation creates attachment

---

## Game Pillars

### Pillar 1: Unbroken Flow
The game must never feel interrupted — from gameplay to death to restart. 60fps, zero input lag, under 3 seconds from death to running again.

*Design test*: If the death screen takes more than 5 seconds before the player can restart, it's too long.

### Pillar 2: Readable Chaos
At any speed, with any obstacle density, the player must be able to identify track conditions within 200ms. Silhouette clarity and color contrast carry the entire communication burden.

*Design test*: If a new VFX makes obstacles harder to identify, drop it.

### Pillar 3: Risk-Reward Rhythm
High-risk paths (train-top routes, tight timing gaps) must offer at least 2x the reward of safe paths. The player should feel the tension between safety and greed.

*Design test*: If coins on a train roof are worth the same as coins on the ground, the design is broken.

### Pillar 4: Vertical Dimension
The 2.5D isometric perspective is not decoration. Vertical space — climbing, jumping onto trains, elevated track transitions — is core gameplay, not optional flavor.

*Design test*: If someone proposes "simplify by removing train climbing," the answer is no.

### Anti-Pillars (What This Game Is NOT)

- **NOT story-driven**: No dialogue, no cutscenes, no narrative arcs — they break flow
- **NOT character progression**: No upgrades, no skill trees, no gear unlocks — the player improves, not the character
- **NOT a precision platformer**: This is not Geometry Dash. Core gameplay is lane-switching + timing judgment, not pixel-perfect jumps

---

## Visual Identity Anchor

**Direction**: "Paint in Motion"

**Visual Rule**: *The faster you go, the more the world becomes art.*

**Visual Principles**:
1. **Speed as aesthetic driver** — At low speeds, the world is warm earth tones (terracotta, rust, sun-bleached sand). As speed builds, colors saturate and graffiti trails stretch. At flow-state speed, the world is electric neon (magenta, cyan, lime green).
2. **Clarity through color function** — Danger signals use emissive/glowing colors (amber = warning, red = immediate danger). Decorative graffiti uses reflective/paint colors. These two color systems never overlap.
3. **Shape language for speed** — Flowing, tapered silhouettes. Characters and objects have directional drag. Graffiti tags stretch horizontally as if pulled by velocity.

**Color Philosophy**:
- Warm earth tones = the city (safe, grounded, permanent)
- Saturated primaries = dynamic objects and graffiti (alive, potentially dangerous)
- Electric neons = maximum speed, power-ups, invincibility
- Cool blues = sky and distance (aspiration, the path ahead)

**Readability Layer (mandatory secondary)**:
- All obstacles have distinct, unambiguous silhouettes
- Danger telegraphing through escalating visual cues
- Emissive (functional/signal) vs. reflective (decorative/graffiti) color treatments are never confused

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| Subway Surfers | 3-lane switching, swipe input, progressive speed, instant restart | 2.5D isometric perspective, trains as interactive terrain, vertical dimension | Validates the lane-runner format for mass audience |
| Temple Run | Obstacle variety, tilt/swipe responsiveness, risk-reward pathing | Above-ground railroad setting, train system, graffiti aesthetic | Validates infinite runner core loop longevity |
| Alto's Adventure | Smooth procedural generation, atmospheric visual identity, flow state | Urban/graffiti instead of serene/nature, trains instead of chasms | Validates that runners can be visually distinctive |

**Non-game inspirations**: American graffiti culture (tags, throw-ups, pieces, wildstyle), train-hopping subculture, urban exploration photography, Streamline Moderne architecture.

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 12–35 |
| **Gaming experience** | Casual to Mid-core |
| **Time availability** | 5–10 minute sessions, mobile-friendly |
| **Platform preference** | Browser (desktop and mobile) |
| **Current games they play** | Subway Surfers, Temple Run, Crossy Road, Geometry Dash |
| **What they're looking for** | Quick-session skill test with instant feedback and no commitment |
| **What would turn them away** | Pay-to-win, forced ads, long tutorials, slow restarts |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | HTML5 Canvas 2D + vanilla JavaScript — single file, zero dependencies |
| **Key Technical Challenges** | Mobile 60fps Canvas rendering, Web Audio GC pressure, train-terrain coupling, single-file code organization |
| **Art Style** | 2.5D isometric with perspective scaling, bright American graffiti aesthetic |
| **Art Pipeline Complexity** | Low — all assets procedural/generated (Canvas drawing), no external asset pipeline |
| **Audio Needs** | Moderate — Web Audio API oscillator synthesis + OfflineAudioContext pre-rendered SFX |
| **Networking** | None |
| **Content Volume** | Infinite procedural generation — no fixed level count |
| **Procedural Systems** | Track generation, obstacle placement (template-based with speed-tier pools), coin distribution |

---

## Risks and Open Questions

### Design Risks
- Core loop may not sustain interest beyond 10+ hours without meta-progression
- Risk-reward balance (train-top vs. ground) may need extensive playtesting to feel fair
- Difficulty curve may feel unfair rather than challenging if procedural generation creates impossible patterns

### Technical Risks
- Mobile 60fps not guaranteed on low-end devices — requires stress-test prototype early
- Web Audio GC pauses cause frame drops if audio nodes are created per-effect rather than pooled
- Train-terrain coupling (roof transitions) is the highest-complexity technical feature

### Market Risks
- Infinite runner genre is mature with established competitors
- Browser game discoverability is challenging without app store distribution

### Scope Risks
- Train system + terrain system together dominate development time (~30% of expected effort)
- Mobile touch + desktop keyboard dual input adds testing surface area
- Single-file architecture may become unwieldy beyond ~5,000 lines

### Open Questions
- Can we maintain 55+ fps on a Moto G or equivalent low-end Android with 60+ draw calls? → Answer with stress-test prototype
- Does the train-climbing mechanic feel intuitive or confusing in 2.5D iso? → Answer with Tier 1 train prototype
- Are the procedural obstacle templates fair at all speed tiers? → Answer with playtesting

---

## MVP Definition

**Core hypothesis**: The core loop of lane-switching, jumping, and sliding through obstacles on railroad tracks at increasing speed is intrinsically fun, and the train-climbing vertical dimension adds meaningful risk-reward decisions that differentiate it from existing runners.

### Scope Tiers

| Tier | Content | Timeline (solo) | Shippable? |
| ---- | ---- | ---- | ---- |
| **Tier 1: Core Loop** | Flat 3-lane track, player (run/jump/slide with animations), basic obstacles (3 tiers), distance scoring, keyboard input, minimal HUD (score, hearts), simple gradient background | 4–5 weeks | Yes — playable infinite runner |
| **Tier 2: Depth** | Train system (short/long/climbable), terrain slopes (up/down), power-ups (coins, medkit, magnet), health system, death screen, parallax city skyline, Web Audio SFX | +3–4 weeks | Yes — mechanically rich, distinct from genre |
| **Tier 3: Full Vision** | Elevated track sections, train-roof transitions, all 5 power-ups, mobile touch input, complete UI (start screen, pause, high score), full graffiti "Paint in Motion" style, particle effects, screen shake, mobile optimization | +2–3 weeks | Yes — complete vision |

**Explicitly NOT in any tier** (by design):
- Character customization/skins (anti-pillar: no character progression)
- Story/dialogue/cutscenes (anti-pillar: not story-driven)
- Multiplayer/leaderboards (out of scope)
- In-app purchases or ads (free web game)

---

## Next Steps

- [x] Get concept approval from creative-director (CD-PILLARS: CONCERNS resolved)
- [x] Select visual identity anchor (AD-CONCEPT-VISUAL: Direction A "Paint in Motion")
- [x] Technical feasibility assessed (TD-FEASIBILITY: CONCERNS — mitigations documented)
- [x] Scope tiers defined (PR-SCOPE: OPTIMISTIC — tiered approach adopted)
- [ ] Run `/setup-engine` to configure engine (Web/Canvas/JavaScript)
- [ ] Run `/prototype` — Canvas 2D stress test + Web Audio test to validate mobile 60fps and audio pipeline
- [ ] Run `/art-bible` — create visual identity specification from "Paint in Motion" anchor
- [ ] Run `/design-review design/gdd/game-concept.md` — validate concept completeness
- [ ] Run `/map-systems` — decompose into individual systems with dependencies
- [ ] Run `/design-system [system-name]` — author per-system GDDs
- [ ] Run `/create-architecture` — master architecture blueprint
- [ ] Run `/architecture-review` — validate architecture coverage
- [ ] Run `/gate-check` — phase gate before production
