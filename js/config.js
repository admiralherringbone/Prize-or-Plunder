// --- Debugging Flags ---
const DEBUG = {
    ENABLED: false, // Master switch to toggle all debug visuals
    DRAW_TRIANGULATION: false,
    DRAW_BOW_STERN_MARKERS: false,
    DRAW_NPC_DESTINATIONS: true,
    DRAW_SPAR_POINTS: false,
    DRAW_ANCHOR_ZONES: true,
    DRAW_CONVEX_HULLS: true, // Draw the simplified convex hull used for optimized collision checks.
    DRAW_GUNPORT_CUTOUTS: false, // To visualize the gunport cutting shapes.
    DRAW_VMG_DATA: false, // Visualize VMG search vectors for NPC ships.
    LOG_THROTTLE_MS: 250 // Log AI status 4 times per second to avoid console flooding.
};

// --- Game World Constants ---
const PLAYABLE_WIDTH = 50000;
const PLAYABLE_HEIGHT = 50000;
const WORLD_BUFFER = 5000; // The soft border zone
const WORLD_WIDTH = PLAYABLE_WIDTH + (WORLD_BUFFER * 2);
const WORLD_HEIGHT = PLAYABLE_HEIGHT + (WORLD_BUFFER * 2);
const GRID_SIZE = 100;

// --- Base Ship Dimensions (Primary driving constants for other values) ---
const SHIP_TARGET_LENGTH = GRID_SIZE / 2;
const SHIP_TARGET_WIDTH = SHIP_TARGET_LENGTH / 2;
const SPAR_TARGET_LENGTH = (SHIP_TARGET_WIDTH * 2) * 0.9; //height
const SHIP_SHOULDER_LOCAL_X_OFFSET = SHIP_TARGET_LENGTH * 0.4; // For local avoidance whiskers
const SHIP_SHOULDER_LOCAL_Y_OFFSET = SHIP_TARGET_WIDTH * 0.5;  // For local avoidance whiskers

// --- Entity Counts ---
const ISLAND_DENSITY = 2; // Number of islands per 10,000x10,000 area
const ROCK_DENSITY = 4;   // Number of rocks per 10,000x10,000 area
const NAVY_SHIP_DENSITY = 0.13; // Number of navy ships per 10,000x10,000 area
const MERCHANT_SHIP_DENSITY = 0.67; // Number of merchant ships per 10,000x10,000 area
const SHOAL_DENSITY = 2;  // Number of shoals per 10,000x10,000 area
const CORAL_REEF_DENSITY = 0.6; // Number of coral reefs per 10,000x10,000 area

// --- World Generation Constants ---
const ISLAND_SMALL_CHANCE = 0.75;
const ISLAND_SMALL_MIN_RADIUS = 70;
const ISLAND_SMALL_MAX_RADIUS = 400;
const ISLAND_LARGE_MIN_RADIUS = 800;
const ISLAND_LARGE_MAX_RADIUS = 1600;
const ROCK_MIN_RADIUS = 20;
const ROCK_MAX_RADIUS = 50;
const SHOAL_REEF_MIN_RADIUS = 140;
const SHOAL_REEF_MAX_RADIUS = 300;

// --- Shipyard Generator Constants ---
const CANNON_UNIT_SIZE = GRID_SIZE / 10; // Base length required for one cannon.
const CARGO_UNIT_SIZE = GRID_SIZE / 10;  // Base length required for one unit of cargo.

// --- Ship & Movement Constants ---
const DECK_PLANK_SPACING = GRID_SIZE / 20; // The world-space distance between deck planks.
const PLAYER_MANEUVERABILITY = 1.0;   // Baseline maneuverability.
const NAVY_MANEUVERABILITY = 0.85;  // Navy ships are less nimble.
const MERCHANT_MANEUVERABILITY = 0.7; // Merchant ships are sluggish.
const SHIP_ACCELERATION_FACTOR = 0.025;
const BASE_ROTATION_SPEED = 0.05; // Lowered to reduce its influence on dynamic turning.
const BASE_ROTATION_SCALING_FACTOR = 0.1; // New: Determines pivot speed. Higher is faster.
const MIN_TURNING_SPEED_FOR_RADIUS = 0.7; // Minimum speed for performing in-place pivots.
const BASELINE_ACCELERATION_STAT = 0.545; // Calculated for a default ship (6 baseSpeed / 11 timeConstant)
const ACCELERATION_BASE_TIME_SECONDS = 5; // Base time in seconds for acceleration calculation. Lower is faster.
const DYNAMIC_TURNING_FACTOR = 80; // Lower is faster. Relates speed to turn rate. Unified with default ship.
const LATERAL_DAMPING_FACTOR = 0.25; // How much sideways slip is reduced per frame. 0=no damping, 1=instant stop.
const ACCELERATION_POWER_CURVE_EXPONENT = 1.0; // New: The exponent for the smooth acceleration curve. Higher is more dramatic.

const CRUISING_SPEED_BALANCE_FACTOR = 1.0; // New: Global divisor to balance cruising speed. Set to 1.0 to nullify its effect.
const CRUISING_SPEED_MULTIPLIER = 80; // New: Global multiplier for final cruising speed.

const SHIP_LENGTH_TURNING_POWER = 0.5; // How much length affects turning. 0.5 = square root, making the penalty significant but not overly harsh for large ships.
const REGENERATION_COOLDOWN_TIME = 10000;
const TURNING_MOMENTUM_DAMPING = 0.995; // How much turning momentum is kept per frame. Lower is faster decay.
const SAIL_EASE_FACTOR = 0.1;
const WIND_DRIFT_SPEED = 0.005;
const ACCELERATION_TURNING_PENALTY = 0.5; // How much turning penalizes acceleration. 0=none, 1=full penalty.
const ANCHORED_DRIFT_ROTATION_SPEED = 0.005;
const WIND_DRIFT_ROTATION_FACTOR = 0.0005; // How strongly the wind rotates a stationary ship.
const ANCHORED_IDLE_POSITION_EASE_FACTOR = 0.001;

const TACKING_BOOST_TURN_RATE_CAP_MULTIPLIER = 1.5; // New: The boosted turn rate cannot exceed 150% of the ship's max turn rate.
const REEFING_SPEED_PENALTY = 0.5; // New: Speed multiplier when sails are reefed.
// --- New: Hull Shape Physics Modifiers ---
// These values control how much a ship's L:B ratio and draught directly affect its physics.
// Higher values mean a greater effect.

// L:B Ratio Modifiers (for longer, narrower ships)
const LB_RATIO_ACCEL_TURN_PENALTY_MOD = 0.15; // How much a high L:B ratio *reduces* the penalty.
const LB_RATIO_LATERAL_DAMPING_MOD = 0.05;  // How much a high L:B ratio *increases* lateral damping.
const LB_RATIO_DYNAMIC_TURNING_MOD = 0.3;   // How much a high L:B ratio *reduces* the dynamic turning factor (making it turn faster).

