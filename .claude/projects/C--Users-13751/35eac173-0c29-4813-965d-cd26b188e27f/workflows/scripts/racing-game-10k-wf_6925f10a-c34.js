
export const meta = {
  name: 'racing-game-10k',
  description: 'Build a 10,000-line Canvas racing game via 12 parallel agents',
  phases: [
    { title: 'Write modules', detail: '12 agents writing ~800-1000 lines each in parallel' },
    { title: 'Assemble', detail: 'Combine modules into single playable HTML file' },
    { title: 'Verify', detail: 'Line count, syntax check, integration validation' },
  ],
}

// ============================================================
// SHARED SPEC — all agents must follow these conventions
// ============================================================
const SPEC = `
NAMESPACE: window.R = window.R || {}
CANVAS: created by engine-core, accessed as R.canvas (1280×720), R.ctx (2d context)
COORDINATES: screen x→right, y→down. World-space track coordinates with camera offset.
GAME LOOP: engine calls R.updatePlayer(dt), R.updateAI(dt), R.updateEffects(dt), etc.
           then R.renderTrack(), R.renderScenery(), R.renderCars(), R.renderHUD(), etc.
CONSTANTS: all tunable values in R.CONFIG = {} (extend as needed)
CAR OBJECT: { x, y, angle, speed, steerAngle, driftFactor, lap, checkpointIdx, finished, color, maxSpeed, acceleration, braking, handling }
TRACK: R.track = { segments: [], totalLaps: 3 }
  segment: { worldX, worldY, worldZ, width, curvature, elevation, type: 'straight'|'curve'|'hill' }
CAMERA: R.camera = { x, y, zoom: 1 }
INPUT: R.input = { throttle: 0/1, brake: 0/1, steer: -1..1, boost: 0/1 }
STATE: R.state = { phase: 'menu'|'countdown'|'racing'|'finished', time: 0, countdownTimer: 0 }
OBJECT POOLS: pre-allocate arrays, recycle dead objects. No "new" in hot paths.
TARGET: 60fps, <8ms script time
FILE OUTPUT: Write your code to src/racing/modules/[module-name].js
  Each file starts with: // === module-name.js — Racing Game ===
  Each file ends with a comment listing exported functions/objects.
DO NOT reference other module files with import/require. All modules attach to window.R.
Assume R.CONFIG, R.canvas, R.ctx, R.input, R.camera, R.track, R.state already exist.
`

phase('Write modules')

