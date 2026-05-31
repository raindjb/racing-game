// === config.js — Racing Game ===
// Single source of truth for all game constants.
// Attaches to R.CONFIG only. No game logic.
// === config.js — Racing Game ===

(function () {
  'use strict';

  // ==========================================================================
  // NAMESPACE
  // ==========================================================================
  window.R = window.R || {};
  window.R.CONFIG = window.R.CONFIG || {};

  // ==========================================================================
  // HELPER CONSTANTS
  // ==========================================================================
  window.R.DEG_TO_RAD = Math.PI / 180;
  window.R.RAD_TO_DEG = 180 / Math.PI;

  // ==========================================================================
  // CANVAS
  // ==========================================================================
  R.CONFIG.CANVAS_WIDTH  = 1280;
  R.CONFIG.CANVAS_HEIGHT = 720;

  // ==========================================================================
  // TRACK
  // ==========================================================================
  R.CONFIG.TRACK_SEGMENTS    = 200;
  R.CONFIG.ROAD_WIDTH        = 180;
  R.CONFIG.CURVE_MAX_ANGLE   = 0.04;
  R.CONFIG.CURVE_MIN_ANGLE   = -0.04;
  R.CONFIG.CURVE_TRANSITION  = 0.002;    // max curvature change per segment
  R.CONFIG.ELEVATION_MAX     = 0.03;
  R.CONFIG.ELEVATION_MIN     = -0.03;
  R.CONFIG.HILL_STEEPNESS    = 0.005;
  R.CONFIG.STRAIGHT_BIAS     = 0.6;      // probability of straight segment
  R.CONFIG.TUNNEL_SEGMENTS   = 40;       // segments covered by tunnel darkening
  R.CONFIG.TUNNEL_ALPHA      = 0.15;     // overlay darkness inside tunnel
  R.CONFIG.ROAD_SHOULDER     = 20;       // extra road width for rumble strips
  R.CONFIG.RUMBLE_WIDTH      = 6;        // width of rumble-strip bands
  R.CONFIG.RUMBLE_COLOR_A    = '#ff0000';
  R.CONFIG.RUMBLE_COLOR_B    = '#ffffff';

  // Track drawing
  R.CONFIG.ROAD_COLOR        = '#555';
  R.CONFIG.ROAD_COLOR_LIGHT  = '#666';   // highlighted road sections
  R.CONFIG.LINE_COLOR        = '#fff';
  R.CONFIG.LINE_WIDTH        = 2;
  R.CONFIG.LANE_MARKER_COLOR = '#ccc';
  R.CONFIG.LANE_MARKER_WIDTH = 1;
  R.CONFIG.LANE_MARKER_DASH  = 40;       // dash-pattern length in world units
  R.CONFIG.EDGE_MARKER_WIDTH = 3;
  R.CONFIG.FOG_NEAR          = 300;      // fog starts at this world-Z distance
  R.CONFIG.FOG_FAR           = 800;      // fog saturates at this world-Z distance
  R.CONFIG.FOG_COLOR         = '#87CEEB';

  // ==========================================================================
  // CAR PHYSICS — Player
  // ==========================================================================
  R.CONFIG.MAX_SPEED          = 12;
  R.CONFIG.ACCELERATION       = 0.15;
  R.CONFIG.BRAKING            = 0.25;
  R.CONFIG.HANDLING           = 0.04;
  R.CONFIG.DRIFT_FACTOR       = 0.92;
  R.CONFIG.MAX_DRIFT_ANGLE    = 0.5;
  R.CONFIG.CAR_WIDTH          = 40;
  R.CONFIG.CAR_HEIGHT         = 70;
  R.CONFIG.BOOST_MULTIPLIER   = 1.6;
  R.CONFIG.BOOST_DURATION     = 90;      // frames (1.5 s at 60 fps)
  R.CONFIG.BOOST_COOLDOWN     = 300;     // frames (5 s at 60 fps)
  R.CONFIG.BOOST_DECAY_RATE   = 0.02;    // multiplier lost per frame after duration
  R.CONFIG.STEER_RETURN_SPEED = 0.06;    // how fast steering centers when no input
  R.CONFIG.STEER_SENSITIVITY  = 0.08;    // keyboard ramp per frame
  R.CONFIG.MIN_SPEED_FOR_STEER = 0.3;    // no steering when nearly stopped

  // ==========================================================================
  // CAR PHYSICS — Global
  // ==========================================================================
  R.CONFIG.FRICTION           = 0.96;
  R.CONFIG.OFFROAD_FRICTION   = 0.85;
  R.CONFIG.COLLISION_DAMPING  = 0.7;
  R.CONFIG.MIN_SPEED          = 0.01;

  // Collision
  R.CONFIG.COLLISION_PUSH     = 2.0;     // lateral push force on collision
  R.CONFIG.COLLISION_RADIUS   = 35;      // AABB half-diagonal for proximity check
  R.CONFIG.INVULN_FRAMES      = 8;       // brief immunity after collision

  // ==========================================================================
  // CAR PHYSICS — Precomputed derived values (avoid division in hot path)
  // ==========================================================================
  R.CONFIG.MAX_SPEED_INV       = 1 / 12;          // 1 / MAX_SPEED
  R.CONFIG.CAR_HALF_WIDTH      = 20;              // CAR_WIDTH / 2
  R.CONFIG.CAR_HALF_HEIGHT     = 35;              // CAR_HEIGHT / 2
  R.CONFIG.HANDLING_INV        = 1 / 0.04;        // 1 / HANDLING
  R.CONFIG.MAX_DRIFT_ANGLE_TAN = Math.tan(0.5);   // precomputed tan(MAX_DRIFT_ANGLE)

  // ==========================================================================
  // TIRE MARKS / SKID
  // ==========================================================================
  R.CONFIG.SKID_MARK_LIFE      = 180;             // frames skid marks persist
  R.CONFIG.SKID_MARK_ALPHA     = 0.5;
  R.CONFIG.SKID_MARK_WIDTH     = 3;
  R.CONFIG.SKID_MARK_COLOR     = '#222';
  R.CONFIG.SKID_SPEED_THRESHOLD = 4;              // min speed for skid marks to appear
  R.CONFIG.SKID_ANGLE_THRESHOLD = 0.15;           // min drift angle to trigger skid

  // ==========================================================================
  // INPUT / CONTROLLER TUNING
  // ==========================================================================
  R.CONFIG.KEYBOARD_REPEAT_DELAY  = 8;            // frames before steering ramps
  R.CONFIG.TOUCH_SWIPE_THRESHOLD  = 30;           // pixels for swipe detection
  R.CONFIG.TOUCH_DEAD_ZONE        = 10;           // ignore tiny touch moves
  R.CONFIG.TAP_COOLDOWN           = 15;           // frames between tap-to-boost

  // ==========================================================================
  // AI CARS
  // ==========================================================================
  R.CONFIG.AI_COUNT              = 5;
  R.CONFIG.AI_MAX_SPEED_RANGE    = [7, 11];
  R.CONFIG.AI_AGGRESSION_RANGE   = [0.3, 0.9];
  R.CONFIG.AI_PERFECT_LINE       = 0.7;
  R.CONFIG.AI_MISTAKE_INTERVAL   = [120, 300];  // frames between AI steering wobbles
  R.CONFIG.AI_MISTAKE_MAGNITUDE  = 0.03;
  R.CONFIG.AI_BLOCK_RADIUS       = 100;         // distance at which AI reacts to player ahead
  R.CONFIG.AI_PASS_THRESHOLD     = 0.6;         // aggression needed to attempt overtake
  R.CONFIG.AI_BRAKE_DISTANCE     = 200;         // world units — start braking for tight curves
  R.CONFIG.AI_LANE_OFFSET        = 0.35;        // fraction of road width used for lateral offset
  R.CONFIG.AI_DRIVER_NAMES       = ['TURBO', 'SHADOW', 'BLITZ', 'VENOM', 'GHOST'];
  R.CONFIG.AI_CAR_COLORS         = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
  R.CONFIG.AI_CATCHUP_BOOST      = 1.05;        // speed multiplier when AI is behind player
  R.CONFIG.AI_CATCHUP_THRESHOLD  = 400;         // world-Z gap below which catchup activates

  // ==========================================================================
  // RACE RULES
  // ==========================================================================
  R.CONFIG.TOTAL_LAPS               = 3;
  R.CONFIG.COUNTDOWN_SECONDS        = 3;
  R.CONFIG.FINISH_DELAY             = 5;        // seconds before auto-return to menu
  R.CONFIG.POSITION_UPDATE_INTERVAL = 0.2;      // seconds between position recalculations
  R.CONFIG.WRONG_WAY_TOLERANCE      = 3;        // seconds driving wrong way before warning
  R.CONFIG.RESPAWN_SPEED            = 5;        // speed after reset-to-track
  R.CONFIG.RESPAWN_DELAY            = 60;       // frames stuck off-road before auto-respawn
  R.CONFIG.LAP_CHECKPOINT_COUNT     = 4;        // number of checkpoints per lap
  R.CONFIG.FINISH_LINE_SEGMENT      = 0;        // which segment index is the finish line
  R.CONFIG.RACE_POSITIONS           = [];       // populated at race start — placeholder

  // Track progression (speed scales up per lap)
  R.CONFIG.LAP_SPEED_SCALE          = [1.0, 1.02, 1.04]; // multiplier per lap index
  R.CONFIG.LAP_DIFFICULTY_SCALE     = [1.0, 1.05, 1.08]; // AI aggressiveness scale per lap

  // ==========================================================================
  // POST-RACE / RESULTS SCREEN
  // ==========================================================================
  R.CONFIG.RESULTS_FADE_IN          = 60;       // frames for results overlay to appear
  R.CONFIG.RESULTS_LINE_HEIGHT      = 50;
  R.CONFIG.RESULTS_TITLE_FONT       = 'bold 36px Arial';
  R.CONFIG.RESULTS_ROW_FONT         = '20px monospace';
  R.CONFIG.RESULTS_RETRY_FONT       = 'bold 24px Arial';
  R.CONFIG.RESULTS_BG_ALPHA         = 0.75;
  R.CONFIG.RESULTS_PLAYER_COLOR     = '#f1c40f';
  R.CONFIG.RESULTS_AI_COLOR         = '#ccc';
  R.CONFIG.RESULTS_GAP_FORMAT       = '+{0}s';  // template for time gap display

  // ==========================================================================
  // EFFECTS / ANIMATIONS
  // ==========================================================================
  R.CONFIG.FLASH_DURATION           = 15;       // frames for screen flash (boost/collision)
  R.CONFIG.FLASH_ALPHA_MAX          = 0.3;
  R.CONFIG.FLASH_COLOR_BOOST        = 'rgba(0,180,255,{a})';
  R.CONFIG.FLASH_COLOR_COLLISION    = 'rgba(255,50,0,{a})';
  R.CONFIG.FINISH_SLOWMO_DURATION   = 60;       // frames of slow-motion on crossing line
  R.CONFIG.FINISH_SLOWMO_SCALE      = 0.3;      // time scale during finish slow-mo
  R.CONFIG.RANK_FADE_DURATION       = 20;       // frames for position number to fade in/out

  // ==========================================================================
  // CAMERA
  // ==========================================================================
  R.CONFIG.CAMERA_SMOOTH     = 0.1;
  R.CONFIG.CAMERA_OFFSET_Y   = -120;
  R.CONFIG.CAMERA_ZOOM       = 1.0;
  R.CONFIG.CAMERA_ZOOM_MIN   = 0.6;
  R.CONFIG.CAMERA_ZOOM_MAX   = 1.6;
  R.CONFIG.CAMERA_ZOOM_SPEED = 0.005;    // zoom rate on boost
  R.CONFIG.CAMERA_SHAKE_MAG  = 3;        // screen-shake pixels (collision)
  R.CONFIG.CAMERA_SHAKE_DECAY = 0.85;    // per-frame decay of shake amplitude
  R.CONFIG.CAMERA_LOOKAHEAD   = 150;     // world units ahead for camera target

  // ==========================================================================
  // SCENERY
  // ==========================================================================
  R.CONFIG.SCENERY_OBJECTS       = 80;
  R.CONFIG.BUILDING_MIN_H        = 60;
  R.CONFIG.BUILDING_MAX_H        = 200;
  R.CONFIG.TREE_SIZE             = 30;
  R.CONFIG.TREE_SIZE_RANGE       = [20, 45];       // min/max variation
  R.CONFIG.BILLBOARD_COUNT       = 12;
  R.CONFIG.BILLBOARD_WIDTH       = 80;
  R.CONFIG.BILLBOARD_HEIGHT      = 50;
  R.CONFIG.SCENERY_LATERAL_MIN   = 0.3;            // fraction of road width — inner spawn boundary
  R.CONFIG.SCENERY_LATERAL_MAX   = 1.2;            // fraction of road width — outer spawn boundary
  R.CONFIG.SCENERY_SEGMENT_STEP  = 3;              // spawn every N track segments
  R.CONFIG.SCENERY_SPAWN_DENSITY = 0.7;            // probability an eligible segment gets a prop
  R.CONFIG.MOUNTAIN_COLOR_NEAR   = '#4a6741';
  R.CONFIG.MOUNTAIN_COLOR_FAR    = '#6b8c5c';
  R.CONFIG.SKY_TOP_COLOR         = '#1a1a2e';
  R.CONFIG.SKY_BOTTOM_COLOR      = '#87CEEB';

  // Scenery type weights (probability distribution for spawn)
  R.CONFIG.SCENERY_WEIGHT_TREE       = 0.45;
  R.CONFIG.SCENERY_WEIGHT_BUILDING   = 0.25;
  R.CONFIG.SCENERY_WEIGHT_ROCK       = 0.12;
  R.CONFIG.SCENERY_WEIGHT_BILLBOARD  = 0.10;
  R.CONFIG.SCENERY_WEIGHT_LAMP       = 0.08;

  // Lamp post
  R.CONFIG.LAMP_HEIGHT          = 80;
  R.CONFIG.LAMP_COLOR_POLE      = '#666';
  R.CONFIG.LAMP_COLOR_GLOW      = 'rgba(255,255,200,0.3)';
  R.CONFIG.LAMP_GLOW_RADIUS     = 35;

  // Rock
  R.CONFIG.ROCK_SIZE_RANGE      = [10, 35];
  R.CONFIG.ROCK_COLOR_A         = '#7f8c8d';
  R.CONFIG.ROCK_COLOR_B         = '#95a5a6';

  // Building windows
  R.CONFIG.BUILDING_WINDOW_COLOR = '#ffeb3b';
  R.CONFIG.BUILDING_WINDOW_CHANCE = 0.4;           // probability a window cell is lit
  R.CONFIG.BUILDING_WINDOW_SIZE  = 8;
  R.CONFIG.BUILDING_WINDOW_GAP   = 12;

  // ==========================================================================
  // FRAME TIMING
  // ==========================================================================
  R.CONFIG.TARGET_FPS            = 60;
  R.CONFIG.FIXED_DT              = 1 / 60;         // 16.667 ms per frame
  R.CONFIG.MAX_DT                = 0.05;           // clamp delta to avoid spiral of death
  R.CONFIG.FPS_HISTORY_SIZE      = 30;             // frames to average for FPS display

  // ==========================================================================
  // PARTICLES
  // ==========================================================================
  R.CONFIG.MAX_PARTICLES      = 200;
  R.CONFIG.SPARK_LIFE         = 30;
  R.CONFIG.SMOKE_LIFE         = 60;
  R.CONFIG.DUST_PARTICLES     = 50;
  R.CONFIG.PARTICLE_GRAVITY   = 0.15;           // downward acceleration per frame
  R.CONFIG.PARTICLE_FRICTION  = 0.98;
  R.CONFIG.SPARK_SPEED_RANGE  = [2, 6];         // initial velocity magnitude
  R.CONFIG.SMOKE_SPEED_RANGE  = [0.5, 2];
  R.CONFIG.DUST_SPEED_RANGE   = [0.3, 1.5];
  R.CONFIG.SPARK_SIZE_RANGE   = [1, 3];         // radius in pixels
  R.CONFIG.SMOKE_SIZE_RANGE   = [3, 10];
  R.CONFIG.DUST_SIZE_RANGE    = [2, 6];
  R.CONFIG.SPARK_COLOR_START  = '#ffaa00';
  R.CONFIG.SPARK_COLOR_END    = '#ff0000';
  R.CONFIG.SMOKE_COLOR_START  = '#888';
  R.CONFIG.SMOKE_COLOR_END    = '#ccc';
  R.CONFIG.DUST_COLOR         = '#c8b896';

  // ==========================================================================
  // AUDIO
  // ==========================================================================
  R.CONFIG.ENGINE_FREQ_MIN    = 80;
  R.CONFIG.ENGINE_FREQ_MAX    = 400;
  R.CONFIG.VOLUME_MASTER      = 0.5;
  R.CONFIG.VOLUME_ENGINE      = 0.6;
  R.CONFIG.VOLUME_SFX         = 0.7;
  R.CONFIG.VOLUME_MUSIC       = 0.3;
  R.CONFIG.ENGINE_PITCH_RANGE = 1.5;            // max pitch multiplier at top speed
  R.CONFIG.COLLISION_VOLUME   = 0.8;
  R.CONFIG.BOOST_VOLUME       = 0.5;
  R.CONFIG.COUNTDOWN_VOLUME   = 0.9;
  R.CONFIG.FINISH_VOLUME      = 0.85;

  // ==========================================================================
  // HUD
  // ==========================================================================
  R.CONFIG.SPEEDO_X         = 1100;
  R.CONFIG.SPEEDO_Y         = 550;
  R.CONFIG.SPEEDO_RADIUS    = 60;
  R.CONFIG.SPEEDO_NEEDLE_L  = 45;              // needle length
  R.CONFIG.SPEEDO_NEEDLE_W  = 2;
  R.CONFIG.SPEEDO_START_ANGLE = 0.75 * Math.PI; // ~135 degrees
  R.CONFIG.SPEEDO_END_ANGLE   = 2.25 * Math.PI; // ~405 degrees
  R.CONFIG.MINIMAP_X          = 20;
  R.CONFIG.MINIMAP_Y          = 540;
  R.CONFIG.MINIMAP_WIDTH      = 160;
  R.CONFIG.MINIMAP_HEIGHT     = 160;
  R.CONFIG.MINIMAP_SCALE      = 0.15;
  R.CONFIG.LAP_DISPLAY_X      = 640;            // centered
  R.CONFIG.LAP_DISPLAY_Y      = 30;
  R.CONFIG.POSITION_DISPLAY_X = 20;
  R.CONFIG.POSITION_DISPLAY_Y = 50;
  R.CONFIG.TIMER_X            = 640;
  R.CONFIG.TIMER_Y            = 70;
  R.CONFIG.COUNTDOWN_X        = 640;
  R.CONFIG.COUNTDOWN_Y        = 360;
  R.CONFIG.COUNTDOWN_FONT     = 'bold 120px Arial';
  R.CONFIG.HUD_FONT           = '14px monospace';
  R.CONFIG.HUD_FONT_BOLD      = 'bold 18px monospace';
  R.CONFIG.HUD_COLOR_PRIMARY  = '#fff';
  R.CONFIG.HUD_COLOR_SHADOW   = 'rgba(0,0,0,0.6)';

  // ==========================================================================
  // COLORS — 30+ named colors used throughout the game
  // ==========================================================================
  R.CONFIG.COLOR_BLACK        = '#000000';
  R.CONFIG.COLOR_WHITE        = '#ffffff';
  R.CONFIG.COLOR_RED          = '#e74c3c';
  R.CONFIG.COLOR_RED_DARK     = '#c0392b';
  R.CONFIG.COLOR_RED_LIGHT    = '#f1948a';
  R.CONFIG.COLOR_BLUE         = '#3498db';
  R.CONFIG.COLOR_BLUE_DARK    = '#2471a3';
  R.CONFIG.COLOR_BLUE_LIGHT   = '#85c1e9';
  R.CONFIG.COLOR_GREEN        = '#2ecc71';
  R.CONFIG.COLOR_GREEN_DARK   = '#239b56';
  R.CONFIG.COLOR_GREEN_LIGHT  = '#82e0aa';
  R.CONFIG.COLOR_ORANGE       = '#f39c12';
  R.CONFIG.COLOR_ORANGE_DARK  = '#d68910';
  R.CONFIG.COLOR_ORANGE_LIGHT = '#f9e79f';
  R.CONFIG.COLOR_PURPLE       = '#9b59b6';
  R.CONFIG.COLOR_PURPLE_DARK  = '#7d3c98';
  R.CONFIG.COLOR_PURPLE_LIGHT = '#d2b4de';
  R.CONFIG.COLOR_YELLOW       = '#f1c40f';
  R.CONFIG.COLOR_YELLOW_DARK  = '#d4ac0d';
  R.CONFIG.COLOR_YELLOW_LIGHT = '#fcf3cf';
  R.CONFIG.COLOR_GRAY         = '#7f8c8d';
  R.CONFIG.COLOR_GRAY_DARK    = '#515a5a';
  R.CONFIG.COLOR_GRAY_LIGHT   = '#bdc3c7';
  R.CONFIG.COLOR_CYAN         = '#00bcd4';
  R.CONFIG.COLOR_CYAN_DARK    = '#0097a7';
  R.CONFIG.COLOR_CYAN_LIGHT   = '#80deea';
  R.CONFIG.COLOR_MAGENTA      = '#e91e63';
  R.CONFIG.COLOR_BROWN        = '#795548';
  R.CONFIG.COLOR_BROWN_DARK   = '#4e342e';
  R.CONFIG.COLOR_BROWN_LIGHT  = '#a1887f';
  R.CONFIG.COLOR_GRASS_GREEN  = '#4caf50';
  R.CONFIG.COLOR_SKY_BLUE     = '#87CEEB';
  R.CONFIG.COLOR_GOLD          = '#ffd700';
  R.CONFIG.COLOR_SILVER        = '#c0c0c0';
  R.CONFIG.COLOR_BRONZE        = '#cd7f32';

  // ==========================================================================
  // MENU THEME COLORS
  // ==========================================================================
  R.CONFIG.MENU_BG_COLOR        = '#0d0d1a';
  R.CONFIG.MENU_TITLE_COLOR     = '#f1c40f';
  R.CONFIG.MENU_TITLE_GLOW      = 'rgba(241,196,15,0.4)';
  R.CONFIG.MENU_TEXT_COLOR      = '#ecf0f1';
  R.CONFIG.MENU_TEXT_DIM        = '#7f8c8d';
  R.CONFIG.MENU_ACCENT_COLOR    = '#e74c3c';
  R.CONFIG.MENU_ACCENT_HOVER    = '#f1948a';
  R.CONFIG.MENU_BUTTON_BG       = 'rgba(255,255,255,0.08)';
  R.CONFIG.MENU_BUTTON_BORDER   = 'rgba(255,255,255,0.2)';
  R.CONFIG.MENU_BUTTON_HOVER_BG = 'rgba(255,255,255,0.15)';
  R.CONFIG.MENU_SEPARATOR       = 'rgba(255,255,255,0.1)';
  R.CONFIG.MENU_OVERLAY         = 'rgba(0,0,0,0.5)';
  R.CONFIG.MENU_HIGHLIGHT       = '#ffd700';

  // ==========================================================================
  // ANIMATION EASING (used for menu transitions, HUD fades)
  // ==========================================================================
  R.CONFIG.EASE_OUT_QUAD        = function (t) { return t * (2 - t); };
  R.CONFIG.EASE_IN_OUT_CUBIC    = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  R.CONFIG.EASE_OUT_ELASTIC     = function (t) { return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1; };
  R.CONFIG.MENU_TRANSITION_TIME = 0.4;          // seconds for menu fade/slide
  R.CONFIG.HUD_PULSE_PERIOD     = 2.0;          // seconds for HUD element pulse cycle
  R.CONFIG.TEXT_SCROLL_SPEED    = 30;           // pixels per second for credits scroll

  // ==========================================================================
  // SAVE / PERSISTENCE
  // ==========================================================================
  R.CONFIG.SAVE_KEY_BEST_LAP    = 'racing_best_lap';
  R.CONFIG.SAVE_KEY_BEST_RACE   = 'racing_best_race';
  R.CONFIG.SAVE_KEY_VOLUME      = 'racing_volume';
  R.CONFIG.SAVE_KEY_HIGH_SCORES = 'racing_high_scores';
  R.CONFIG.MAX_HIGH_SCORES      = 10;           // number of scores to persist

  // ==========================================================================
  // TRACK GENERATION SEED
  // ==========================================================================
  R.CONFIG.TRACK_SEED           = null;         // null = random; set to number for fixed seed

  // ==========================================================================
  // DEBUG
  // ==========================================================================
  R.CONFIG.DEBUG_MODE           = false;
  R.CONFIG.DEBUG_SHOW_HITBOXES  = false;
  R.CONFIG.DEBUG_SHOW_SEGMENTS  = false;
  R.CONFIG.DEBUG_FREEZE_CAMERA  = false;

  // ==========================================================================
  // EXPORTS
  // ==========================================================================
  // This module attaches to:
  //   window.R.DEG_TO_RAD
  //   window.R.RAD_TO_DEG
  //   window.R.CONFIG (all constants above)
  // === config.js — Racing Game ===
})();