// Draught Modifiers (for deeper hulls)
const DRAUGHT_ACCEL_TURN_PENALTY_MOD = 0.15; // How much a deep draught *increases* the penalty.
const DRAUGHT_DYNAMIC_TURNING_MOD = 0.3;   // How much a deep draught *increases* the dynamic turning factor (making it turn slower).
const DRAUGHT_LATERAL_DAMPING_MOD = 0.15;  // How much a deep draught *increases* lateral damping.

const MAX_ANCHOR_LINE_LENGTH_MULTIPLIER = 10;
const COLLISION_DAMAGE_SPEED_MULTIPLIER = 0.3; // Scales damage from impact speed.
const MIN_SPEED_FOR_COLLISION_DAMAGE = 0.5;   // Minimum speed to take collision damage.
const SHIP_COLLISION_RESTITUTION = 0.4;       // How "bouncy" ship-on-ship collisions are. 0=inelastic, 1=perfectly elastic.
const ISLAND_COLLISION_DAMAGE_FACTOR = 1;     // Base damage factor for island collisions.
const ISLAND_COLLISION_DAMAGE_FACTOR_SUSTAINED = 0.2; // Lower damage for grinding against an island.
const ROCK_COLLISION_DAMAGE_FACTOR = 8;       // Base damage factor for rock collisions.
const ROCK_COLLISION_DAMAGE_FACTOR_SUSTAINED = 2.0; // Lower damage for grinding against a rock.
const PATHFINDING_CELL_SIZE = SHIP_TARGET_LENGTH * 5; // 250. Smaller cells for more accurate pathfinding.

// --- NPC AI Constants ---
const PATHFINDER_TACKING_ANGLE_THRESHOLD = Math.PI / 3; // 60 degrees. The "no-sail" zone used by the long-range pathfinder.
const SHIP_TACKING_ANGLE_THRESHOLD = (50 * Math.PI) / 180; // 50 degrees. The optimal angle for making way upwind.
const NPC_TACK_ANGLE_SEARCH_START = SHIP_TACKING_ANGLE_THRESHOLD; // The AI should tack at the angle defined above.
const NPC_TACK_ANGLE_SEARCH_END = Math.PI / 2; // 90 degrees (beam reach) is the furthest we need to check.
const NPC_TACK_ANGLE_SEARCH_INCREMENT = Math.PI / 36; // 5 degree increments for the search.
const NPC_TACK_AVOIDANCE_RANGE = SHIP_TARGET_LENGTH * 2; // 100. How far ahead the Pilot looks for obstacles when tacking.
const NPC_EVASION_SENSOR_RANGE_MULTIPLIER = 2.5; // Ship lengths. How far ahead the local avoidance "whiskers" look. 
const NPC_COMBAT_EVASION_SENSOR_RANGE_MULTIPLIER = 2.0; // Ship lengths. Tighter avoidance range during combat for better maneuvering.
const NPC_STUCK_TIME_LIMIT = 15000; // ms. Time before being considered "stuck" and abandoning a waypoint.
const NPC_SPAWN_PLAYER_MIN_DISTANCE_MULTIPLIER = 1.5; // NPCs must spawn at least this many detection radii away from the player.
const NPC_PATH_FAILSAFE_INTERVAL = 30000; // ms. How often to run the global check for lost NPCs.
const NPC_PATH_PROGRESS_TIMEOUT = 20000; // ms. Time allowed to reach a waypoint before skipping it.
const NPC_BRAKING_TIME_BUFFER = 500; // ms. A safety buffer for the "time to turn" calculation.

// --- Boarding & Crew Constants ---
const BOARDING_MAX_SPEED_DIFF = 5.0; // Max relative speed to allow grappling.
const BOARDING_MAX_ANGLE_DIFF = Math.PI / 3; // 60 degrees alignment tolerance.
const BOARDING_TENSION_BREAK_THRESHOLD = 100; // Max tension before lines snap.
const BOARDING_TENSION_BUILD_RATE = 0.5; // How fast tension builds when pulling away.
const BOARDING_TENSION_DECAY_RATE = 1.0; // How fast tension drops when not pulling.
const CREW_ATTACK_SPEED = 8.0; // Speed of crew "dots" traversing between ships.
const INVENTORY_MAX_DISTANCE_MULTIPLIER = 3; // Ship lengths. Max distance to keep inventory menu open.
const ABANDON_TIMEOUT_MS = 15000; // Time before an abandoned ship with crew recovers.

// --- NPC Combat AI Constants ---
const NPC_DETECTION_RADIUS = SHIP_TARGET_LENGTH * 10; // 500. The range at which an NPC will detect and interact with the player.
const NPC_COMBAT_RANGE_MULTIPLIER = 10; // The range (in ship lengths) at which an NPC will attempt to fire/engage.
const NPC_FIRING_RANGE = SHIP_TARGET_LENGTH * 10; // Deprecated: Kept for UI compatibility.
const NPC_CHASE_PATH_RECALCULATION_INTERVAL = 2000; // ms. How often an NPC recalculates its path to the player.
const NPC_STRAFING_DISTANCE = (SHIP_TARGET_LENGTH * 16) * 0.9; // Deprecated but kept for safety.
const NPC_NEAR_MISS_RADIUS_MULTIPLIER = 3;        // Ship lengths. A player cannonball within this radius is a provocation.
const NPC_COMBAT_DEACTIVATION_TIME = 30000;       // ms. Time out of range before an NPC disengages.

// --- Navy Ship Specific AI Constants ---
const NAVY_ACTIVATION_PROXIMITY_MULTIPLIER = 3;   // Ship lengths. Player within this distance activates pursuit.
const NAVY_COMBAT_RANGE_MIN_MULTIPLIER = 2;       // Ship lengths. Preferred minimum combat distance.
const NAVY_DISENGAGE_HEALTH_PERCENTAGE = 0.25;    // HP percentage below which a Navy ship will try to disengage entirely.
const NAVY_CLOSE_RANGE_MULTIPLIER = 3;            // Ship lengths. The outer boundary of the close-range bracket (0-3).
const NAVY_MEDIUM_RANGE_MULTIPLIER = 6;           // Ship lengths. The outer boundary of the medium-range bracket (3-6).
const NAVY_FAR_RANGE_MULTIPLIER = 9;              // Ship lengths. The outer boundary of the far-range bracket (6-9).
const NAVY_MEDIUM_RANGE_TURN_LIMIT = Math.PI / 2; // 90 degrees. Max turn to fire in medium range.
const NAVY_FAR_RANGE_TURN_LIMIT = Math.PI / 4;    // 45 degrees. Max turn to fire in far range.
const NAVY_PIVOT_COOLDOWN_HEADING_CHANGE_THRESHOLD = Math.PI / 9; // 20 degrees. Required heading change to reset pivot shot cooldown.
const NAVY_COMBAT_RANGE_EASE_FACTOR = 0.01;       // How quickly the combat zone shrinks/expands. Lower is slower.
const NAVY_COMBAT_EXIT_RANGE_BUFFER = 1.15;       // Ship must be this much further than combat range to disengage from close combat.
const NAVY_DISENGAGE_TIME_MIN = 30000;            // ms. Minimum time to disengage after health drops.
const NAVY_DISENGAGE_TIME_MAX = 60000;            // ms. Maximum time to disengage after health drops.