const results = await parallel([
  // 1. CONFIG — all game constants (~400 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/config.js (~400 lines)

Define ALL game constants in R.CONFIG. This is the single source of truth.

Include:
- Canvas: WIDTH=1280, HEIGHT=720
- Track: TRACK_SEGMENTS=200, ROAD_WIDTH=180, CURVE_MAX_ANGLE=0.04, ROAD_COLOR='#555', LINE_COLOR='#fff'
- Player car: MAX_SPEED=12, ACCELERATION=0.15, BRAKING=0.25, HANDLING=0.04, DRIFT_FACTOR=0.92, MAX_DRIFT_ANGLE=0.5, CAR_WIDTH=40, CAR_HEIGHT=70
- AI cars: AI_COUNT=5, AI_MAX_SPEED_RANGE=[7,11], AI_AGGRESSION_RANGE=[0.3,0.9], AI_PERFECT_LINE=0.7
- Physics: FRICTION=0.96, OFFROAD_FRICTION=0.85, COLLISION_DAMPING=0.7, MIN_SPEED=0.01
- Race: TOTAL_LAPS=3, COUNTDOWN_SECONDS=3, FINISH_DELAY=5, POSITION_UPDATE_INTERVAL=0.2
- Camera: CAMERA_SMOOTH=0.1, CAMERA_OFFSET_Y=-120, CAMERA_ZOOM=1.0
- Scenery: SCENERY_OBJECTS=80, BUILDING_MIN_H=60, BUILDING_MAX_H=200, TREE_SIZE=30
- Particles: MAX_PARTICLES=200, SPARK_LIFE=30, SMOKE_LIFE=60, DUST_PARTICLES=50
- Audio: ENGINE_FREQ_MIN=80, ENGINE_FREQ_MAX=400, VOLUME_MASTER=0.5
- HUD: SPEEDO_X=1100, SPEEDO_Y=550, SPEEDO_RADIUS=60
- Colors object with 30+ named colors used throughout the game
- AI driver names array: ['TURBO', 'SHADOW', 'BLITZ', 'VENOM', 'GHOST']
- AI car colors array: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6']
- Menu theme colors

Also define helper constants:
- R.DEG_TO_RAD = Math.PI/180
- R.RAD_TO_DEG = 180/Math.PI

Format every block with a comment header like:
// === CAR PHYSICS ===
R.CONFIG.MAX_SPEED = 12;
...

This module attaches to R.CONFIG only. No game logic.
`, {label: 'config'}),

  // 2. ENGINE — game loop, timing, state machine (~500 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/engine.js (~500 lines)

This is the game's main loop and state machine. It creates the canvas and bootstraps everything.

Functions to implement:
- R.init(): Create canvas element (1280×720), append to document.body, get 2d context.
  Set canvas style for centering. Initialize R.state = { phase: 'menu', time: 0, countdownTimer: 3, raceTime: 0, bestLap: Infinity }.
  Call init functions for other systems (assume they exist): R.initInput(), R.initAudio(), R.initTrack(), R.initPlayer(), R.initAI(), R.initHUD(), R.initEffects(), R.initScenery().
  Then start the loop with requestAnimationFrame(R.loop).

- R.loop(timestamp): Calculate dt (cap at 33ms to avoid spiral of death). Call:
  R.updateInput()
  R.updateStateMachine(dt)  // handles menu→countdown→racing→finished transitions
  R.updatePlayer(dt)   // only if racing
  R.updateAI(dt)        // only if racing
  R.updateCamera(dt)
  R.updateEffects(dt)
  R.updateHUD(dt)
  R.render()
  requestAnimationFrame(R.loop)

- R.updateStateMachine(dt):
  'menu': wait for Enter/Space to start → phase='countdown', countdownTimer=3
  'countdown': decrement countdownTimer, when 0 → phase='racing', raceTime=0
  'racing': increment raceTime, check if player finished all laps → phase='finished'
  'finished': after FINISH_DELAY seconds, allow restart

- R.render(): Clear canvas (R.ctx.clearRect). Call in order:
  R.renderSky()
  R.renderTrack()
  R.renderScenery()
  R.renderCars()
  R.renderEffects()
  R.renderHUD()
  R.renderOverlay()  // for countdown, pause, results

- R.updateCamera(dt): Smooth follow player car with CAMERA_SMOOTH lerp.
  R.camera.x += (player.x - R.camera.x) * CAMERA_SMOOTH
  R.camera.y += (player.y + CAMERA_OFFSET_Y - R.camera.y) * CAMERA_SMOOTH

- Utility: R.lerp(a,b,t), R.clamp(v,min,max), R.dist(x1,y1,x2,y2), R.randomRange(min,max)

Initialize empty arrays/objects: R.aiCars=[], R.particles=[], R.sceneryObjects=[].

Write to src/racing/modules/engine.js
`, {label: 'engine'}),

  // 3. INPUT — keyboard/touch handling (~350 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/input.js (~350 lines)

Handle all player input. Keyboard for desktop, touch for mobile.

R.input object (already created, you fill it):
{ throttle: 0|1, brake: 0|1, steer: -1..1, boost: 0|1, confirm: false, pause: false }

Functions:
- R.initInput(): Bind keydown/keyup events.
  ArrowUp / W → throttle=1 on down, 0 on up
  ArrowDown / S → brake=1 on down, 0 on up
  ArrowLeft / A → steer=-1 on down, 0 on up
  ArrowRight / D → steer=1 on down, 0 on up
  Shift / Space → boost=1 on down, 0 on up
  Enter → confirm=true (reset after consumed)
  Escape / P → pause=true (reset after consumed)
  Use e.preventDefault() for game keys to prevent scrolling.

- Touch support (optional, ~50 lines):
  Left half of screen → steer left, right half → steer right
  Swipe up → throttle
  Swipe down → brake
  Tap center → confirm

- R.updateInput(): Called each frame. Handle continuous key state (already tracked via events).
  Reset confirm and pause after they're consumed by state machine.

- R.consumeConfirm(): sets R.input.confirm = false (called after state machine reads it)
- R.consumePause(): sets R.input.pause = false

- Gamepad support stub: R.initGamepad() — detect gamepad, poll axes/buttons (optional, ~50 lines)

Write robust, cross-browser event handling. Use e.code (not e.keyCode) for keyboard.
`, {label: 'input'}),

  // 4. TRACK — generation + rendering (~1000 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/track.js (~1000 lines)

Procedural track generation and rendering. The track is the heart of the game.

Track segment structure: { worldX, worldY, worldZ, width, curvature, elevation, type, dist }
R.track = { segments: [], totalLaps: R.CONFIG.TOTAL_LAPS }

FUNCTIONS:

- R.initTrack(): Generate a closed-loop racing circuit.
  Start at origin. Use a series of sin/cos waves + random variation to create an interesting track.
  Algorithm:
  1. Define key "control points" for the circuit (12-16 points evenly spaced around a rough loop)
  2. Between each control point, interpolate 12-15 segments with smooth curvature
  3. Each segment advances in worldZ (forward distance along track)
  4. curvature determines how much the next segment's angle changes
  5. Track must be CLOSED (last segment connects smoothly to first)
  6. Set R.track.startX, R.track.startY for player spawn position
  7. Spawn position is at segment[0], facing along segment[0]'s direction
  
  Track shape: a winding circuit with straights, sweeping curves, a few tight turns.
  Total length around 8000-10000 world units.
  After generation, store R.track.totalLength = sum of all segment distances.

- R.getTrackPosition(worldZ): Given a distance along track, return interpolated {x, y, angle, curvature, width} at that point. Wrap around track length (closed circuit).
  Use linear interpolation between the two nearest segments.

- R.isOnTrack(worldX, worldZ): Check if a world position is within track boundaries.
  Find nearest segment, compute lateral distance from center, compare to segment.width/2.
  Return { onTrack: bool, distFromCenter: number, segment: index }

- R.renderTrack():
  Loop through segments that are visible (within ~800px of camera).
  For each segment:
  - Convert world position to screen using R.worldToScreen(wx, wy, wz)
  - Draw road trapezoid (wider at bottom, narrower at top for pseudo-3D)
  - Draw lane markings (dashed center line, solid edge lines)
  - Vary road color slightly for visual interest
  - Draw curbs (red/white stripes on tight curves)
  Use fillRect and path operations. Minimize state changes.

- R.worldToScreen(wx, wy, wz): Convert world coordinates to screen.
  Perspective projection: scale = R.camera.zoom / (1 + wz * 0.002)
  sx = R.canvas.width/2 + (wx - R.camera.x) * scale
  sy = R.canvas.height/2 + (wy - R.camera.y) * scale
  return { x: sx, y: sy, scale }

- R.renderSky(): Simple gradient sky + distant horizon line.
  Gradient from light blue to darker blue, with a green-brown horizon strip.

The track should look like a proper racing circuit viewed from above-ish angle (top-down with slight perspective).

Write to src/racing/modules/track.js
`, {label: 'track'}),

  // 5. PLAYER CAR — physics + rendering (~900 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/player.js (~900 lines)