// --- NEW: Surrender AI Constants ---
const NAVY_SURRENDER_HP_THRESHOLD_RATIO = 0.25;   // Surrender check starts if own HP% is less than this ratio of target's HP%.
const MERCHANT_SURRENDER_HP_THRESHOLD_RATIO = 0.5; // Surrender check starts if own HP% is less than this ratio of target's HP%.
const SURRENDER_CHECK_INTERVAL = 1000;          // ms. How often a ship in combat checks if it should surrender.
const SURRENDER_TIMEOUT_MS = 120000;            // ms. 2 minutes. Time before a surrendered ship recovers or sinks if ignored.

// --- Merchant Ship Specific AI Constants ---

// --- Environmental Hazard Constants ---
const SHOAL_COLOR_OVERLAY_ALPHA = 0.8;
const SHOAL_SLOW_FACTOR_EDGE = 0.001; // Reduced from 0.15
const SHOAL_SLOW_FACTOR_CENTER = 0.00001; // Reduced from 0.05
const SHOAL_HIGH_SPEED_DAMAGE_THRESHOLD = 7.0; // Speed above which minor damage occurs on shoals.
const SHOAL_FULL_SPEED_DAMAGE_THRESHOLD = 11.0; // Speed above which major damage occurs on shoals.
const SHOAL_DAMAGE_FACTOR_HIGH_SPEED = 0.25; // Damage factor for scraping at high speed.
const SHOAL_DAMAGE_FACTOR_FULL_SPEED = 0.75; // Damage factor for grounding at full speed.

const CORAL_REEF_DAMAGE_PER_SECOND = 2.0; // Total damage per second while moving over the reef.
const CORAL_REEF_DAMAGE_THRESHOLD_SPEED = 0.005; // Lowered to be less than wind drift speed.
const CORAL_REEF_SLOW_FACTOR = 0.001; // Factor to slow down ships moving over coral reefs.
const HAZARD_EASING_FACTOR = 0.3; // How quickly speed interpolates to the slow factor. Higher is faster.
const CORAL_SHAPE_MIN_DIAMETER = GRID_SIZE / 4;
const CORAL_SHAPE_MAX_DIAMETER = GRID_SIZE;

// --- Wind Constants ---
const WIND_CHANGE_INTERVAL = 4 * 60 * 1000; // 4 minutes

// --- Day/Night Cycle Constants ---
const DAY_NIGHT_CYCLE_DURATION = 600000; // 10 minutes in ms
const NIGHT_AMBIENT_COLOR = '#000015'; // Deep midnight blue
const LIGHT_COLOR = '#ffaa00'; // Warm yellow-orange

// --- Color Palette ---
const OCEAN_BLUE = '#3498db';
const GRID_COLOR = '#2980b9';
const HULL_COLOR = '#5C543D';
const NPC_COLOR = '#8B4513';
const ISLAND_COLOR = '#D9CC8C';
const ISLAND_GRASS_COLOR = '#4B862D';
const ROCK_COLOR = '#7f8c8d';
const SPAR_DARKER_COLOR = HULL_COLOR; // New: For mast bases, same as hull for now.
const MAST_BASE_COLOR = SPAR_DARKER_COLOR; // Mast base now uses the new distinct color.
const DECK_COLOR = '#C3B091';
const HULL_LIGHTER_COLOR = '#7B7051';
const BULWARK_RAIL_COLOR = '#7B7051'; // New: Distinct color for the rail, same as lighter hull for now.
const HULL_DARKER_COLOR = '#3D3A2B'; // New: Darker shade for the vertical bulwark base.
const BULWARK_RAIL_THICKNESS = CANNON_UNIT_SIZE / 2; // Fixed thickness for bulwark rails
const SPAR_COLOR = '#9A8B71';
const MAST_TOP_COLOR = SPAR_COLOR;
const SAIL_COLOR = 'hsl(0, 0%, 95%)'; // Default off-white (Matches Player)
const PENNANT_COLOR = 'hsl(348, 83%, 47%)'; // Default red (Crimson)
const ANCHOR_POINT_COLOR = 'rgba(0, 0, 0, 0.25)';
const ANCHOR_LINE_COLOR = '#C8AD7F'; // Reverted to original color. Used for lashings.
const ANCHOR_LINE_DASH_COLOR = '#A38B6B';
const STANDING_RIGGING_COLOR = '#211B12'; // New: Very dark brown for stays (10% lightness from #C8AD7F)

// --- Cannon & Cannonball Constants ---
const CANNON_BASE_SIZE = SHIP_TARGET_LENGTH / 10; // Base size relative to ship length.
const CANNON_COLOR = '#343434';
const CANNON_LONG_BASE = CANNON_BASE_SIZE;
const CANNON_PROTRUSION_LENGTH = CANNON_LONG_BASE * 3;
const CANNON_SHORT_BASE = CANNON_LONG_BASE * 0.6;
const CANNON_HALF_PROTRUSION = CANNON_PROTRUSION_LENGTH / 2;
const CANNONBALL_RADIUS = CANNON_LONG_BASE / 4; 
const CANNONBALL_COLOR = '#000000';
const CANNONBALL_SPEED = 30;
const CANNONBALL_MAX_TRAVEL_DISTANCE = 5000;
const PLAYER_CANNON_RELOAD_TIME_MS = 2000;
// --- NEW: Crew Reload Logic Constants ---
const CREW_PER_CANNON_OPTIMAL = 5;
const RELOAD_TIME_BASE_MS = 2000; // 2.0 seconds
const RELOAD_TIME_MIN_CREW_MS = 3600; // 3.6 seconds (at 1 crew/cannon)
const RELOAD_PENALTY_PER_MISSING_CREW_MS = 400; // 0.4 seconds per crew member below optimal
const RELOAD_PENALTY_UNMANNED_MS = 4000; // 4.0 seconds per uncrewed cannon