Player car with full physics simulation and detailed rendering.

R.player = { x, y, z, angle, speed, steerAngle, driftFactor, lap, checkpointIdx, finished, color, maxSpeed, acceleration, braking, handling }

FUNCTIONS:

- R.initPlayer(): Create player car at track start position.
  Set all properties. color='#00ff88'. maxSpeed=R.CONFIG.MAX_SPEED. etc.

- R.updatePlayer(dt): Full car physics simulation.
  1. Read R.input.throttle, R.input.brake, R.input.steer, R.input.boost
  2. STEERING: steerAngle += input.steer * R.CONFIG.HANDLING * (1 + speed/maxSpeed * 0.5)
     steerAngle *= 0.85 each frame (self-centering)
     Clamp steerAngle to ±0.6
  3. ACCELERATION: if throttle, speed += acceleration * dt * 60
     if brake, speed -= braking * dt * 60
     speed *= FRICTION (natural deceleration)
     Clamp speed to [0, maxSpeed]
  4. DRIFT: lateralForce = speed * steerAngle * 0.3
     driftFactor += (lateralForce - driftFactor) * 0.1
     driftMagnitude = abs(driftFactor)
     If driftMagnitude > 0.15: apply DRIFT_FACTOR to forward friction (car slows in drift)
  5. POSITION UPDATE:
     effectiveAngle = angle + driftFactor * 0.5
     x += cos(angle) * speed * cos(driftFactor)
     y += sin(angle) * speed * cos(driftFactor)
     angle += steerAngle * speed * 0.03
  6. TRACK CHECK: R.isOnTrack(x, z). If off track, speed *= OFFROAD_FRICTION
  7. LAP LOGIC: track has checkpoints. When player passes checkpoint, increment checkpointIdx.
     When all checkpoints passed, lap++. Reset checkpointIdx.
     If lap >= TOTAL_LAPS, player.finished = true.
  8. Store player.z as total distance traveled (for position tracking)

- R.renderPlayerCar(): Detailed top-down car rendering.
  Draw order:
  1. Shadow (dark ellipse under car, offset slightly)
  2. Car body (rounded rectangle, player.color)
  3. Windshield (darker rect, front portion)
  4. Rear window (darker rect, rear portion)
  5. Racing stripe (center line)
  6. Wheels (4 dark rectangles at corners, rotate with steerAngle)
  7. Exhaust flame when accelerating (orange/yellow triangle at rear)
  8. Drift marks (if drifting, draw light gray marks behind rear wheels)

- R.getPlayerWorldZ(): Return player.z (distance along track). Used by other systems.

Use Canvas transform (save/translate/rotate/restore) for car rendering at the correct world position converted to screen.

Write to src/racing/modules/player.js
`, {label: 'player'}),

  // 6. AI CARS — behavior + rendering (~900 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/ai.js (~900 lines)

AI opponent cars with path-following behavior, personality, and rendering.

R.aiCars = []  // Array of AI car objects, same shape as player car plus AI-specific fields

FUNCTIONS:

- R.initAI(): Create R.CONFIG.AI_COUNT AI cars.
  Each AI car extends the base car object with:
  - driverName: randomly assigned from R.CONFIG.AI_DRIVER_NAMES
  - color: randomly assigned from R.CONFIG.AI_COLORS
  - aggression: random in AI_AGGRESSION_RANGE (affects overtaking, braking points)
  - skillLevel: random in [0.4, 0.95] (affects line perfection)
  - targetSpeed: current desired speed
  - state: 'racing' | 'overtaking' | 'defending' | 'recovering'
  Position AI cars at staggered z-distances behind player at start.

- R.updateAI(dt): Update all AI cars.
  For each AI:
  1. Find target position on track ahead (distance depends on speed, skillLevel)
  2. Calculate desired angle to reach that target
  3. Steering: smoothly turn toward desired angle, limited by handling * skillLevel
  4. Speed control:
     - On straights: accelerate to maxSpeed
     - Before curves: pre-brake based on upcoming curvature (skilled AIs brake less)
     - In drift: manage throttle to maintain control
  5. Apply same physics as player (speed, friction, drift)
  6. AI state transitions:
     - If close behind another car → state='overtaking' (increase aggression)
     - If car behind is aggressive and close → state='defending' (block racing line)
     - If off track → state='recovering' (slow down, steer toward track)
  7. Overtaking: steer to inside of approaching curve if car ahead is slower
  8. Apply rubber-banding: if player is far ahead, AI slightly faster; if player behind, AI slightly slower
     (subtle, ±5% speed adjustment)

- R.renderAICars(): Render all AI cars using the same rendering approach as player.
  Each AI car shows:
  - Car body in team color
  - Driver name tag above car (small text, white with black outline)
  - Position number badge on roof
  - Same detail level as player car

- R.sortCarsByPosition(): Sort all cars (player + AI) by distance traveled (z position).
  Returns sorted array. Used by HUD for position display.

- R.getAIPosition(carIndex): Return 1-based position of this AI car.

Write to src/racing/modules/ai.js
`, {label: 'ai'}),

  // 7. COLLISION — detection + response (~500 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/collision.js (~500 lines)

Car-to-car and car-to-track collision detection and response.

FUNCTIONS:

- R.checkCollisions(): Called each frame during racing phase.
  1. Check all pairs of cars (player + AI) for overlap.
  2. Use AABB (axis-aligned bounding box) for broad phase.
  3. For close pairs, use rotated-rect overlap test for accuracy.
  4. On collision:
     - Calculate overlap vector
     - Push cars apart (50% each)
     - Apply impulse: faster car transfers some speed to slower car
     - Both cars lose speed: speed *= R.CONFIG.COLLISION_DAMPING
     - Trigger collision effect: R.spawnSparks(midpointX, midpointY, intensity)
     - Play collision sound: R.playSound('crash', intensity)

- R.checkCarToCar(carA, carB): Detailed collision between two cars.
  Each car is approximately a 40×70 rectangle (CAR_WIDTH × CAR_HEIGHT).
  Use separating axis theorem (SAT) for accurate rotated-rect collision.
  Return { hit: bool, overlapX, overlapY, depth } or null.

- R.checkCarToBoundary(car): Check if car is off track.
  Uses R.isOnTrack(car.x, car.z).
  If off track:
  - Apply off-road friction (speed *= OFFROAD_FRICTION each frame)
  - Spawn dust particles: R.spawnDust(car.x, car.y, 3)
  - If speed > 3 and deep off track (>50px from edge): reduce speed more aggressively

- R.resolveCollision(carA, carB, overlap): Push cars apart and adjust velocities.
  - Calculate collision normal
  - Relative velocity along normal
  - Impulse = relativeVelocity * COLLISION_DAMPING
  - Apply impulse to both cars (equal and opposite)

- R.carAABB(car): Return { minX, maxX, minY, maxY } for broad-phase culling.

Edge cases to handle:
- Multiple simultaneous collisions (resolve in order of overlap depth)
- Car pushed off track by collision → apply boundary check after resolution
- Very slow speed collisions → no sparks, just nudging
- One car stationary (speed < MIN_SPEED) → mostly push the stationary car

Write to src/racing/modules/collision.js
`, {label: 'collision'}),

  // 8. HUD — speedometer, minimap, timers (~900 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/hud.js (~900 lines)

Complete heads-up display with speedometer, minimap, position tracker, lap counter, and race results.

FUNCTIONS:

- R.initHUD(): Initialize HUD state. Create offscreen canvas for minimap.

- R.renderHUD(): Main HUD render call (called in render loop).
  Call sub-renderers in order:
  R.renderSpeedometer()
  R.renderPositionBadge()
  R.renderLapCounter()
  R.renderMiniMap()
  R.renderRaceTimer()
  R.renderDriftIndicator()  // shows drift angle visually

- R.renderSpeedometer():
  Draw analog-style speedometer at SPEEDO_X, SPEEDO_Y.
  - Outer circle (dark bg)
  - Tick marks every 10 units (0 to R.player.maxSpeed+2)
  - Colored zones: green 0-50%, yellow 50-80%, red 80-100%
  - Needle: thin line from center, rotated to match speed/maxSpeed ratio
  - Digital speed readout centered below: "184 km/h" style
  - Small text below digital: "SPEED"

- R.renderPositionBadge():
  Top-right corner. Show "1st / 6" with position number large and bold.
  Color-code: 1st=gold, 2nd=silver, 3rd=bronze, rest=white.
  Animate position changes (scale bounce when position changes).

- R.renderLapCounter():
  Below position badge. "LAP 2 / 3" with progress bar showing lap completion %.
  Progress bar: gray bg, colored fill (blue for current lap, green for completed).

- R.renderMiniMap():
  Bottom-right corner, 140×140 pixels.
  Draw simplified track outline (thin line connecting segment points, scaled down).
  Draw all cars as colored dots.
  Draw player car as larger pulsing dot.
  Show track progress with a subtle gradient along the path.

- R.renderRaceTimer():
  Top-center. Large monospace digits: "1:23.456".
  Update every frame.
  Below timer: "BEST: 1:20.891" in smaller text (only if bestLap set).

- R.renderDriftIndicator():
  Bottom-center. Horizontal bar showing lateral G-force / drift.
  Center = no drift. Bar extends left/right based on drift direction.
  Color: white (low) → yellow (medium) → orange (high drift).
  Label: "DRIFT" below bar.

- R.renderCountdown(number): Large centered number during countdown phase.
  Animate: scale from 2→1 over 0.8s with easing.

- R.renderOverlay():
  'countdown' phase: render countdown number
  'finished' phase: render race results overlay
  'menu' phase: render start prompt

- R.renderRaceResults():
  Semi-transparent dark overlay.
  "RACE COMPLETE" title.
  List all cars with position, driver name, time.
  Highlight player row.
  "Press ENTER to restart" prompt at bottom.

- R.updateHUD(dt): Update minimap, position tracking, timer.
  Call R.sortCarsByPosition() every POSITION_UPDATE_INTERVAL.
  Track best lap time.

Use bold, readable fonts. White text with dark outlines for readability.
All positions/sizes from R.CONFIG.

Write to src/racing/modules/hud.js
`, {label: 'hud'}),

  // 9. EFFECTS — particles, sparks, smoke (~700 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/effects.js (~700 lines)