// --- NEW: Cannonball Damage Constants ---
const CANNONBALL_RIG_HIT_CHANCE = 0.1;      // 10% chance a cannonball hits rigging instead of hull.
const CANNONBALL_HULL_DAMAGE = 1.0;         // Damage dealt to hull HP.
const CANNONBALL_RIG_DAMAGE = 0.5;          // Damage dealt to rig HP.
const CANNONBALL_CREW_DAMAGE_CHANCE = 0.5;  // 50% chance a hull hit also damages crew.
const CANNON_DESTRUCTION_CHANCE = 0.1;      // 10% chance a hull hit destroys a cannon.
const TATTERED_SAIL_UPDATE_THRESHOLD = 0.1; // Update visual sail damage every 10% HP lost.
const CRITICAL_HIT_MAX_MULTIPLIER = 3.0;    // New: Max damage multiplier for a 0/180 degree hit.

// --- NEW: Chain Shot Constants ---
const CHAIN_SHOT_SPEED_MULTIPLIER = 0.5;
const CHAIN_SHOT_RANGE_MULTIPLIER = 0.5;
const CHAIN_SHOT_RIG_DAMAGE_CHANCE = 0.9;
const CHAIN_SHOT_RIG_DAMAGE_MIN = 1;
const CHAIN_SHOT_RIG_DAMAGE_MAX = 5;
const CHAIN_SHOT_HULL_DAMAGE = 0.5;
const CHAIN_SHOT_CREW_DAMAGE_CHANCE = 0.5;
const CHAIN_SHOT_CREW_DAMAGE_MIN = 0;
const CHAIN_SHOT_CREW_DAMAGE_MAX = 2;
const CHAIN_SHOT_SPIN_SPEED = 0.3; // Radians per frame

// --- NEW: Grape Shot Constants ---
const GRAPE_SHOT_SPEED_MULTIPLIER = 0.5;
const GRAPE_SHOT_RANGE_MULTIPLIER = 0.5;
const GRAPE_SHOT_CREW_DAMAGE_CHANCE = 0.8; // No change
const GRAPE_SHOT_CREW_DAMAGE_MIN = 0;
const GRAPE_SHOT_CREW_DAMAGE_MAX = 2;
const GRAPE_SHOT_HULL_DAMAGE = 0.5;
const GRAPE_SHOT_RIG_DAMAGE_MIN = 1;
const GRAPE_SHOT_RIG_DAMAGE_MAX = 2;
const GRAPE_SHOT_COUNT = 15;
const GRAPE_SHOT_SUB_RADIUS_FACTOR = 1/3;
const GRAPE_SHOT_SPREAD_RATE = 0.12; // Rate at which the cluster expands per frame
const GRAPE_SHOT_MAX_SPREAD = 20.0;   // Maximum expansion multiplier

// --- NEW: Canister Shot Constants ---
const CANISTER_SHOT_SPEED_MULTIPLIER = 1/3;
const CANISTER_SHOT_RANGE_MULTIPLIER = 0.25;
const CANISTER_SHOT_CREW_DAMAGE_MIN = 0;
const CANISTER_SHOT_CREW_DAMAGE_MAX = 5;
const CANISTER_SHOT_HULL_DAMAGE = 0.01;
const CANISTER_SHOT_RIG_DAMAGE = 0.1;
const CANISTER_SHOT_SPREAD_RATE = 0.15;

const NAVY_CANNON_RELOAD_TIME_MS = 2000;
const WAKE_TRAIL_LENGTH = 20; // Default length of the wake trail (number of points)
const BOW_WAKE_TRAIL_LENGTH = 15; // Reduced length for bow wakes
const ROLLING_FIRE_DELAY_MS = 15; // ms between shots in a volley
const MERCHANT_CANNON_RELOAD_TIME_MS = 4000; // Merchants are twice as slow to reload.

// --- UI Constants ---
const ZOOM_EASE_FACTOR = 0.05;
const CANNON_RING_BUFFER_BAR_SIZE = 25;
const CANNON_RING_BUFFER_BAR_MARGIN_X = 10;
const CANNON_RING_BUFFER_BAR_MARGIN_Y = 25;
const CANNON_RING_COLOR = '#FFFFFF';
const CANNON_COUNT_TEXT_COLOR = '#FFFFFF';
const CANNON_COUNT_BORDER_COLOR = '#FFFFFF';
const SHOAL_DETECT_INDICATOR_SIZE = 20;
const SHOAL_DETECT_INDICATOR_MARGIN = 15;
const SHOAL_DETECT_INDICATOR_COLOR = '#27ae60';
const CORAL_REEF_DETECT_INDICATOR_SIZE = 20;
const CORAL_REEF_DETECT_INDICATOR_MARGIN_Y_OFFSET = 30;
const CORAL_REEF_DETECT_INDICATOR_COLOR = '#e74c3c';
const PLAYER_COLLISION_FLASH_DURATION = 15;
const SHIP_VIEWPORT_SCALE_FACTOR = 7; // The ship will take up 1/8th of the shorter screen dimension.
const GAME_OVER_BLUR_RADIUS = 5; // Max blur radius in pixels. Set to 0 to disable for performance.

const UI_COMPASS_RING_RADIUS = 36; // New: Radius for the decorative ring on compass-style icons.
const UI_COMPASS_RING_THICKNESS = 4; // New: Line width for compass icon rings.
const KNOTS_TO_GAME_UNITS_PER_SECOND = 5.1444; // Conversion factor for speed calculations.

// --- NEW: Ship Design Balance Configuration ---
const SHIP_DESIGN_RULES = {
    BEAM_RATIO_MIN: 2.0,
    GUN_BASED_MAX_BEAM_RATIO: [
        { guns: 1, max: 2.0 },
        { guns: 2, max: 2.3 },
        { guns: 4, max: 2.5 },
        { guns: 7, max: 3.5 },
        { guns: Infinity, max: 4.0 }
    ],
    CARGO_BASED_MAX_BEAM_RATIO: [
        { capacity: 3, max: 2.0 },
        { capacity: 6, max: 2.3 },
        { capacity: 20, max: 2.5 },
        { capacity: 40, max: 3.5 },
        { capacity: Infinity, max: 4.0 }
    ],
    DECK_BASED_MAX_BEAM_RATIO: {
        1: 4.0,
        2: 3.75,
        3: 3.5
    }
};