Visual effects system: particles, sparks, smoke, dust, screen effects.

Particle object: { x, y, vx, vy, life, maxLife, size, color, alpha, type }
R.particles = [] (object pool, pre-allocated to MAX_PARTICLES)

FUNCTIONS:

- R.initEffects(): Pre-allocate particle pool. Fill R.particles with MAX_PARTICLES dead particles.
  A particle is dead if life <= 0.

- R.spawnParticle(x, y, config): Activate a dead particle from the pool.
  config: { vx, vy, life, size, color, type }
  Set random vx/vy if not specified (within a range).
  If no dead particle available, recycle the oldest one.

- R.spawnSparks(x, y, count): Spawn 'count' spark particles.
  Each spark: small (2-4px), bright yellow/orange, high velocity in random direction, short life (20-40 frames).
  Colors cycle: yellow → orange → red → dark.

- R.spawnSmoke(x, y, count): Spawn smoke particles (for exhaust, tire smoke).
  Each: larger (6-12px), gray, slow upward drift, medium life (40-80 frames).
  Alpha fades from 0.6 → 0.

- R.spawnDust(x, y, count): Spawn dust particles (off-road).
  Each: brown/tan, medium size (3-6px), low velocity, medium-short life (20-50 frames).

- R.spawnDriftSmoke(x, y, intensity): Spawn tire smoke during drifting.
  Two plumes from rear wheel positions.
  intensity affects spawn rate and particle count.

- R.updateEffects(dt): Update all alive particles.
  1. Decrement life
  2. Update position (x += vx * dt * 60, y += vy * dt * 60)
  3. Apply gravity if type='smoke' (vy -= 0.05)
  4. Fade alpha based on life/maxLife ratio
  5. Mark dead if life <= 0

- R.renderEffects(): Render all alive particles.
  For each alive particle:
  - Set ctx.globalAlpha = particle.alpha
  - Set ctx.fillStyle = particle.color
  - Draw as small circle or square based on type
  - Reset globalAlpha

- R.renderScreenShake(): If shake active, apply random offset to camera.
  shakeIntensity decays over time.
  Triggered by collisions and off-track impacts.

- R.triggerScreenShake(intensity): Set screen shake for 'intensity' frames.
  intensity determines max pixel offset.

- R.renderSpeedLines(): When at high speed (>80% maxSpeed), draw subtle horizontal lines
  at screen edges that streak backward (speed sensation effect).

Write to src/racing/modules/effects.js
`, {label: 'effects'}),

  // 10. AUDIO — Web Audio engine + effects (~500 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/audio.js (~500 lines)

Sound system using Web Audio API. All sounds are procedurally generated (no external files).

FUNCTIONS:

- R.initAudio(): Create AudioContext.
  Create master gain node (R.audioMaster = ctx.createGain(), gain = R.CONFIG.VOLUME_MASTER).
  Connect: masterGain → ctx.destination.
  Initialize oscillator pools.

- R.playSound(type, params): Play a procedural sound effect.
  Types: 'engine', 'crash', 'skid', 'countdown', 'go', 'finish', 'menu_select'
  
  'engine': Continuous. Oscillator frequency = ENGINE_FREQ_MIN + (speed/maxSpeed) * (ENGINE_FREQ_MAX - ENGINE_FREQ_MIN).
    Add slight detune for richness. Low-pass filter for muffled effect.
    Store reference to stop/update later.
  
  'crash': Short noise burst. White noise through bandpass filter, rapid decay (0.3s).
    Volume scales with params.intensity (0-1).
  
  'skid': Continuous noise with sweeping filter. Frequency tied to drift magnitude.
    Start when drifting, stop when not.
  
  'countdown': Three short beeps (440Hz, 100ms each), then a higher beep (880Hz, 300ms) for "GO!".
  
  'finish': Ascending tone sweep (200Hz→800Hz over 1s) with reverb-like delay.
  
  'menu_select': Short click (1kHz, 30ms).

- R.updateAudio(dt): Update continuous sounds.
  Update engine sound frequency based on current speed.
  Update skid sound based on drift magnitude.
  Smooth transitions to avoid pops.

- R.stopAllSounds(): Stop all active oscillators. Used when leaving race.

- R.setMasterVolume(v): Set master gain to v (0-1).

- R.toggleMute(): Toggle mute. Store previous volume.

All sounds are mono, no positional audio needed (top-down game).

Error handling: if AudioContext creation fails (some browsers require user gesture), 
gracefully degrade — all R.playSound calls become no-ops, game continues without audio.

Write to src/racing/modules/audio.js
`, {label: 'audio'}),

  // 11. SCENERY — buildings, trees, track objects (~800 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/scenery.js (~800 lines)

Track-side scenery: buildings, trees, signs, barriers, crowds.

Scenery object: { worldX, worldY, worldZ, type, width, height, color, variant }
R.sceneryObjects = []

FUNCTIONS:

- R.initScenery(): Generate SCENERY_OBJECTS scenery objects along the track.
  For each track segment (every 4-5 segments):
  - Randomly choose type: 'building', 'tree', 'billboard', 'barrier', 'grandstand'
  - Place at offset perpendicular to track direction (left or right of track)
  - Vary distance from track edge (20-200px beyond track boundary)
  - Buildings: clustered near start/finish area, sparse elsewhere
  - Trees: more common in "rural" sections
  - Grandstand: large structure near start/finish line
  Store all objects in R.sceneryObjects.

- R.renderScenery(): Render visible scenery objects.
  For each object within camera view (+200px margin):
  - Convert world position to screen (R.worldToScreen)
  - Scale object based on distance (closer = larger)
  - Draw based on type:
    
    'building': Rectangle with windows (small lighter rects in grid).
      Multiple variants: tall/short, wide/narrow.
      Roof detail (triangle or flat).
      Random window lit/unlit pattern.
    
    'tree': Circle of green on brown trunk rectangle.
      Variant sizes and greens (dark green, pine green, olive).
      Some trees have slight random rotation.
    
    'billboard': Tall rectangle with colored top portion ("ad").
      White border, random bright color interior.
    
    'barrier': Short red-white striped rectangle along track edge.
      Alternating red/white segments.
    
    'grandstand': Large multi-tier structure.
      Multiple rows of colored rectangles (seats).
      Roof overhang.
  
  - Draw shadow under each object (dark ellipse on ground).

- R.renderCrowd(grandstandX, grandstandY): Draw simple crowd dots in grandstand.
  Small colored circles (skin tones + random shirt colors).
  Only for the main grandstand near start/finish.

- Culling: Only draw objects within ~1000px of camera (screen space).
  Sort by worldZ for correct depth ordering (far objects first).

Write to src/racing/modules/scenery.js
`, {label: 'scenery'}),

  // 12. MENU — screens and flow (~700 lines)
  () => agent(`
${SPEC}
Write src/racing/modules/menu.js (~700 lines)

Menu screens: title, pause, countdown integration, race results.

FUNCTIONS:

- R.renderMenu(): Full title screen (shown when phase='menu').
  1. Dark background with gradient
  2. Game title: "ASPHALT LEGENDS" in large bold font, centered
     - Chrome/gradient text effect (light top, dark bottom)
     - Subtle shadow
  3. Subtitle: "CANVAS RACING CHAMPIONSHIP" in smaller text below
  4. Animated car silhouette at bottom (simple car shape that slides in)
  5. Blinking prompt: "PRESS ENTER TO RACE" (pulse animation via sin(time))
  6. Controls hint: "↑↓←→ or WASD to drive | SHIFT for boost | ESC to pause"
     In smaller, dimmer text at bottom
  7. Version number bottom-right: "v1.0"