// --- Asset Paths ---
const SHIP_HULL_VISUAL_SVG_URL = 'assets/svg/ship-hull-visual.svg';
const SHIP_HULL_COLLISION_SVG_URL = 'assets/svg/ship-hull-collision.svg';
const SAIL_SVG_URL = 'assets/svg/sail.svg';
const ANCHOR_ICON_SVG_URL = 'assets/svg/anchor-icon.svg';
const GAFF_SAIL_LOWER_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 100 1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><g transform="matrix(1,0,0,1,-24607.1,-47423.5)"><g transform="matrix(1,0,0,1,23157.1,46923.5)"><g transform="matrix(1.49002e-16,-2.43339,1.17495,7.19447e-17,-92937.2,93116.7)"><path d="M38060.7,80418.4L37649.8,80418.4C37704.3,80363.9 37778.2,80333.3 37855.2,80333.3C37932.3,80333.3 38006.2,80363.9 38060.7,80418.4Z" style="fill:white;"/></g></g></g></svg>`);
const GAFF_SAIL_UPPER_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 1000 100" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><g transform="matrix(1,0,0,1,500,50)"><g transform="matrix(-1,0,0,1,441.772,0)"><path d="M941.772,-50C809.164,14.029 629.309,50 441.772,50C254.236,50 74.381,14.029 -58.228,-50L541.772,-50C594.816,-24.388 666.758,-10 741.772,-10C816.787,-10 888.729,-24.388 941.772,-50Z" style="fill:white;"/></g></g></svg>`);
const JIB_SAIL_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 100 1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><g transform="matrix(1,0,0,1,-24107.1,-47423.5)"><g transform="matrix(1,0,0,1,23157.1,46923.5)"><g transform="matrix(-6.88851e-17,1.12067,0.112067,6.75578e-18,-26.0852,-36035.3)"><path d="M33047.5,8709.83C33270.5,9602.15 33493.6,9602.15 33493.6,9602.15L32601.3,9602.15C32657.1,9602.15 32824.4,8709.83 33047.5,8709.83Z" style="fill:white;"/></g></g></g></svg>`);
const GAFF_TOPSAIL_LOWER_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 1000 100" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><g transform="matrix(1,0,0,1,500,50)"><g transform="matrix(1.01225,-1.37739e-17,-2.32434e-18,0.101225,-34194.5,-941.135)"><path d="M33945.3,8803.51C34274.6,8803.51 34274.6,9791.41 34274.6,9791.41L33286.7,9791.41C33286.7,9791.41 33616,8803.51 33945.3,8803.51Z" style="fill:white;"/></g></g></svg>`);
const GAFF_TOPSAIL_UPPER_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 1000 100" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><path d="M31657.1,12520C31657.1,12520 31513.1,12160 31513.1,11800C31513.1,11440 31657.1,11440 31657.1,11440C31657.1,11440 31621.1,11440 31621.1,11800C31621.1,12160 31657.1,12520 31657.1,12520Z" style="fill:white;"/></svg>`);
const NAVIGATION_ICON_SVG_URL = 'assets/svg/Navigation Icon.svg';
const NAVIGATION_ICON_DIAGONAL_SVG_URL = 'assets/svg/Navigation Icon Diagonal.svg';
const CANNON_SVG_URL = 'assets/svg/cannon-visual.svg'; // New asset path
const SKULL_ICON_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 322 310" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    <g transform="matrix(1,0,0,1,-3495.98,-17459.2)">
        <g transform="matrix(1,0,0,1,-1547.03,-24967.9)">
            <path d="M5262.51,42665.7L5308.86,42687.1C5314.29,42689.4 5318.63,42688.7 5322.7,42687.4C5329.13,42685.5 5334.19,42686.6 5339.53,42688.8C5345.96,42692 5346.14,42696.6 5341.98,42701.3C5338.18,42705.7 5334.38,42708 5329.76,42712.4C5328.77,42719.5 5329.4,42726.1 5326.23,42732.7C5322.25,42738.5 5318,42737.5 5311.31,42731.4C5304.52,42726.1 5306.96,42720.3 5297.19,42711.8L5254.31,42689.6C5257.33,42685.3 5259.6,42680.7 5260.68,42676.3C5261.56,42673 5262.19,42669.4 5262.51,42665.7ZM5139.69,42623.6C5142.93,42631.7 5145.67,42639.7 5146.01,42648.1C5145.53,42650.2 5145.19,42652.4 5144.98,42654.6C5124.19,42644.4 5100.64,42633.1 5079.08,42623C5068.01,42620.8 5063.66,42626.2 5051.63,42623.2C5047.41,42622.2 5039.54,42619.5 5044.72,42611.1C5048.31,42605.3 5053.23,42602.6 5057.58,42597.9C5057.97,42591.8 5057.77,42585.5 5060.27,42579.7C5064.17,42573.1 5067.69,42574.2 5072.55,42576.6C5083.62,42583.3 5080.68,42591.6 5089.82,42598.8C5106.65,42608.1 5122.67,42615.3 5139.69,42623.6ZM5144.95,42665.2C5145.27,42669.1 5145.91,42672.9 5146.82,42676.3C5147.9,42680.6 5150.14,42685.3 5153.11,42689.6L5109.1,42712.9C5105.93,42716.7 5103.31,42721.3 5100.95,42725.4C5099.24,42728.5 5096.43,42731 5094.17,42733.8C5089.01,42737.8 5083.04,42738.3 5080.33,42730C5079.6,42723.3 5079.42,42718.5 5078.16,42712.9C5074.18,42709 5071.01,42706.2 5066.48,42701.8C5062.6,42697.7 5062.5,42692.3 5067.3,42688.5C5084.13,42682.9 5083.58,42691.4 5097.43,42688C5114.44,42681.4 5130.12,42673.1 5144.95,42665.2ZM5267.86,42623.5C5284.69,42615.2 5301.53,42607 5316.73,42599.5C5326.05,42591.7 5323.7,42584.2 5331.12,42578.6C5338.45,42571.6 5343.33,42573.3 5346.05,42577.2C5348.67,42583.8 5349.94,42590.4 5349.58,42597.3C5356.54,42603.7 5360.25,42607.4 5364.23,42613.3C5364.78,42620.7 5358.26,42623.8 5350.39,42623.9C5340.08,42625.8 5338.45,42619.3 5326.78,42623.9L5262.49,42654.2C5262.28,42652.1 5261.95,42650 5261.5,42648.1C5261.84,42639.7 5264.6,42631.6 5267.86,42623.5Z"/>
        </g>
        <path d="M3628.5,17707.9C3629.16,17708.2 3629.83,17708.4 3630.51,17708.7C3630.01,17706.4 3629.67,17703.3 3629.67,17698.9C3629.67,17697.7 3631.69,17696.7 3634.17,17696.7C3636.66,17696.7 3638.67,17697.7 3638.67,17698.9C3638.67,17704.6 3638.09,17708.2 3637.34,17710.6C3638.09,17710.7 3638.84,17710.9 3639.6,17711C3639.07,17708.7 3638.7,17705.5 3638.7,17700.9C3638.7,17699.7 3640.71,17698.7 3643.2,17698.7C3645.68,17698.7 3647.7,17699.7 3647.7,17700.9C3647.7,17706.1 3647.21,17709.6 3646.55,17711.9C3647.18,17712 3647.8,17712 3648.43,17712.1C3648.01,17709.9 3647.72,17706.9 3647.72,17702.9C3647.72,17701.7 3649.74,17700.7 3652.22,17700.7C3654.7,17700.7 3656.72,17701.7 3656.72,17702.9C3656.72,17707.1 3656.4,17710.2 3655.93,17712.5C3656.34,17712.5 3656.76,17712.5 3657.17,17712.5C3657.3,17712.5 3657.42,17712.5 3657.55,17712.5C3657.07,17710.3 3656.74,17707.2 3656.74,17702.9C3656.74,17701.7 3658.76,17700.7 3661.24,17700.7C3663.73,17700.7 3665.74,17701.7 3665.74,17702.9C3665.74,17707.1 3665.43,17710.1 3664.97,17712.4C3665.64,17712.3 3666.3,17712.2 3666.96,17712.2C3666.27,17709.8 3665.74,17706.3 3665.74,17700.9C3665.74,17699.7 3667.76,17698.7 3670.24,17698.7C3672.73,17698.7 3674.74,17699.7 3674.74,17700.9C3674.74,17705.6 3674.35,17708.8 3673.8,17711.1C3674.59,17711 3675.36,17710.8 3676.12,17710.6C3675.37,17708.3 3674.77,17704.7 3674.77,17698.9C3674.77,17697.7 3676.78,17696.7 3679.27,17696.7C3681.75,17696.7 3683.77,17697.7 3683.77,17698.9C3683.77,17703.2 3683.43,17706.3 3682.95,17708.6C3683.61,17708.4 3684.26,17708.1 3684.9,17707.9C3684.25,17705.5 3683.77,17702.1 3683.77,17696.9C3683.77,17695.7 3685.78,17694.7 3688.27,17694.7C3690.75,17694.7 3692.77,17695.7 3692.77,17696.9C3692.77,17699.9 3692.61,17702.2 3692.36,17704.2C3696.15,17701.8 3699.03,17699.1 3700.61,17696.2C3701.99,17685.2 3702.83,17680.3 3705.08,17672.5C3707.75,17663.8 3709.42,17656 3712.61,17651.8C3715.13,17648.5 3724.24,17647.3 3724.24,17647.3C3719.71,17658.3 3714.92,17668.9 3714.46,17680.2C3716.55,17689.2 3715.91,17699.9 3713.65,17708.4C3710.75,17720.1 3699.31,17733.5 3688,17738.1C3676.85,17742.7 3669.66,17743.8 3657.06,17743.8L3656.52,17743.8C3643.92,17743.8 3636.72,17742.7 3625.31,17738.5C3614,17733.9 3602.69,17720.1 3599.79,17708.4C3597.53,17699.9 3596.9,17689.2 3598.98,17680.2C3598.52,17668.9 3593.73,17658.3 3589.21,17647.3C3589.21,17647.3 3598.11,17648.9 3600.56,17652.3C3603.7,17656.5 3605.41,17664.3 3608.09,17672.9C3610.32,17680.8 3611.17,17685.6 3612.53,17696.6C3615.15,17699.6 3617.99,17702.1 3621.05,17704.1C3620.8,17702.2 3620.65,17699.8 3620.65,17696.9C3620.65,17695.7 3622.66,17694.7 3625.15,17694.7C3627.63,17694.7 3629.65,17695.7 3629.65,17696.9C3629.65,17702.1 3629.16,17705.6 3628.5,17707.9Z"/>
        <path d="M3621.95,17675.2C3621.1,17674.9 3620.28,17674.6 3619.49,17674.2L3619.49,17674C3619.61,17667.9 3618.27,17663 3612.66,17657C3607.95,17653.5 3604.72,17650.7 3598.49,17649C3594.87,17647.9 3591.34,17646.9 3588.07,17645.5C3585.15,17644.3 3582.45,17642.7 3580.06,17640.6C3575.01,17636.1 3571.09,17624.3 3572.48,17610.7C3573.11,17607 3573.95,17603.1 3574.76,17599L3574,17598.2C3561.53,17586 3552.81,17565 3551.6,17542.2C3550.28,17517.2 3563.47,17492.3 3583.24,17478.1C3605.39,17462.6 3642.42,17458.2 3665.45,17459.4C3681.04,17459.4 3715.78,17467.5 3728.05,17476.6C3749.56,17492.3 3761.1,17514.5 3761.89,17539.8C3763.08,17565.2 3752.37,17584.6 3739.26,17596.6L3738.99,17596.9C3739.9,17601.6 3740.89,17606.1 3741.6,17610.3C3742.99,17623.9 3739.07,17635.7 3734.02,17640.2C3731.83,17642.2 3728.85,17643.7 3725.84,17645C3721.91,17646.6 3717.93,17647.8 3715.59,17648.7C3710.78,17650.4 3705.86,17653.4 3701.42,17656.9C3696.08,17662.1 3694.47,17667.5 3694.6,17673.6L3694.6,17673.7C3693.6,17674.2 3692.56,17674.6 3691.48,17675C3692.2,17677.4 3692.74,17680.9 3692.74,17686.4C3692.74,17687.7 3690.73,17688.7 3688.24,17688.7C3685.76,17688.7 3683.74,17687.7 3683.74,17686.4C3683.74,17682.3 3684.06,17679.2 3684.52,17677C3683.96,17677.1 3683.4,17677.2 3682.83,17677.3C3683.36,17679.6 3683.74,17682.9 3683.74,17687.4C3683.74,17688.7 3681.73,17689.7 3679.24,17689.7C3676.76,17689.7 3674.74,17688.7 3674.74,17687.4C3674.74,17683.5 3675.03,17680.5 3675.45,17678.3C3674.92,17678.4 3674.4,17678.4 3673.87,17678.5C3674.38,17680.8 3674.74,17684 3674.74,17688.4C3674.74,17689.7 3672.73,17690.7 3670.24,17690.7C3667.76,17690.7 3665.74,17689.7 3665.74,17688.4C3665.74,17684.3 3666.06,17681.2 3666.53,17678.9C3665.94,17679 3665.35,17679 3664.75,17679C3665.33,17681.3 3665.74,17684.6 3665.74,17689.4C3665.74,17690.7 3663.73,17691.7 3661.24,17691.7C3658.76,17691.7 3656.74,17690.7 3656.74,17689.4C3656.74,17684.7 3657.14,17681.4 3657.71,17679.1C3657.62,17679.1 3657.53,17679.1 3657.44,17679.1C3656.89,17679.1 3656.34,17679.1 3655.79,17679.1C3656.35,17681.5 3656.74,17684.8 3656.74,17689.4C3656.74,17690.7 3654.73,17691.7 3652.24,17691.7C3649.76,17691.7 3647.74,17690.7 3647.74,17689.4C3647.74,17684.7 3648.15,17681.4 3648.71,17679.1C3648.14,17679.1 3647.56,17679.1 3646.99,17679.1C3647.44,17681.3 3647.74,17684.3 3647.74,17688.4C3647.74,17689.7 3645.73,17690.7 3643.24,17690.7C3640.76,17690.7 3638.74,17689.7 3638.74,17688.4C3638.74,17684.1 3639.09,17680.9 3639.59,17678.7C3639.08,17678.6 3638.58,17678.6 3638.08,17678.5C3638.48,17680.7 3638.74,17683.6 3638.74,17687.4C3638.74,17688.7 3636.73,17689.7 3634.24,17689.7C3631.76,17689.7 3629.74,17688.7 3629.74,17687.4C3629.74,17683 3630.1,17679.8 3630.62,17677.5C3630.08,17677.4 3629.54,17677.3 3629.01,17677.2C3629.45,17679.4 3629.74,17682.4 3629.74,17686.4C3629.74,17687.7 3627.73,17688.7 3625.24,17688.7C3622.76,17688.7 3620.74,17687.7 3620.74,17686.4C3620.74,17681.1 3621.26,17677.6 3621.95,17675.2ZM3712.92,17577.3C3704.14,17575.8 3672.75,17568.4 3672.75,17593.9C3672.75,17603.7 3682.34,17610.3 3688.76,17617.7C3693.74,17623.3 3699.66,17624.3 3705.32,17622.4C3709.88,17621.1 3714.09,17618.3 3718.62,17611.8C3720.61,17606.2 3722.33,17603.3 3724.86,17596.3C3726.85,17589.9 3723.75,17580.3 3712.92,17577.3ZM3656.74,17613.9C3650.42,17618.7 3649.02,17620.3 3645.52,17625.6C3644.26,17627.7 3641.9,17632.5 3641.25,17635.7C3640.61,17638.9 3640.12,17643.6 3640.13,17646.1C3640.13,17654.5 3642.8,17659.7 3645.71,17659.5C3648.32,17659.2 3651.72,17656.7 3656.74,17650.5C3661.76,17656.7 3665.17,17659.4 3667.77,17659.7C3670.69,17659.8 3673.36,17654.6 3673.36,17646.2C3673.36,17643.7 3672.88,17639.1 3672.24,17635.9C3671.59,17632.6 3669.23,17627.8 3667.97,17625.8C3664.47,17620.5 3663.07,17618.7 3656.74,17613.9ZM3600.72,17577.3C3589.88,17580.3 3586.79,17589.9 3588.78,17596.3C3591.31,17603.3 3593.03,17606.2 3595.02,17611.8C3599.54,17618.3 3603.76,17621.1 3608.32,17622.4C3613.97,17624.3 3619.9,17623.3 3624.88,17617.7C3631.3,17610.3 3640.89,17603.7 3640.89,17593.9C3640.89,17568.2 3609.49,17575.8 3600.72,17577.3Z"/>
    </g>