- R.renderPauseMenu(): Semi-transparent overlay.
  "PAUSED" title, large centered.
  "Press ESC to resume" below.
  "R - Restart race" 
  "M - Main menu"

- R.renderCountdownScreen(number): (already rendered by HUD, but menu provides styling)
  Large number centered: 3, 2, 1, "GO!"
  Scale animation with cubic ease-out.

- R.renderFinishScreen(): Race results overlay.
  1. Dark semi-transparent background
  2. "RACE COMPLETE!" title with golden gradient
  3. Results table:
     POS | DRIVER | TIME
     1st | [name] | [time]
     ... all positions
     Player row highlighted in player's color
  4. If player is 1st: "🏆 VICTORY! 🏆" in gold
  5. "Press ENTER to race again"
  6. "Press M for main menu"

- R.drawGradientText(text, x, y, colorTop, colorBottom, font): Draw text with vertical gradient.
  Use clip region + gradient fill.

- R.drawButton(x, y, w, h, text, color): Draw a styled button.
  Rounded rect, gradient fill, border highlight, centered text.
  (Used for future menu expansion)

- R.drawPanel(x, y, w, h, alpha): Draw semi-transparent panel background.
  Dark rect with subtle border.

Write to src/racing/modules/menu.js
`, {label: 'menu'}),
])

phase('Assemble')

const assembly = await agent(`
You are assembling a complete, playable racing game from 12 JavaScript modules.

All modules are at: src/racing/modules/
Files: config.js, engine.js, input.js, track.js, player.js, ai.js, collision.js, hud.js, effects.js, audio.js, scenery.js, menu.js

YOUR TASK:
Read each of the 12 module files, then create a SINGLE HTML file at src/racing/index.html that:

1. Has proper HTML5 boilerplate (<!DOCTYPE html>, <html>, <head>, <body>)
2. <meta viewport> for responsive
3. <title>Asphalt Legends — Canvas Racing</title>
4. <style> block with:
   - body { margin: 0; overflow: hidden; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
   - canvas { display: block; }
5. A SINGLE <script> block that contains:
   - "use strict";
   - window.R = {}; declaration at top
   - ALL 12 module contents, concatenated in dependency order:
     1. config.js (R.CONFIG — must be first)
     2. engine.js (R.init, R.loop — creates canvas)
     3. input.js (R.input)
     4. track.js (R.track)
     5. player.js (R.player)
     6. ai.js (R.aiCars)
     7. collision.js
     8. hud.js
     9. effects.js (R.particles)
     10. audio.js
     11. scenery.js (R.sceneryObjects)
     12. menu.js
   - At the bottom of the script: window.addEventListener('DOMContentLoaded', () => R.init());
6. Make sure the concatenation is CLEAN:
   - Each module separated by a blank line and a divider comment: /* ========== module-name.js ========== */
   - Remove any "Write to src/racing/modules/..." instruction lines from agent output
   - Only include actual JavaScript code
   - Ensure no duplicate const/let declarations across module boundaries that would cause errors
7. After writing, run a quick syntax check: node --check src/racing/index.html (or node -e "require('fs').readFileSync('src/racing/index.html','utf8')" to at least verify the file exists)

Write the complete file to src/racing/index.html
`, {label: 'assemble', phase: 'Assemble'})

phase('Verify')

const verify = await agent(`
Verify the assembled racing game at src/racing/index.html:

1. Count total lines: Read the file and count lines. Report exact line count.
2. Check that all 12 modules are present (search for each divider comment).
3. Verify HTML structure: doctype, html, head, body, script tags all properly closed.
4. Check JavaScript syntax: Look for obvious issues:
   - Unclosed braces/brackets/parens
   - Duplicate declarations
   - Missing closing tags
5. Verify the init chain: R.init() is called on DOMContentLoaded.
6. Check that R.CONFIG constants are defined before they're used.
7. Report: total lines, modules present, any issues found.

Be thorough. This is the quality gate.
`, {label: 'verify', phase: 'Verify'})

return { assembly: assembly, verify: verify }