</svg>`);
// --- Pre-calculated Asset Data (to be populated after loading) ---
let SHIP_HULL_BASE_VISUAL_POLYGON;
let SHIP_DECK_VISUAL_POLYGON;
let SHIP_BULWARK_VISUAL_POLYGON;
let SHIP_BULWARK_INNER_CUTOUT_VISUAL_POLYGON;
let SHIP_HULL_BASE_COLLISION_POLYGON;
let SHIP_BOW_LOCAL_X_OFFSET;
let SHIP_STERN_LOCAL_X_OFFSET;
let SHIP_HULL_VISUAL_SVG_DATA_CACHE; // New: Cache the raw SVG data for the hull shape
let SAIL_SVG_DATA_CACHE; // New: Cache the raw SVG data for the sail
let JIB_SAIL_SVG_DATA_CACHE; // New: Cache for the Jib Sail
let GAFF_SAIL_LOWER_SVG_DATA_CACHE; // New: Cache for the lower gaff sail
let GAFF_SAIL_UPPER_SVG_DATA_CACHE; // New: Cache for the gaff sail upper part
let GAFF_TOPSAIL_LOWER_SVG_DATA_CACHE; // New: Cache for the gaff-topsail
let GAFF_TOPSAIL_UPPER_SVG_DATA_CACHE; // New: Cache for the gaff-topsail upper part
let SAIL_STRAIGHT_EDGE_LOCAL_X;
let ANCHOR_ICON_DATA;
let NAVIGATION_ICON_DATA; // New: Cache for the navigation icon
let NAVIGATION_ICON_DIAGONAL_DATA; // New: Cache for the diagonal star
let CANNON_VISUAL_PARTS; // New variable for parsed cannon data
let SKULL_ICON_COMPLEX_DATA; // New: Cache for the complex skull icon
let SKULL_ICON_CACHE; // New: Pre-rendered canvas for the skull icon

/**
 * Initializes configuration constants that depend on asynchronously loaded assets.
 * This function should be called after the SVG path data has been fetched.
 * @param {object} loadedSvgData - An object mapping asset keys to their SVG path 'd' strings.
 */
function initializeAssetDependentConfigs(loadedSvgData) {
    SHIP_HULL_VISUAL_SVG_DATA_CACHE = loadedSvgData.shipHullVisual; // Cache the raw hull data
    GAFF_SAIL_LOWER_SVG_DATA_CACHE = loadedSvgData.gaffSailLower; // Cache the raw lower gaff sail data
    GAFF_SAIL_UPPER_SVG_DATA_CACHE = loadedSvgData.gaffSailUpper; // Cache the raw gaff sail upper part
    JIB_SAIL_SVG_DATA_CACHE = loadedSvgData.jibSail; // Cache the raw Jib Sail data
    GAFF_TOPSAIL_LOWER_SVG_DATA_CACHE = loadedSvgData.gaffTopsailLower; // Cache the new data
    GAFF_TOPSAIL_UPPER_SVG_DATA_CACHE = loadedSvgData.gaffTopsailUpper; // Cache the new data    
    const visualHullResult = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, SHIP_TARGET_LENGTH, SHIP_TARGET_WIDTH, 20, true, true);
    SHIP_HULL_BASE_VISUAL_POLYGON = visualHullResult.points;

    // --- RESTORED: Deck and Bulwark Visual Polygons ---
    const deckResult = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, SHIP_TARGET_LENGTH, SHIP_TARGET_WIDTH * 0.9, 20, true, true);
    SHIP_DECK_VISUAL_POLYGON = deckResult.points;

    const bulwarkResult = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, SHIP_TARGET_LENGTH, SHIP_TARGET_WIDTH * 0.9, 20, true, true);
    SHIP_BULWARK_VISUAL_POLYGON = bulwarkResult.points;

    const bulwarkInnerResult = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, SHIP_TARGET_LENGTH * 0.9, SHIP_TARGET_WIDTH * 0.8, 20, true, true);
    SHIP_BULWARK_INNER_CUTOUT_VISUAL_POLYGON = bulwarkInnerResult.points;

    const collisionHullResult = parseAndFlattenSvgPath(loadedSvgData.shipHullCollision, SHIP_TARGET_LENGTH, SHIP_TARGET_WIDTH, 1, true, true);
    SHIP_HULL_BASE_COLLISION_POLYGON = collisionHullResult.points;
    ensureClockwiseWinding(SHIP_HULL_BASE_COLLISION_POLYGON);

    SHIP_BOW_LOCAL_X_OFFSET = SHIP_HULL_BASE_COLLISION_POLYGON.reduce((max, p) => Math.max(max, p.x), -Infinity);
    SHIP_STERN_LOCAL_X_OFFSET = SHIP_HULL_BASE_COLLISION_POLYGON.reduce((min, p) => Math.min(min, p.x), Infinity);

    SAIL_SVG_DATA_CACHE = loadedSvgData.sail;
    const sailResult = parseAndFlattenSvgPath(SAIL_SVG_DATA_CACHE, (SHIP_TARGET_WIDTH * 2) / 10, SHIP_TARGET_WIDTH * 2, 20, true, true);
    SAIL_STRAIGHT_EDGE_LOCAL_X = sailResult.straightEdgeGameX;

    ANCHOR_ICON_DATA = parseSvgPathToLocalCoordinates(loadedSvgData.anchorIcon);
    NAVIGATION_ICON_DATA = parseSvgPathToLocalCoordinates(loadedSvgData.navigationIcon);
    NAVIGATION_ICON_DIAGONAL_DATA = parseSvgPathToLocalCoordinates(loadedSvgData.navigationIconDiagonal);
    CANNON_VISUAL_PARTS = parseMultiPartSvg(loadedSvgData.cannonVisual);
    
    // Parse the complex skull icon (multiple paths with transforms)
    const parser = new DOMParser();
    const doc = parser.parseFromString(loadedSvgData.skullIcon, "image/svg+xml");
    SKULL_ICON_COMPLEX_DATA = [];
    
    function traverse(node, currentMatrix) {
        let nextMatrix = [...currentMatrix];
        
        if (node.getAttribute && node.getAttribute("transform")) {
            const t = node.getAttribute("transform");
            const match = /matrix\(([^)]+)\)/.exec(t);
            if (match) {
                const m = match[1].split(/[ ,]+/).map(parseFloat);
                // Multiply currentMatrix * m
                const [a1, b1, c1, d1, e1, f1] = currentMatrix;
                const [a2, b2, c2, d2, e2, f2] = m;
                
                nextMatrix[0] = a1 * a2 + c1 * b2;
                nextMatrix[1] = b1 * a2 + d1 * b2;
                nextMatrix[2] = a1 * c2 + c1 * d2;
                nextMatrix[3] = b1 * c2 + d1 * d2;
                nextMatrix[4] = a1 * e2 + c1 * f2 + e1;
                nextMatrix[5] = b1 * e2 + d1 * f2 + f1;
            }
        }
        
        if (node.tagName === "path") {
            SKULL_ICON_COMPLEX_DATA.push({
                d: node.getAttribute("d"),
                matrix: nextMatrix
            });
        }
        
        for (let i = 0; i < node.children.length; i++) {
            traverse(node.children[i], nextMatrix);
        }
    }
    
    // Start traversal with identity matrix
    if (doc.documentElement) {
        traverse(doc.documentElement, [1, 0, 0, 1, 0, 0]);
    }

    // --- NEW: Generate Skull Icon Cache ---
    if (SKULL_ICON_COMPLEX_DATA.length > 0) {
        const padding = 20; // Space for shadow
        const width = 322 + padding * 2;
        const height = 310 + padding * 2;
        
        SKULL_ICON_CACHE = document.createElement('canvas');
        SKULL_ICON_CACHE.width = width;
        SKULL_ICON_CACHE.height = height;
        const ctx = SKULL_ICON_CACHE.getContext('2d');
        // Defensive check: If context creation fails, return early to prevent TypeError.
        // This can happen if canvas dimensions are excessively large or due to browser issues.
        if (!ctx) {
            console.warn(`Failed to get 2D context for skull icon cache. Width: ${width}, Height: ${height}.`);
            return;
        }

        ctx.translate(padding, padding);
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        
        SKULL_ICON_COMPLEX_DATA.forEach(part => {
            ctx.save();
            ctx.transform(...part.matrix);
            ctx.fill(new Path2D(part.d));
            ctx.restore();
        });
    }
}

// --- NPC Name Lists ---
const NPC_NAME_CATEGORIES = {
    animals: [
        "Alerion", "Bison", "Boar", "Bull", "Eagle", "Falcon", "Fox", "Hydra", "Kestrel", "Kraken", 
        "Leviathan", "Lion", "Lioness", "Lynx", "Marlin", "Osprey", "Otter", "Panther", "Phoenix", 
        "Seraph", "Serapis", "Stag", "Wolf", "Wolfhound"
    ],
    objects: [
        "Aegis", "Crown", "Edict", "Iron", "Ironside", "Mandate", "Oath", "Testament", "Trident"
    ],
    abstract: [
        "Absolution", "Ascendant", "Benediction", "Covenant", "Dignity", "Endeavor", "Faith", "Grace", 
        "Honor", "Immutable", "Immortal", "Incorruptible", "Mandala", "Mercy", "Oath", "Peace", 
        "Penance", "Perseverance", "Providence", "Radiant", "Reign", "Reproval", "Requiem", "Silence", 
        "Spirit", "Strength", "Tempest", "Tenacity", "Valor", "Virtue", "Will"
    ],
    martial: [
        "Adamant", "Ardent", "Audacious", "Bravura", "Custodian", "Dauntless", "Defiant", "Dire", 
        "Formidable", "Gallant", "Guardian", "Immovable", "Imperial", "Imperious", "Implacable", 
        "Indefatigable", "Indignant", "Indomitable", "Inflexible", "Intrepid", "Majestic", "Obdurate", 
        "Relentless", "Resolute", "Sable", "Stalwart", "Steadfast", "Unyielding", "Valiant", "Valorous", 
        "Vigilant"
    ],
    roles: [
        "Arbiter", "Champion", "Custodian", "Judicator", "Monarch", "Nemesis", "Rex", "Sovereign", 
        "Venator", "Warrior"
    ],
    natural: [
        "Aeonian", "Aetheria", "Aurora", "Celestial", "Eclipse", "Eternal", "Equinox", "Halcyon", 
        "Maelstrom", "Majesty", "Onyx", "Sea", "Verdure", "Zephyr"
    ],
    emotion: [
        "Eminence", "Fervent", "Glory", "Gravitas", "Nemesis", "Obsidian", "Serene", "Triumph", 
        "Vigil", "Zealot"
    ]
};