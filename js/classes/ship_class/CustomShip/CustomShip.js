/**
 * Defines the points of sail performance curves for different rig categories.
 * Each point is an object { angle, speed }, where 'angle' is the degrees off from a direct downwind run,
 * and 'speed' is the speed multiplier (0.0 to 1.0).
 */
const RIG_PERFORMANCE_CURVES = {
    // --- Square Rigs (Best Downwind) ---
    'full-rigged': [
        { angle: 0,   speed: 0.95 }, // Dead run is inefficient
        { angle: 20,  speed: 1.0 },  // Sweet spot is a broad reach
        { angle: 80,  speed: 1.0 },  // Maintains top speed across a wide arc
        { angle: 125, speed: 0.3 },
        { angle: 145, speed: 0.0 },  // Very poor upwind
        { angle: 180, speed: 0.0 }
    ],
    'brig': [
        { angle: 0,   speed: 0.95 }, // Excellent running speed
        { angle: 75,  speed: 1.0 },
        { angle: 130, speed: 0.25 },
        { angle: 150, speed: 0.0 },  // Poor upwind
        { angle: 180, speed: 0.0 }
    ],
    'square': [ // The most basic square rig
        { angle: 0,   speed: 0.95 }, // Dead run is inefficient
        { angle: 15,  speed: 1.0 },  // Sweet spot is a broad reach
        { angle: 70,  speed: 1.0 },  // Maintains top speed
        { angle: 130, speed: 0.25 }, // Broad Reaching
        { angle: 150, speed: 0.0 },  // Close-Hauled
        { angle: 180, speed: 0.0 }   // In Irons
    ],
    // --- Fore-and-Aft Rigs (Best Upwind/Reaching) ---
    'schooner': [
        { angle: 0,   speed: 0.6 },
        { angle: 50,  speed: 0.85 },
        { angle: 95,  speed: 1.0 },  // Excellent beam reach
        { angle: 145, speed: 0.25 }, // Best upwind performance
        { angle: 180, speed: 0.0 }
    ],
    'three-mast-schooner': [
        { angle: 0,   speed: 0.65 },
        { angle: 50,  speed: 0.8 },
        { angle: 90,  speed: 1.0 },
        { angle: 140, speed: 0.2 }, // Great upwind performance
        { angle: 180, speed: 0.0 }
    ],
    'fore-and-aft-sloop': [
        { angle: 0,   speed: 0.6 },  // Running
        { angle: 45,  speed: 0.8 },
        { angle: 90,  speed: 1.0 },  // Beam Reaching (Sweet Spot)
        { angle: 140, speed: 0.2 },  // Close-Hauled
        { angle: 180, speed: 0.0 }   // In Irons
    ],
    // --- Mixed/Hybrid Rigs (All-Rounders) ---
    'barque': [ // Mostly square sails
        { angle: 0,   speed: 0.9 },
        { angle: 60,  speed: 1.0 },
        { angle: 120, speed: 0.8 },
        { angle: 150, speed: 0.1 },
        { angle: 180, speed: 0.0 }
    ],
    'barquentine': [ // Mostly fore-and-aft sails
        { angle: 0,   speed: 0.75 },
        { angle: 50,  speed: 0.9 },
        { angle: 100, speed: 1.0 },
        { angle: 145, speed: 0.15 },
        { angle: 180, speed: 0.0 }
    ],
    'brigantine': [ // True half-and-half
        { angle: 0,   speed: 0.9 },
        { angle: 10,  speed: 0.95 }, // Slight improvement off dead run
        { angle: 45,  speed: 1.0 },  // Reaches sweet spot quickly
        { angle: 110, speed: 1.0 },  // Reaching (Wide Sweet Spot)
        { angle: 145, speed: 0.15 }, // Close-Hauled
        { angle: 180, speed: 0.0 }   // In Irons
    ]
    ,
    'sloop': [ // Versatile small mixed rig
        { angle: 0,   speed: 0.85 },
        { angle: 15,  speed: 0.95 }, // Slight improvement off dead run
        { angle: 50,  speed: 1.0 },  // Reaches sweet spot
        { angle: 120, speed: 0.9 },
        { angle: 148, speed: 0.1 },
        { angle: 180, speed: 0.0 }
    ]
};

/**
 * Defines the minimum angle off the wind (in degrees) that each rig can effectively sail.
 * Lower is better (closer to the wind).
 */
const RIG_CLOSE_HAULED_ANGLES = {
    'fore-and-aft-sloop': 40,
    'schooner': 45,
    'three-mast-schooner': 45,
    'brigantine': 50,
    'barquentine': 50,
    'sloop': 50,
    'barque': 55,
    'brig': 60,
    'full-rigged': 60,
    'square': 60
};

/// <reference path="Rigs/SquareRig.js" />
/// <reference path="Rigs/SloopRig.js" />
/// <reference path="Rigs/BrigRig.js" />
/// <reference path="Rigs/FullRiggedShipRig.js" />
/// <reference path="Rigs/ForeAndAftSloopRig.js" />
/// <reference path="Rigs/SchoonerRig.js" />
/// <reference path="Rigs/ThreeMastSchoonerRig.js" />
/// <reference path="Rigs/BrigantineRig.js" />
/// <reference path="Rigs/BarqueRig.js" />
/// <reference path="Rigs/BarquentineRig.js" />
/**
 * Represents a procedurally generated ship, configured by a "blueprint" object.
 * This class extends the base Ship class to allow for dynamic geometry and attributes.
 */
class CustomShip extends Ship {
    /**
     * Helper to get a shared offscreen canvas for temporary composite operations.
     * This avoids creating new DOM elements every frame or draw call.
     * @returns {HTMLCanvasElement}
     */
    static getSharedCutoutCanvas() {
        if (!CustomShip._sharedCutoutCanvas) {
            CustomShip._sharedCutoutCanvas = document.createElement('canvas');
        }
        return CustomShip._sharedCutoutCanvas;
    }

    /**
     * Static cache for the surrender flag's tattered edge geometry.
     * Returns an array of points defining the jagged edge relative to the flag's end.
     */
    static getSurrenderFlagTatters() {
        if (!this._surrenderTatters) {
            this._surrenderTatters = [];
            const numTatters = 7; // Number of points along the edge
            for (let i = 0; i <= numTatters; i++) {
                const yRatio = i / numTatters;
                // Zig-zag pattern: Odd indices indent inwards
                const indent = (i % 2 === 1) ? 1 : 0; 
                this._surrenderTatters.push({ y: yRatio, indent: indent });
            }
        }
        return this._surrenderTatters;
    }

    /**
     * @param {number} x - The initial X position in the world.
     * @param {number} y - The initial Y position in the world.
     * @param {object} blueprint - The configuration object from the ShipGenerator.
     * @param {object} [options={}] - An object for optional parameters like pennantColor and sailColor.
     */
    constructor(x, y, blueprint, options = {}) {        
        const {
            primaryHullColor = HULL_COLOR,
            secondaryHullColor = HULL_DARKER_COLOR,
            bulwarkRailColor = BULWARK_RAIL_COLOR,
            sparDarkerColor = SPAR_DARKER_COLOR,
            deckColor = DECK_COLOR, // New: Accept custom deck color
            ...baseOptions
        } = options;

        // Call the parent constructor with the same default hull color as the PlayerShip
        // to ensure good visual contrast with the deck.
        // --- FIX: Safely access blueprint properties, providing defaults if it's null. ---
        // --- FIX: Determine all necessary stats BEFORE the single super() call. ---
        const reloadTime = blueprint?.stats?.reloadTime || PLAYER_CANNON_RELOAD_TIME_MS;
        
        // --- NEW: Calculate Max HP from Dimensions (Procedural) ---
        let maxHp = 10; // Default fallback
        if (blueprint && blueprint.dimensions && blueprint.layout) {
            const dims = blueprint.dimensions;
            const numDecks = blueprint.layout.numDecks || 1;
            
            // Formula: (Length + Beam + Draught) * NumDecks
            // We use raw values here for better precision than the UI's toFixed() strings.
            const lengthU = dims.length / CARGO_UNIT_SIZE;
            const beamU = dims.width / CARGO_UNIT_SIZE;
            const draughtU = (blueprint.draughtFactor * dims.width) / CARGO_UNIT_SIZE;
            
            let calculatedHp = (lengthU + beamU + draughtU) * numDecks;

            // --- NEW: Add Superstructures (Castles & Decks) ---
            // We add (Length + Width) for each structure, excluding deckhouses.
            if (blueprint.geometry) {
                const geo = blueprint.geometry;
                const structures = ['forecastle', 'aftercastle', 'midcastle', 'sterncastle', 'spardeck', 'spardeckSterncastle'];
                
                structures.forEach(type => {
                    if (geo[type]) {
                        // Use hull points to determine bounds
                        const points = geo[type].hull || geo[type].deck;
                        if (points && points.length > 0) {
                            const xs = points.map(p => p.x);
                            const ys = points.map(p => p.y);
                            const sLength = (Math.max(...xs) - Math.min(...xs)) / CARGO_UNIT_SIZE;
                            const sWidth = (Math.max(...ys) - Math.min(...ys)) / CARGO_UNIT_SIZE;
                            calculatedHp += (sLength + sWidth);
                        }
                    }
                });
            }
            maxHp = Math.round(calculatedHp);
        } else if (blueprint?.stats?.maxHp) {
            maxHp = blueprint.stats.maxHp;
        }

        // --- FIX: Make only ONE call to super() with all correct values. ---
        super(x, y, HULL_COLOR, maxHp, 8, 1, { ...baseOptions, reloadTime });

        // --- NEW: Add reload timers for broadsides ---
        // These are necessary for the new fireBroadside method.
        this.portCannonReloadTime = 0;
        this.starboardCannonReloadTime = 0;
        this.bowCannonReloadTime = 0;
        this.sternCannonReloadTime = 0;
        this.lastPortFireTime = 0;
        this.lastStarboardFireTime = 0;
        this.lastBowFireTime = 0;
        this.lastSternFireTime = 0;

        // --- NEW: Rolling Fire State ---
        this.rollingFireQueue = [];
        this.rollingFireTimer = 0;
        this.cannonReconcileTimer = 0; // --- NEW: Timer for inventory sync ---
        this.cannonRepairAccumulator = 0; // --- NEW: Accumulator for cannon repair rate ---

        // --- NEW: Tattered Sail State ---
        this.unitDamagePatterns = []; // Generic 0-1 damage patterns
        this._generateUnitDamagePatterns(); // Initialize immediately to ensure it exists

        // --- NEW: Hull Damage State ---
        this.hullDamagePatterns = [];
        this.hullDamageCacheCanvas = null;
        this.lastCachedHullHpPercent = 1.0;

        this.blueprint = blueprint;
        this.rigs = []; // New: An array to hold all rig objects for this ship.

        // --- New: Store custom hull colors ---
        // The primary color is used for the main hull.
        this.primaryHullColor = primaryHullColor;
        // A lighter version is derived for the bulwark base.
        this.lighterHullColor = lightenColor(primaryHullColor, 15);
        // The secondary color is used for the bulwark top.
        this.secondaryHullColor = secondaryHullColor;
        // New: Store the distinct bulwark rail color.
        this.bulwarkRailColor = bulwarkRailColor;
        // New: Store custom spar colors
        this.sparDarkerColor = sparDarkerColor;
        // New: Store custom deck colors
        this.deckColor = deckColor;
        this.deckPlankColor = darkenColor(deckColor, 20); // Auto-calculate plank color

        this.deckPlankCache = {}; // New: Cache for all deck plank lines
        // --- New: Initialize physics properties with default values ---
        this.accelerationTurningPenalty = ACCELERATION_TURNING_PENALTY;
        this.lateralDampingFactor = LATERAL_DAMPING_FACTOR;
        this.dynamicTurningFactor = DYNAMIC_TURNING_FACTOR;
        this.shipLengthTurningPower = SHIP_LENGTH_TURNING_POWER;
        this.turningMomentumDamping = TURNING_MOMENTUM_DAMPING;

        // Override base properties using the blueprint.
        // --- FIX: Only apply the blueprint if it actually exists. ---
        if (blueprint) {
            this.applyBlueprint(blueprint);
        }
    }

    /**
     * New: Updates the ship's colors and derived color properties without re-instantiation.
     * @param {object} options - The new color options.
     */
    updateColors(options) {
        if (options.primaryHullColor) {
            this.primaryHullColor = options.primaryHullColor;
            this.lighterHullColor = lightenColor(this.primaryHullColor, 15);
        }
        if (options.secondaryHullColor) this.secondaryHullColor = options.secondaryHullColor;
        if (options.bulwarkRailColor) this.bulwarkRailColor = options.bulwarkRailColor;
        if (options.sparDarkerColor) this.sparDarkerColor = options.sparDarkerColor;
        if (options.deckColor) {
            this.deckColor = options.deckColor;
            this.deckPlankColor = darkenColor(this.deckColor, 20);
        }
        if (options.sailColor) this.sailColor = options.sailColor; // Uses setter
        if (options.pennantColor) this.pennantColor = options.pennantColor; // Uses setter
    }

    /**
     * New: Applies a blueprint to configure the ship's geometry, stats, and rigs.
     * This method contains the core logic for building a ship from a blueprint.
     * @param {object} blueprint - The configuration object from the ShipGenerator.
     */
    applyBlueprint(blueprint) {
        this.blueprint = blueprint;
        this.rigs = []; // Clear existing rigs

        // --- Apply Stats from Blueprint ---
        this.deckPlankCache = {}; // Clear plank cache

        // Calculate physics values dynamically based on the blueprint configuration.
        // We calculate them in "real" units (pixels/sec) and convert to "game" units (pixels/frame).
        const rawCruisingSpeed = this.getCrusingSpeed(); // pixels/sec
        const rawAcceleration = this.getAcceleration(); // pixels/sec^2

        this.baseSpeed = rawCruisingSpeed / 60; // Convert to pixels/frame
        this.accelerationStat = rawAcceleration / 3600; // Convert to pixels/frame^2

        // --- NEW: Map the calculated turningRate (deg/sec) to the game's maneuverability multiplier. ---
        // The in-game physics uses a 'maneuverability' multiplier. The shipyard calculates a 'turningRate' in deg/sec.
        // We convert the shipyard stat into the multiplier the physics engine understands.
        // BASE_ROTATION_SPEED is the baseline turn rate in radians per frame.
        const turningRateDegPerSec = blueprint.stats?.turningRate || 0;
        const turningRateRadPerSec = turningRateDegPerSec * (Math.PI / 180);
        const turningRateRadPerFrame = turningRateRadPerSec / 60; // Assuming 60 FPS
        this.maneuverability = turningRateRadPerFrame / BASE_ROTATION_SPEED; // Normalize against the base turning speed
        // this.reloadTime is now correctly set in the constructor via the super() call.
        this._initializePhysicsModifiers();

        // --- Apply Geometry from Blueprint ---
        this.shipLength = blueprint.dimensions.length;
        this.shipWidth = blueprint.dimensions.width;
        this.hullBaseVisualPoints = blueprint.geometry.hull;
        this.deckVisualPoints = blueprint.geometry.deck;
        this.bulwarkVisualPoints = blueprint.geometry.bulwark;
        this.bulwarkInnerCutoutVisualPoints = blueprint.geometry.bulwarkCutout;
        this.bulwarkRailOuterVisualPoints = blueprint.geometry.bulwarkRailOuter;
        this.bulwarkRailInnerVisualPoints = blueprint.geometry.bulwarkRailInner;

        // --- FIX: Apply multi-deck geometry from the blueprint ---
        // This was the source of the error, as these properties were previously undefined.
        if (blueprint.geometry.tier2_hull) {
            this.tier2_hull = blueprint.geometry.tier2_hull;
            this.tier2_deck = blueprint.geometry.tier2_deck;
            this.tier2_bulwark = blueprint.geometry.tier2_bulwark;
            this.tier2_bulwarkCutout = blueprint.geometry.tier2_bulwarkCutout;
            this.tier2_bulwarkRailOuter = blueprint.geometry.tier2_bulwarkRailOuter;
            this.tier2_bulwarkRailInner = blueprint.geometry.tier2_bulwarkRailInner;
        }
        if (blueprint.geometry.tier3_hull) {
            this.tier3_hull = blueprint.geometry.tier3_hull;
            this.tier3_deck = blueprint.geometry.tier3_deck;
            this.tier3_bulwark = blueprint.geometry.tier3_bulwark;
            this.tier3_bulwarkCutout = blueprint.geometry.tier3_bulwarkCutout;
            this.tier3_bulwarkRailOuter = blueprint.geometry.tier3_bulwarkRailOuter;
            this.tier3_bulwarkRailInner = blueprint.geometry.tier3_bulwarkRailInner;
        }

        // --- FIX: Update collision shape to match the visual hull ---
        this.collisionPoints = this.hullBaseVisualPoints;
        this.points = this.collisionPoints; // Update alias for collision system
        this.convexParts = triangulatePolygon(this.collisionPoints); // Re-calculate convex parts

        // Apply multi-deck and superstructure geometry...
        // (This would include all the tier2, tier3, aftercastle, etc. assignments)

        // --- Re-initialize Components ---
        this._initializeShipComponents(this.sailColor, this.pennantColor);
        this._precalculateAllDeckPlanks(); // Pre-calculate all deck planks
        this.sparColor = lightenColor(this.sparDarkerColor, 20);
        this.mastTopColor = this.sparColor;
        // --- New: Initialize rigs first, then calculate rig-dependent stats. ---
        this._initializeRigs();
        this.maxRigHp = this.getRigDurability();
        this.rigHp = this.maxRigHp;
        // --- New: Calculate Min Sailing Crew for physics penalties ---
        this.minSailingCrew = this._calculateMinSailingCrew();
        // --- OPTIMIZATION: Pre-calculate cannon muzzle positions ---
        this._precalculateCannonMuzzles();
        
        // --- NEW: Generate generic unit-space damage patterns for rigs ---
        this._generateUnitDamagePatterns();

        // --- NEW: Generate hull damage patterns (Cracks & Holes) ---
        this._generateHullDamagePatterns();

        // --- New: Generate the cached image after the blueprint is fully applied. ---
        if (!this.skipCache) {
            this._cacheShipImage();
        }
    }

    /**
     * New: Generates random damage patterns (holes) in 0..1 unit space.
     * Rigs can scale these to fit any sail size.
     * @private
     */
    _generateUnitDamagePatterns() {
        this.unitDamagePatterns = [];
        const numHoles = 12; // Enough for a tattered look
        for(let i=0; i<numHoles; i++) {
            const x = Math.random();
            const y = Math.random();
            const r = 0.03 + Math.random() * 0.08; // Size relative to sail (3% to 11%)
            
            // Create a jagged polygon around x,y
            const points = [];
            const sides = 5 + Math.floor(Math.random()*4);
            for(let j=0; j<sides; j++) {
                const a = (j/sides)*Math.PI*2;
                const rad = r * (0.6 + Math.random()*0.4); // Irregularity
                points.push({x: x + Math.cos(a)*rad, y: y + Math.sin(a)*rad});
            }
            
            this.unitDamagePatterns.push({
                points: points,
                // Assign a random HP threshold between 0% and 90%.
                // The hole appears when HP drops BELOW this percentage.
                threshold: Math.random() * 0.9 
            });
        }
    }

    /**
     * New: Helper for Rigs to draw damage holes on the current path.
     * Assumes a path has been started but not filled.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {object} bounds - {minX, maxX, minY, maxY} of the sail in local space.
     */
    drawDamageHoles(ctx, bounds) {
        if (!this.unitDamagePatterns || this.rigHp >= this.maxRigHp) return;
        
        // Safety check for valid bounds
        if (!bounds || !isFinite(bounds.minX) || !isFinite(bounds.maxX)) return;

        const hpPct = this.rigHp / this.maxRigHp;
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        this.unitDamagePatterns.forEach(hole => {
            if (hpPct < hole.threshold) {
                // Map unit points to sail dimensions
                hole.points.forEach((p, i) => {
                    const px = bounds.minX + p.x * width;
                    const py = bounds.minY + p.y * height;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.closePath();
            }
        });
    }

    /**
     * New: Generates damage patterns for the hull (Cracks on deck, Holes on sides).
     * Avoids placing damage on top of cannons.
     * @private
     */
    _generateHullDamagePatterns() {
        this.hullDamagePatterns = [];
        if (!this.hullBaseVisualPoints) return;

        const numPatterns = Math.floor(this.shipLength / 5); // Density based on length
        const cannons = this.getAllCannons();
        const cannonSafeRadius = CANNON_UNIT_SIZE * 1.2; // Buffer around cannons

        for (let i = 0; i < numPatterns; i++) {
            // 1. Decide Type & Zone
            // 60% chance for Crack (Deck), 40% for Hole (Side)
            const isHole = Math.random() > 0.6;
            
            let p = null;
            let attempts = 0;
            
            while (!p && attempts < 15) {
                // Generate random point within bounding box
                const rx = (Math.random() - 0.5) * this.shipLength;
                const ry = (Math.random() - 0.5) * this.shipWidth;
                
                // Zone Logic
                const yRatio = Math.abs(ry) / (this.shipWidth / 2);
                let validZone = false;
                
                if (isHole) {
                    // Holes: Focus on outer 40% of width (Sides/Bulwarks)
                    if (yRatio > 0.6) validZone = true;
                } else {
                    // Cracks: Focus on inner 70% of width (Deck)
                    if (yRatio <= 0.7) validZone = true;
                }

                if (validZone) {
                    // Polygon Check
                    const poly = isHole ? this.hullBaseVisualPoints : (this.deckVisualPoints || this.hullBaseVisualPoints);
                    if (isPointInPolygon({x: rx, y: ry}, poly)) {
                        // Cannon Avoidance Check
                        let clear = true;
                        for (const c of cannons) {
                            const dx = c.x - rx;
                            const dy = c.y - ry;
                            if (dx*dx + dy*dy < cannonSafeRadius*cannonSafeRadius) {
                                clear = false;
                                break;
                            }
                        }
                        if (clear) p = {x: rx, y: ry};
                    }
                }
                attempts++;
            }

            if (p) {
                const pattern = {
                    type: isHole ? 'hole' : 'crack',
                    x: p.x,
                    y: p.y,
                    threshold: Math.random() * 0.9, // Appears below this HP %
                    rotation: Math.random() * Math.PI * 2,
                    points: []
                };

                if (isHole) {
                    // Generate jagged polygon for hole
                    const radius = 2 + Math.random() * 4;
                    const sides = 5 + Math.floor(Math.random() * 3);
                    for (let j = 0; j < sides; j++) {
                        const angle = (j / sides) * Math.PI * 2;
                        const r = radius * (0.6 + Math.random() * 0.4);
                        pattern.points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
                    }
                } else {
                    // Generate zig-zag line for crack
                    const length = 5 + Math.random() * 10;
                    const segments = 3;
                    let currX = -length / 2;
                    let currY = 0;
                    pattern.points.push({x: currX, y: currY});
                    
                    for(let j=0; j<segments; j++) {
                        currX += length / segments;
                        currY += (Math.random() - 0.5) * 3; // Jitter Y
                        pattern.points.push({x: currX, y: currY});
                    }
                }
                
                this.hullDamagePatterns.push(pattern);
            }
        }
        
        // Sort by threshold so they appear progressively
        this.hullDamagePatterns.sort((a, b) => b.threshold - a.threshold);
    }

    /**
     * Helper to draw damage holes/cracks on the current path.
     * @param {CanvasRenderingContext2D} ctx 
     */
    drawHullDamage(ctx) {
        // This is now handled by the cached image in _drawShipComponents
        if (this.hullDamageCacheCanvas) {
            ctx.drawImage(this.hullDamageCacheCanvas, this.hullCacheOffset.x, this.hullCacheOffset.y);
        }
    }

    /**
     * New: Pre-calculates all deck plank lines for all possible deck surfaces.
     * This avoids expensive math per frame/draw call.
     * @private
     */
    _precalculateAllDeckPlanks() {
        this.deckPlankCache = {};

        const calculatePlanks = (deckPoints) => {
            if (!deckPoints || deckPoints.length === 0) return [];
            const lines = [];
            const deckMinY = Math.min(...deckPoints.map(p => p.y));
            const deckMaxY = Math.max(...deckPoints.map(p => p.y));
            const deckHeight = deckMaxY - deckMinY;
            const numPlanks = Math.max(1, Math.floor(deckHeight / DECK_PLANK_SPACING) - 1);
            const actualEvenSpacing = deckHeight / (numPlanks + 1);

            for (let i = 1; i <= numPlanks; i++) {
                const plankY = deckMinY + (i * actualEvenSpacing);
                let minX = Infinity, maxX = -Infinity;
                for (let j = 0; j < deckPoints.length; j++) {
                    const p1 = deckPoints[j];
                    const p2 = deckPoints[(j + 1) % deckPoints.length];
                    if ((p1.y <= plankY && p2.y > plankY) || (p2.y <= plankY && p1.y > plankY)) {
                        const intersectX = (plankY - p1.y) * (p2.x - p1.x) / (p2.y - p1.y) + p1.x;
                        minX = Math.min(minX, intersectX);
                        maxX = Math.max(maxX, intersectX);
                    }
                }
                if (isFinite(minX) && isFinite(maxX)) lines.push({ x1: minX, y1: plankY, x2: maxX, y2: plankY });
            }
            return lines;
        };

        // Calculate for all tiers and superstructures
        if (this.deckVisualPoints) this.deckPlankCache.deck = calculatePlanks(this.deckVisualPoints);
        if (this.tier2_deck) this.deckPlankCache.tier2_deck = calculatePlanks(this.tier2_deck);
        if (this.tier3_deck) this.deckPlankCache.tier3_deck = calculatePlanks(this.tier3_deck);

        const geo = this.blueprint.geometry;
        if (geo.aftercastle?.deck) this.deckPlankCache.aftercastle = calculatePlanks(geo.aftercastle.deck);
        if (geo.forecastle?.deck) this.deckPlankCache.forecastle = calculatePlanks(geo.forecastle.deck);
        if (geo.midcastle?.deck) this.deckPlankCache.midcastle = calculatePlanks(geo.midcastle.deck);
        if (geo.sterncastle?.deck) this.deckPlankCache.sterncastle = calculatePlanks(geo.sterncastle.deck);
        if (geo.spardeck?.deck) this.deckPlankCache.spardeck = calculatePlanks(geo.spardeck.deck);
        if (geo.spardeckSterncastle?.deck) this.deckPlankCache.spardeckSterncastle = calculatePlanks(geo.spardeckSterncastle.deck);
        if (geo.sternCabin?.deck) this.deckPlankCache.sternCabin = calculatePlanks(geo.sternCabin.deck);

        // Helper for rectangular deckhouses
        const calcRect = (rect, cx=0) => rect ? calculatePlanks([{x:cx-rect.length/2,y:-rect.width/2},{x:cx+rect.length/2,y:-rect.width/2},{x:cx+rect.length/2,y:rect.width/2},{x:cx-rect.length/2,y:rect.width/2}]) : [];
        if (geo.midDeckhouse?.inner) this.deckPlankCache.midDeckhouse = calcRect(geo.midDeckhouse.inner);
        if (geo.foreDeckhouse?.inner) this.deckPlankCache.foreDeckhouse = calcRect(geo.foreDeckhouse.inner, (geo.foreDeckhouse.outer.startX + geo.foreDeckhouse.outer.endX)/2);
        if (geo.aftDeckhouse?.inner) this.deckPlankCache.aftDeckhouse = calcRect(geo.aftDeckhouse.inner, (geo.aftDeckhouse.outer.startX + geo.aftDeckhouse.outer.endX)/2);
    }

    /**
     * New: Pre-calculates the local muzzle position for every cannon relative to the ship's center.
     * This saves multiple matrix transformations per cannon shot during combat.
     * @private
     */
    _precalculateCannonMuzzles() {
        if (!this.blueprint) return;
        
        // Constants for calculation (must match fireSingleCannon logic)
        const desiredCarriageWidth = CANNON_UNIT_SIZE;
        const carriageBaseLength_svg = 314;
        const carriageBaseWidth_svg = 166;
        const scale = desiredCarriageWidth / carriageBaseWidth_svg;
        const finalLength = carriageBaseLength_svg * scale;
        const finalHeight = desiredCarriageWidth;
        const barrelBoxLength = finalLength * (5 / 3);
        const barrelBoxWidth = finalHeight * (1 / 2);
        const knobRadius = (barrelBoxWidth * (2 / 5)) / 2;
        const muzzleTipLocalX = knobRadius * 3 + barrelBoxLength * 0.8 + barrelBoxLength * (1 / 12) + barrelBoxLength * (1 / 60);
        
        // The muzzle point relative to the cannon's own pivot (x,y)
        const muzzleOffset = { x: muzzleTipLocalX - finalLength, y: -finalHeight / 2 };

        const precalcForList = (list) => {
            if (!list) return;
            list.forEach(cannon => {
                // Rotate the muzzle offset by the cannon's fixed angle on deck
                const rotated = rotatePoint(muzzleOffset, { x: 0, y: 0 }, cannon.angle);
                // Add to the cannon's deck position to get the final ship-relative position
                cannon.localMuzzlePos = { 
                    x: cannon.x + rotated.x, 
                    y: cannon.y + rotated.y 
                };
            });
        };

        // Iterate all cannon lists in the blueprint
        const layout = this.blueprint.layout;
        if (layout.cannonLayouts) Object.values(layout.cannonLayouts).forEach(list => precalcForList(list));
        
        const geo = this.blueprint.geometry;
        const parts = [geo.aftercastle, geo.forecastle, geo.midcastle, geo.sterncastle, geo.spardeck, geo.spardeckSterncastle];
        parts.forEach(part => { if (part && part.cannons) precalcForList(part.cannons); });
    }

    /**
     * New: Calculates and applies direct physics modifiers based on the ship's hull shape.
     * This makes L:B ratio and draught have a direct, tangible effect on in-game handling.
     * @private
     */
    _initializePhysicsModifiers() {
        if (!this.blueprint) return;

        const { beamRatio } = this.blueprint.dimensions;
        const { draughtFactor } = this.blueprint;

        // --- 1. Calculate Deviation from Baseline ---
        // For L:B ratio, the baseline is the "average" for its configuration.
        const formResistanceMultiplier = this._getFormResistanceMultiplier(); // This method calculates averageLBRatio internally.
        const averageLBRatio = (1.0 - formResistanceMultiplier) / 0.05 + beamRatio; // Back-calculate the average
        const lbRatioDeviation = (beamRatio - averageLBRatio) / (4.0 - 2.0); // Normalize over the possible range

        // For draught, the baseline is 0.5.
        const draughtDeviation = (draughtFactor - 0.5) / (0.65 - 0.4); // Normalize over the possible range

        // --- 2. Apply Modifiers ---
        let finalAccelTurnPenalty = ACCELERATION_TURNING_PENALTY;
        let finalLateralDamping = LATERAL_DAMPING_FACTOR;
        let finalDynamicTurning = DYNAMIC_TURNING_FACTOR;

        // L:B Ratio Effects
        finalAccelTurnPenalty -= lbRatioDeviation * LB_RATIO_ACCEL_TURN_PENALTY_MOD;
        finalLateralDamping += lbRatioDeviation * LB_RATIO_LATERAL_DAMPING_MOD;
        finalDynamicTurning -= lbRatioDeviation * LB_RATIO_DYNAMIC_TURNING_MOD;

        // Draught Effects
        finalAccelTurnPenalty += draughtDeviation * DRAUGHT_ACCEL_TURN_PENALTY_MOD;
        finalLateralDamping += draughtDeviation * DRAUGHT_LATERAL_DAMPING_MOD;
        finalDynamicTurning += draughtDeviation * DRAUGHT_DYNAMIC_TURNING_MOD;

        // --- 3. Clamp and Store Final Values ---
        // Clamp values to prevent them from becoming negative or excessively large.
        this.accelerationTurningPenalty = Math.max(0.0, Math.min(1.0, finalAccelTurnPenalty));
        this.lateralDampingFactor = Math.max(0.05, Math.min(0.95, finalLateralDamping));
        this.dynamicTurningFactor = Math.max(1.0, finalDynamicTurning);

        // The shipLengthTurningPower is not modified in this implementation, but the property is here for future use.
        this.shipLengthTurningPower = SHIP_LENGTH_TURNING_POWER;

        // --- Debug Logging (optional) ---
        // console.log(`[Physics Modifiers for ${this.blueprint.layout.rigType}]
        //   L/B Deviation: ${lbRatioDeviation.toFixed(2)}
        //   Draught Deviation: ${draughtDeviation.toFixed(2)}
        //   Final Accel Penalty: ${this.accelerationTurningPenalty.toFixed(2)} (Default: ${ACCELERATION_TURNING_PENALTY})
        //   Final Lat Damping: ${this.lateralDampingFactor.toFixed(2)} (Default: ${LATERAL_DAMPING_FACTOR})
        //   Final Dyn Turning: ${this.dynamicTurningFactor.toFixed(2)} (Default: ${DYNAMIC_TURNING_FACTOR})`);
    }

    /**
     * New: Calculates the total horizontal bounds of the ship including bowsprit and other rig extensions.
     * @returns {{minX: number, maxX: number, length: number}} An object containing the min/max X coordinates and the total length.
     */
    getOverallBounds() {
         let minX = 0;
         let maxX = 0;
         let minY = 0;
         let maxY = 0;
 
         // Find the forward-most and aft-most points of the hull
         if (this.hullBaseVisualPoints && this.hullBaseVisualPoints.length > 0) {
             this.hullBaseVisualPoints.forEach(p => {
                 if (p.x < minX) minX = p.x;
                 if (p.x > maxX) maxX = p.x;
                 if (p.y < minY) minY = p.y;
                 if (p.y > maxY) maxY = p.y;
             });
         }
 
         // Check each rig for extensions like bowsprits or booms
         this.rigs.forEach(rig => {
             if (rig.bowspritDeckStart !== undefined && rig.bowspritLength !== undefined) {
                 const bowspritEnd = rig.bowspritDeckStart + rig.bowspritLength;
                 if (bowspritEnd > maxX) maxX = bowspritEnd;
             }
 
             // --- FIX: Account for aft-extending gaff sail booms ---
             // Check if the rig has a method to report its aft-most point.
             if (typeof rig.getAftBound === 'function') {
                 const aftBound = rig.getAftBound();
                 if (aftBound < minX) {
                     minX = aftBound;
                 }
             }
         });
 
         // Account for yards/sails (Width)
         if (this.sailHeight) {
             const halfSail = this.sailHeight / 2;
             if (-halfSail < minY) minY = -halfSail;
             if (halfSail > maxY) maxY = halfSail;
         } else {
             const halfYard = this.shipWidth; 
             if (-halfYard < minY) minY = -halfYard;
             if (halfYard > maxY) maxY = halfYard;
         }
 
         return { minX, maxX, minY, maxY, length: maxX - minX, width: maxY - minY };
    }

    /**
     * New: Calculates the volumetric burthen (hold capacity) of the ship.
     * This unifies the calculation used in the UI and the Inventory generation.
     * @returns {number} The capacity in cargo units.
     */
    calculateBurthen() {
        if (!this.blueprint || !this.blueprint.dimensions) return 0;

        const dims = this.blueprint.dimensions;
        const draughtPx = this.blueprint.draughtFactor * dims.width;

        // Volume of a half-ellipse prism: (PI * radiusA * radiusB * length) / 2
        // radiusA = beam / 2, radiusB = draught
        const midsectionVolume = (Math.PI * (dims.width / 2) * draughtPx * dims.midSectionLength) / 2;
        // Approximate the tapered fore/aft sections as having half the volume of a non-tapered section.
        const taperedSectionsVolume = (Math.PI * (dims.width / 2) * draughtPx * (dims.foreSectionLength + dims.aftSectionLength)) / 4;
        
        const totalVolumeInPixels = midsectionVolume + taperedSectionsVolume;
        return Math.round(totalVolumeInPixels / (CARGO_UNIT_SIZE ** 3));
    }

    /**
     * New: Calculates the ship's theoretical cruising speed based on its design.
     * @returns {number} The final cruising speed in game units per second, rounded up.
     */
    getCrusingSpeed() {
        // --- 1. Hull Speed Limit ---
        // Found by multiplying 0.767 by the square root of the ship's length.
        const hullSpeedLimit = 0.767 * Math.sqrt(this.shipLength);

        // --- 2. Rig Efficiency Factor ---
        // A lookup based on the rig type.
        const rigEfficiencies = {
            'full-rigged': 0.90,
            'brig': 0.88,
            'sloop': 0.85,
            'fore-and-aft-sloop': 0.83,
            'barque': 0.80,
            'brigantine': 0.78,
            'barquentine': 0.75,
            'schooner': 0.75,
            'three-mast-schooner': 0.75,
            'square': 0.70
        };
        const rigEfficiencyFactor = rigEfficiencies[this.blueprint.layout.rigType] || 0.70; // Default to square rig

        // --- 3. Stability Multiplier ---
        // A penalty is applied if the selected draught is less than the 0.5 baseline.
        let stabilityMultiplier = 1.0;
        const selectedDraughtFactor = this.blueprint.draughtFactor;
        const requiredDraughtFactor = 0.5;

        if (selectedDraughtFactor < requiredDraughtFactor) {
            const shortfall = requiredDraughtFactor - selectedDraughtFactor;
            const reduction = shortfall * 1.5; // Penalty multiplier
            stabilityMultiplier = 1.0 - reduction;
        }

        // --- 4. Cargo Multiplier ---
        // A penalty based on how much of the cargo capacity is filled.
        // For now, Crates Loaded is 0, so this will always be 1.0.
        const cratesLoaded = 0; // Placeholder for future implementation
        const maxCapacity = this.blueprint.dimensions.cargoCapacity || 1;
        const cargoLoadFactor = cratesLoaded / maxCapacity;
        const maxCargoPenalty = 0.20;
        const cargoMultiplier = 1.0 - (cargoLoadFactor * maxCargoPenalty);

        // --- 5. Form Resistance Multiplier ---
        // This factor penalizes ships that are wider than their "average" configuration.
        const formResistanceMultiplier = this._getFormResistanceMultiplier();

        // --- 6. Final Speed Calculation ---
        // Combine all factors to get the speed in knots.
        const cruisingSpeedInKnots = hullSpeedLimit * rigEfficiencyFactor * stabilityMultiplier * cargoMultiplier * formResistanceMultiplier;

        // --- 7. Conversion to Game Units ---
        // Convert knots to game units per second.
        // 1 knot = 1852 meters. 1 meter = 10 game units. 1 hour = 3600 seconds.
        // (1852 * 10) / 3600 = ~5.1444. This is then divided by a balance factor.
        const conversionFactor = 5.1444 / CRUISING_SPEED_BALANCE_FACTOR;
        const finalCruisingSpeed = cruisingSpeedInKnots * conversionFactor * CRUISING_SPEED_MULTIPLIER;

        // Return the final speed, rounded up to the nearest whole number.
        return Math.ceil(finalCruisingSpeed);
    }

    /**
     * New: Calculates the ship's acceleration based on its cruising speed and momentum.
     * @returns {number} The acceleration value.
     */
    getAcceleration() {
        // --- 1. Momentum Multiplier (MM) ---
        // 1.0 + (Draught-to-Beam ratio * 0.2)
        const draughtFactor = this.blueprint.draughtFactor;
        const momentumMultiplier = 1.0 + (draughtFactor * 0.2);

        // --- 2. Time Constant (T) ---
        // 10 seconds * Momentum Multiplier (MM)
        const timeConstant = ACCELERATION_BASE_TIME_SECONDS * momentumMultiplier;

        // --- 3. Acceleration (A) ---
        // Cruising Speed / Time Constant
        const cruisingSpeed = this.getCrusingSpeed(); // Already in game units/sec
        const acceleration = cruisingSpeed / timeConstant;

        return acceleration; // Return raw number for physics calculations
    }

    /**
     * New: Calculates a multiplier based on how the ship's L:B ratio deviates from the average for its size and type.
     * @returns {number} The form resistance multiplier.
     * @private
     */
    _getFormResistanceMultiplier() {
        const { buildType, beamRatio, gunsPerBattery, cargoCapacity } = this.blueprint.dimensions;
        const { numDecks } = this.blueprint.layout;

        // This logic replicates the UI's constraints to find the maximum available beam ratio for this ship's configuration.
        let sizeBasedMaxBeamRatio = 4.0;
        if (buildType === 'guns') {
            if (gunsPerBattery === 1) sizeBasedMaxBeamRatio = 2.0;
            else if (gunsPerBattery === 2) sizeBasedMaxBeamRatio = 2.3;
            else if (gunsPerBattery >= 3 && gunsPerBattery <= 4) sizeBasedMaxBeamRatio = 2.5;
            else if (gunsPerBattery >= 5 && gunsPerBattery <= 7) sizeBasedMaxBeamRatio = 3.5;
            else if (gunsPerBattery >= 8) sizeBasedMaxBeamRatio = 4.0;
        } else if (buildType === 'cargo') {
            if (cargoCapacity >= 1 && cargoCapacity <= 3) sizeBasedMaxBeamRatio = 2.0;
            else if (cargoCapacity >= 4 && cargoCapacity <= 6) sizeBasedMaxBeamRatio = 2.3;
            else if (cargoCapacity >= 7 && cargoCapacity <= 20) sizeBasedMaxBeamRatio = 2.5;
            else if (cargoCapacity >= 21 && cargoCapacity <= 40) sizeBasedMaxBeamRatio = 3.5;
            else if (cargoCapacity >= 41) sizeBasedMaxBeamRatio = 4.0;
        }

        let deckBasedMaxBeamRatio = 4.0;
        if (numDecks === 2) deckBasedMaxBeamRatio = 3.75;
        else if (numDecks === 3) deckBasedMaxBeamRatio = 3.5;

        const maxAllowedBeamRatio = Math.min(sizeBasedMaxBeamRatio, deckBasedMaxBeamRatio);
        const minAllowedBeamRatio = 2.0;

        // The "ideal" or average L:B ratio is the midpoint of the available range for this ship configuration.
        const averageLBRatio = (minAllowedBeamRatio + maxAllowedBeamRatio) / 2;

        // Calculate the multiplier based on the deviation from the average.
        // A ship that is wider than average (lower beamRatio) gets a penalty.
        // A ship that is narrower than average (higher beamRatio) gets a bonus.
        const formResistanceMultiplier = 1.0 - ((averageLBRatio - beamRatio) * 0.05);
        return formResistanceMultiplier;
    }

    /**
     * New: Calculates the ship's turning radius as a multiplier of its own length.
     * @returns {string} The turning radius multiplier, formatted to two decimal places.
     */
    getTurningRadius() {
        const { beamRatio } = this.blueprint.dimensions;
        const { draughtFactor, rigType } = this.blueprint;

        // 1. Baseline Turning Radius Multiplier (BaseTRM)
        // 1.5 + ((L:B) * 0.5)
        const baselineTRM = 1.5 + (beamRatio * 0.5);

        // 2. Draft Correction (DC)
        // ((D:B) - 0.4) * 1.0
        const draftCorrection = (draughtFactor - 0.4) * 1.0;

        // 3. Rig Correction (RC)
        const rigCorrections = {
            'full-rigged': 0.10,
            'brig': 0.05,
            'sloop': 0.00, // Mapped from 'square-rigged-sloop'
            'fore-and-aft-sloop': -0.10,
            'barque': 0.08,
            'brigantine': 0.00,
            'barquentine': 0.00,
            'schooner': -0.05, // Mapped from '2-mast-schooner'
            'three-mast-schooner': -0.05,
            'square': 0.00
        };
        const rigCorrection = rigCorrections[rigType] || 0.00;

        // 4. Total Turning Radius Multiplier
        const totalMultiplier = baselineTRM + draftCorrection + rigCorrection;

        // The final value is the multiplier itself, which represents the radius in ship lengths.
        // (Total Length * Multiplier) / Total Length = Multiplier
        return totalMultiplier.toFixed(2);
    }

    /**
     * New: Calculates the ship's rate of turn at cruising speed.
     * @returns {string} The turning speed (rate of turn) in degrees per second.
     */
    getTurningSpeed() {
        // 1. Get the required inputs.
        const cruisingSpeed = this.getCrusingSpeed(); // Velocity in units/sec
        const turningRadiusMultiplier = parseFloat(this.getTurningRadius());
        const shipLength = this.shipLength;

        // 2. Calculate the actual turning radius in game units.
        const turningRadiusInUnits = turningRadiusMultiplier * shipLength;

        // Failsafe to prevent division by zero.
        if (turningRadiusInUnits === 0) {
            return '0.00';
        }

        // 3. Calculate Rate of Turn (ROT) using the formula: ROT = (Velocity * 57.3) / Radius
        const rateOfTurn = (cruisingSpeed * 57.2958) / turningRadiusInUnits; // 57.2958 is 180/PI

        return rateOfTurn.toFixed(2);
    }

    /**
     * New: Gets the descriptive "best point of sail" for the ship's rig.
     * @returns {string} The best point of sail text.
     */
    getBestPointOfSail() {
        const rigType = this.blueprint.layout.rigType;
        const pointsOfSail = {
            'full-rigged': 'Running (Downwind)',
            'brig': 'Running (Downwind)',
            'sloop': 'Broad Reaching / Running', // Mapped from 'square-rigged-sloop'
            'fore-and-aft-sloop': 'Close-Hauled / Beam Reaching',
            'barque': 'Broad Reaching',
            'brigantine': 'Broad Reaching',
            'barquentine': 'Beam Reaching',
            'schooner': 'Close-Hauled / Beam Reaching', // Mapped from '2-mast-schooner'
            'three-mast-schooner': 'Close-Hauled / Beam Reaching',
            'square': 'Running (Downwind)'
        };

        return pointsOfSail[rigType] || 'Unknown';
    }

    /**
     * New: Fires a full broadside from all cannons on a specified side with a rolling effect.
     * @param {string} side - 'port' or 'starboard'.
     * @param {Array<Cannonball>} cannonballs - The global array to add new cannonballs to.
     * @param {Array<Volley>} [volleys=null] - The global array to add new volleys to.
     * @returns {boolean} True if the broadside was fired, false otherwise.
     */
    fireBroadside(side, cannonballs, volleys = null) {
        const now = performance.now();
        let canFire = false;

        // --- FIX: Use dynamic getReloadTime() for checks ---
        const currentReloadTime = this.getReloadTime();

        // 1. Check if the side is ready to fire.
        if (side === 'starboard' && now - this.lastStarboardFireTime >= currentReloadTime) {
            canFire = true;
            this.lastStarboardFireTime = now;
            this.starboardCannonReloadTime = currentReloadTime;
        } else if (side === 'port' && now - this.lastPortFireTime >= currentReloadTime) {
            canFire = true;
            this.lastPortFireTime = now;
            this.portCannonReloadTime = currentReloadTime;
        } else if (side === 'bow' && now - this.lastBowFireTime >= currentReloadTime) {
            canFire = true;
            this.lastBowFireTime = now;
            this.bowCannonReloadTime = currentReloadTime;
        } else if (side === 'stern' && now - this.lastSternFireTime >= currentReloadTime) {
            canFire = true;
            this.lastSternFireTime = now;
            this.sternCannonReloadTime = currentReloadTime;
        }

        if (!canFire) {
            // This log can be noisy, so it's commented out. Uncomment if needed for debugging reload times.
            // console.log(`[fireBroadside] Cannot fire ${side}. Reloading.`);
            return false;
        }

        this.performAction(); // Reset HP regen cooldown.

        // 2. Gather all cannons for the specified side from the blueprint.
        const cannonsToFire = [];
        const blueprint = this.blueprint;
        if (!blueprint) return false;

        // Helper to gather cannons from a layout.
        const gatherSideGuns = (cannonLayout) => {
            if (!cannonLayout) return;
            // --- FIX: Case-insensitive check to ensure 'Port' matches 'port' ---
            // --- NEW: Filter out destroyed cannons ---
            cannonsToFire.push(...cannonLayout.filter(c => c.side && c.side.toLowerCase() === side && !c.destroyed));
        };

        // Main decks
        if (blueprint.layout.cannonLayouts) {
            for (const tier in blueprint.layout.cannonLayouts) {
                gatherSideGuns(blueprint.layout.cannonLayouts[tier]);
            }
        }
        // Superstructures
        gatherSideGuns(blueprint.geometry.aftercastle?.cannons);
        gatherSideGuns(blueprint.geometry.forecastle?.cannons);
        gatherSideGuns(blueprint.geometry.midcastle?.cannons);
        gatherSideGuns(blueprint.geometry.sterncastle?.cannons);
        gatherSideGuns(blueprint.geometry.spardeck?.cannons);
        gatherSideGuns(blueprint.geometry.spardeckSterncastle?.cannons);

        if (cannonsToFire.length === 0) {
            console.warn(`[${this.shipId || 'Ship'}] fireBroadside('${side}') called but 0 cannons were found in blueprint for this side.`);
            return true; // Return true to satisfy AI that "we tried", but nothing happens.
        }

        // --- NEW: Consume Ammunition for the entire broadside ---
        // Determine shot type (Player uses selection, NPC defaults to round-shot)
        const shotType = this.selectedShotType || 'round-shot';

        const shotsCount = cannonsToFire.length;
        if (shotsCount > 0) {
            // Consume 0.005 mass units of gunpowder per shot (absolute amount, not container percentage)
            if (!this.hasItem(shotType, shotsCount) || !this.hasItem('gunpowder', shotsCount * 0.005)) {
                console.warn(`[${this.shipId || 'Player'}] FAILED TO FIRE: Insufficient ${shotType} or gunpowder.`);
                return false; // Not enough ammo for the broadside
            }
            this.consumeItem(shotType, shotsCount);
            this.consumeItem('gunpowder', shotsCount * 0.005);
        }

        // --- NEW: Rolling Fire Logic ---
        // Sort cannons from Bow to Stern (descending X) for a ripple effect.
        cannonsToFire.sort((a, b) => b.x - a.x);

        // Add cannons to the queue
        this.rollingFireQueue.push(...cannonsToFire);

        // If this is a fresh volley (queue was empty), ensure the first shot fires immediately.
        if (this.rollingFireQueue.length === cannonsToFire.length) {
            this.rollingFireTimer = ROLLING_FIRE_DELAY_MS; 
        }

        // --- NEW: Create a large Volley representing the broadside ---
        if (volleys && cannonsToFire.length > 0) {
            // Calculate firing angle
            let fireAngle;
            if (side === 'starboard') fireAngle = this.angle + Math.PI / 2;
            else if (side === 'port') fireAngle = this.angle - Math.PI / 2;
            else if (side === 'bow') fireAngle = this.angle;
            else if (side === 'stern') fireAngle = this.angle + Math.PI;

            let speed = CANNONBALL_SPEED;
            if (shotType === 'chain-shot') {
                speed *= CHAIN_SHOT_SPEED_MULTIPLIER;
            } else if (shotType === 'grape-shot') {
                speed *= GRAPE_SHOT_SPEED_MULTIPLIER;
            } else if (shotType === 'canister-shot') {
                speed *= CANISTER_SHOT_SPEED_MULTIPLIER;
            }

            const vx = Math.cos(fireAngle) * speed + this.vx;
            const vy = Math.sin(fireAngle) * speed + this.vy;
            
            // --- FIX: Calculate the actual spread and center of the cannons ---
            // This ensures the volley represents the specific guns firing, not just the whole ship.
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            let sumX = 0;
            let sumY = 0;
            
            cannonsToFire.forEach(c => {
                if (c.x < minX) minX = c.x;
                if (c.x > maxX) maxX = c.x;
                if (c.y < minY) minY = c.y;
                if (c.y > maxY) maxY = c.y;
                sumX += c.x;
                sumY += c.y;
            });
            
            // Calculate the center of the volley relative to the ship
            const avgLocalX = sumX / cannonsToFire.length;
            const avgLocalY = sumY / cannonsToFire.length;
            const rotatedCenter = rotatePoint({ x: avgLocalX, y: avgLocalY }, { x: 0, y: 0 }, this.angle);
            const volleyX = this.x + rotatedCenter.x;
            const volleyY = this.y + rotatedCenter.y;

            // Radius is half the spread, plus a buffer for the cannonball size itself
            const spread = Math.max(maxX - minX, maxY - minY);
            const volleyRadius = Math.max(CANNON_UNIT_SIZE, spread / 2 + CANNON_UNIT_SIZE);
            
            volleys.push(new Volley(volleyX, volleyY, vx, vy, volleyRadius, this));
        }
        return true;
    }

    /**
     * Overrides the base update method to process the rolling fire queue.
     * @param {number} deltaTime - Time elapsed since the last frame in milliseconds.
     */
    update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder) {
        // IMPORTANT: Call the parent update method to run all other essential logic
        // like physics, timers, and visual updates.
        // --- FIX: Call the parent 'Ship.update' to process base timers like reload cooldowns. ---
        super.update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder);

        // --- NEW: Process Rolling Fire Queue ---
        // Allow firing until 50% submerged
        const isDisabled = this.isSinking && (this.sinkHp / this.maxSinkHp > 0.5);

        if (!isDisabled && this.rollingFireQueue.length > 0) {
            this.rollingFireTimer += deltaTime;
            // Fire as many cannons as the time delta allows
            while (this.rollingFireQueue.length > 0 && this.rollingFireTimer >= ROLLING_FIRE_DELAY_MS) {
                this.rollingFireTimer -= ROLLING_FIRE_DELAY_MS;
                const cannon = this.rollingFireQueue.shift();
                this.fireSingleCannon(cannon, cannonballs);
            }
        } else if (isDisabled) {
            this.rollingFireQueue = []; // Clear queue if disabled
        }

        // --- NEW: Reconcile Cannons with Inventory (Rate Limited) ---
        // Connect to repair cooldown: Cannons only repair when the ship is "safe" and repairing.
        const now = performance.now();
        const timeSinceLastActivity = now - this.lastDamageTime;
        const inCooldown = timeSinceLastActivity < REGENERATION_COOLDOWN_TIME;

        if (!inCooldown) {
            // Accumulate repair potential (1 cannon per second, matching 1 HP/sec logic)
            this.cannonRepairAccumulator += deltaTime / 1000;
            
            if (this.cannonRepairAccumulator >= 1.0) {
                const limit = Math.floor(this.cannonRepairAccumulator);
                const repaired = this.reconcileCannons(limit);
                this.cannonRepairAccumulator -= repaired;
                
                // If we couldn't repair (e.g. full), cap accumulator to prevent burst later
                if (repaired === 0) {
                    this.cannonRepairAccumulator = Math.min(this.cannonRepairAccumulator, 1.0);
                }
            }
        } else {
            this.cannonRepairAccumulator = 0;
        }

        // Periodic Sync Down (every 1s) to handle removed inventory items immediately
        this.cannonReconcileTimer += deltaTime;
        if (this.cannonReconcileTimer >= 1000) { // Check every 1 second
            this.reconcileCannons(0); // 0 limit means only sync down (destroy), no repair
            this.cannonReconcileTimer = 0;
        }
    }

    /**
     * New: Fires a single cannonball based on a cannon's blueprint definition.
     * This is a helper for the fireBroadside method.
     * @param {object} cannon - The cannon object from the blueprint's layout.
     * @param {Array<Cannonball>} cannonballs - The global array to add new cannonballs to.
     */
    fireSingleCannon(cannon, cannonballs) {
        let muzzleWorldPos;

        if (cannon.localMuzzlePos) {
            // --- OPTIMIZATION: Use pre-calculated local position ---
            const cos = Math.cos(this.angle);
            const sin = Math.sin(this.angle);
            const dx = cannon.localMuzzlePos.x;
            const dy = cannon.localMuzzlePos.y;
            
            muzzleWorldPos = {
                x: this.x + (dx * cos - dy * sin),
                y: this.y + (dx * sin + dy * cos)
            };
        } else {
            // Fallback for legacy/default ships
            const desiredCarriageWidth = CANNON_UNIT_SIZE;
            const carriageBaseLength_svg = 314;
            const carriageBaseWidth_svg = 166;
            const scale = desiredCarriageWidth / carriageBaseWidth_svg;
            const finalLength = carriageBaseLength_svg * scale;
            const finalHeight = desiredCarriageWidth;
            const barrelBoxLength = finalLength * (5 / 3);
            const barrelBoxWidth = finalHeight * (1 / 2);
            const knobRadius = (barrelBoxWidth * (2 / 5)) / 2;
            const muzzleTipLocalX = knobRadius * 3 + barrelBoxLength * 0.8 + barrelBoxLength * (1 / 12) + barrelBoxLength * (1 / 60);

            let muzzlePoint = { x: muzzleTipLocalX - finalLength, y: -finalHeight / 2 };
            const rotatedToDeck = rotatePoint(muzzlePoint, { x: 0, y: 0 }, cannon.angle);
            const translatedToDeck = { x: cannon.x + rotatedToDeck.x, y: cannon.y + rotatedToDeck.y };
            const rotatedToWorld = rotatePoint(translatedToDeck, { x: 0, y: 0 }, this.angle);
            muzzleWorldPos = { x: this.x + rotatedToWorld.x, y: this.y + rotatedToWorld.y };
        }

        const fireAngle = normalizeAngle(this.angle + cannon.angle);

        // --- NEW: Dynamically calculate cannonball radius based on the blueprint cannon size ---
        const dynamicRadius = CANNON_UNIT_SIZE / 4;

        // --- FIX: Pass the ship's current velocity to the cannonball for inherited momentum. ---
        const inheritedVx = this.vx;
        const inheritedVy = this.vy;
        
        // --- NEW: Instantiate correct projectile type ---
        const shotType = this.selectedShotType || 'round-shot';
        if (shotType === 'chain-shot') {
            cannonballs.push(new ChainShot(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        } else if (shotType === 'grape-shot') {
            cannonballs.push(new GrapeShot(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        } else if (shotType === 'canister-shot') {
            cannonballs.push(new CanisterShot(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        } else {
            cannonballs.push(new Cannonball(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        }

        // --- NEW: Create Visual Effect ---
        // This call was missing for NPCs because they didn't have this method.
        if (window.PlunderGame && window.PlunderGame.createCannonEffect) {
            window.PlunderGame.createCannonEffect(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, window.windDirection);
        }
    }

    /**
     * New: Calculates the total number of cannons on the ship.
     * @returns {number} The total gun count.
     */
    getTotalGunCount() {
        let totalGuns = 0;
        if (this.blueprint) {
            // Count deck guns
            if (this.blueprint.layout && this.blueprint.layout.cannonLayouts) {
                Object.values(this.blueprint.layout.cannonLayouts).forEach(layout => totalGuns += layout.length);
            }
            // Count superstructure guns
            if (this.blueprint.geometry) {
                const parts = ['forecastle', 'midcastle', 'aftercastle', 'sterncastle', 'spardeck', 'spardeckSterncastle'];
                parts.forEach(part => {
                    if (this.blueprint.geometry[part] && this.blueprint.geometry[part].cannons) {
                        totalGuns += this.blueprint.geometry[part].cannons.length;
                    }
                });
            }
        }
        return totalGuns;
    }

    /**
     * New: Calculates the total durability of the ship's rigging based on its sails.
     * The formula is (Sum of the largest dimension of each sail) / 2.
     * @returns {number} The total rig durability HP, rounded.
     */
    getRigDurability() {
        let totalSailDimension = 0;

        if (!this.rigs || this.rigs.length === 0) {
            return 0;
        }

        // Iterate through each rig attached to the ship.
        this.rigs.forEach(rig => {
            // Each rig class now has a method to report its sail dimension contribution.
            if (typeof rig.getDurabilityContribution === 'function') {
                totalSailDimension += rig.getDurabilityContribution();
            }
        });

        // --- FIX: Convert total pixel dimension to game units before final calculation. ---
        const totalDimensionInUnits = totalSailDimension / CARGO_UNIT_SIZE;
        const rigDurability = totalDimensionInUnits / 2;

        return Math.round(rigDurability);
    }

    /**
     * New: Calculates the number of cannons on a single broadside.
     * @param {string} [side='starboard'] - The side to count ('port' or 'starboard').
     * @returns {number} The total number of functional cannons on that side.
     */
    getBroadsideCount(side = 'starboard') {
        let broadsideGuns = 0;
        const blueprint = this.blueprint;
        if (!blueprint) return 0;
        const targetSide = side.toLowerCase();

        // Helper to count non-chaser guns in a given layout.
        const countSideGuns = (cannonLayout) => {
            if (!cannonLayout) return 0;
            // --- FIX: Case-insensitive check ---
            return cannonLayout.filter(c => c.side && c.side.toLowerCase() === targetSide && !c.destroyed).length;
        };

        // 1. Count guns on all main decks
        if (blueprint.layout.cannonLayouts) {
            for (const tier in blueprint.layout.cannonLayouts) {
                broadsideGuns += countSideGuns(blueprint.layout.cannonLayouts[tier]);
            }
        }

        // 2. Count guns on all superstructures
        broadsideGuns += countSideGuns(blueprint.geometry.aftercastle?.cannons);
        broadsideGuns += countSideGuns(blueprint.geometry.forecastle?.cannons);
        broadsideGuns += countSideGuns(blueprint.geometry.midcastle?.cannons);
        broadsideGuns += countSideGuns(blueprint.geometry.sterncastle?.cannons);
        broadsideGuns += countSideGuns(blueprint.geometry.spardeck?.cannons);
        broadsideGuns += countSideGuns(blueprint.geometry.spardeckSterncastle?.cannons);

        return broadsideGuns;
    }

    /**
     * New: Checks if the ship has any cannons configured for a specific side.
     * Used by AI to avoid attempting to fire non-existent chasers.
     * @param {string} side - 'port', 'starboard', 'bow', or 'stern'.
     * @returns {boolean}
     */
    hasCannonsOnSide(side) {
        if (!this.blueprint) return false;
        const targetSide = side.toLowerCase();

        // Helper to check a list
        const checkList = (list) => {
            if (!list) return false;
            return list.some(c => c.side && c.side.toLowerCase() === targetSide && !c.destroyed);
        };

        // Check main decks
        if (this.blueprint.layout.cannonLayouts) {
            for (const tier in this.blueprint.layout.cannonLayouts) {
                if (checkList(this.blueprint.layout.cannonLayouts[tier])) return true;
            }
        }

        // Check superstructures
        const geo = this.blueprint.geometry;
        const parts = [geo.aftercastle, geo.forecastle, geo.midcastle, geo.sterncastle, geo.spardeck, geo.spardeckSterncastle];
        
        return parts.some(part => part && checkList(part.cannons));
    }

    /**
     * New: Returns a flat list of all cannon objects on the ship.
     * @returns {Array<object>}
     */
    getAllCannons() {
        const allCannons = [];
        if (!this.blueprint) return allCannons;

        const collect = (list) => {
            if (list) allCannons.push(...list);
        };

        if (this.blueprint.layout.cannonLayouts) {
            Object.values(this.blueprint.layout.cannonLayouts).forEach(collect);
        }
        
        const geo = this.blueprint.geometry;
        const parts = [geo.aftercastle, geo.forecastle, geo.midcastle, geo.sterncastle, geo.spardeck, geo.spardeckSterncastle];
        parts.forEach(part => { if (part && part.cannons) collect(part.cannons); });
        
        return allCannons;
    }

    /**
     * New: Destroys a random functional cannon on the ship.
     * @returns {boolean} True if a cannon was destroyed.
     */
    destroyRandomCannon() {
        const functionalCannons = this.getAllCannons().filter(c => !c.destroyed);
        if (functionalCannons.length > 0) {
            const target = functionalCannons[Math.floor(Math.random() * functionalCannons.length)];
            target.destroyed = true;
            
            // --- NEW: Remove from inventory ---
            // Remove one cannon item to reflect the destruction.
            this.consumeItem('cannon', 1);
            
            // --- NEW: Regenerate Visual Cache ---
            this._cacheShipImage();
            
            return true;
        }
        return false;
    }

    /**
     * New: Synchronizes the ship's functional cannons with the inventory count.
     * - If inventory has more cannons than currently working, repairs destroyed ones (using spares).
     * - If inventory has fewer cannons, breaks working ones (reflects selling/dumping).
     * @param {number} repairLimit - Maximum number of cannons to repair in this call.
     * @returns {number} Number of cannons actually repaired.
     */
    reconcileCannons(repairLimit = 0) {
        if (!this.inventory) return 0;

        // 1. Count Cannons in Inventory
        let inventoryCannons = 0;
        if (this.inventory.cargo) {
            // Default to 1 if database not loaded
            const cannonItemDef = window.ITEM_DATABASE?.['cannon'];
            const unitSize = cannonItemDef ? (cannonItemDef.fixedSize || cannonItemDef.weight) : 1;

            for (const entry of this.inventory.cargo) {
                if (entry.item.id === 'cannon') {
                    // Handle containerized or loose items based on total mass
                    const entryUnitWeight = (entry.container && entry.container.weight > 0) ? entry.container.weight : unitSize;
                    const mass = entry.quantity * entryUnitWeight;
                    inventoryCannons += Math.floor(mass / unitSize);
                }
            }
        }

        // 2. Get Ship Cannon State
        const allCannons = this.getAllCannons();
        const functionalCannons = allCannons.filter(c => !c.destroyed);
        const destroyedCannons = allCannons.filter(c => c.destroyed);

        const currentFunctionalCount = functionalCannons.length;
        let repairedCount = 0;
        let changed = false;

        // 3. Repair if Surplus (Spares available) AND allowed by limit
        if (inventoryCannons > currentFunctionalCount && destroyedCannons.length > 0 && repairLimit > 0) {
            const needed = inventoryCannons - currentFunctionalCount;
            const availableToRepair = destroyedCannons.length;
            const toRepair = Math.min(needed, availableToRepair, repairLimit);

            // Repair the first N destroyed cannons found
            for (let i = 0; i < toRepair; i++) {
                destroyedCannons[i].destroyed = false;
            }
            repairedCount = toRepair;
            changed = true;
        }
        // 4. Disable if Deficit (Cannons removed from inventory)
        else if (inventoryCannons < currentFunctionalCount) {
            const toDestroy = currentFunctionalCount - inventoryCannons;
            // Shuffle functional cannons to remove them randomly, rather than sequentially
            const shuffled = functionalCannons.sort(() => 0.5 - Math.random());
            for (let i = 0; i < toDestroy; i++) {
                shuffled[i].destroyed = true;
            }
            changed = true;
        }
        
        if (changed) {
            this._cacheShipImage();
        }

        return repairedCount;
    }

    /**
     * New: Gets the specific close-hauled angle for this ship's rig.
     * @returns {number} The angle in radians.
     */
    getCloseHauledAngle() {
        const rigType = this.blueprint.layout.rigType;
        const angleDeg = RIG_CLOSE_HAULED_ANGLES[rigType] || 50;
        return angleDeg * (Math.PI / 180);
    }

    /**
     * New: Overrides the global wind speed multiplier to provide rig-specific performance.
     * @param {number} shipAngle - The ship's current angle in radians.
     * @param {number} windDirection - The current wind direction in radians.
     * @returns {number} A speed multiplier between 0.0 and 1.0.
     */
    getWindSpeedMultiplier(shipAngle, windDirection) {
        // --- New: Apply reefing penalty ---
        if (this.isReefed) {
            return getWindSpeedMultiplier(shipAngle, windDirection) * REEFING_SPEED_PENALTY;
        }
        
        const rigType = this.blueprint.layout.rigType;

        // --- FIX: Correct the angle calculation to properly determine upwind vs. downwind ---
        // The angle off the wind should be 0 when running with the wind (ship and wind direction are opposite).
        let angleDiff = normalizeAngle(shipAngle - windDirection + Math.PI);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        const absAngleOffWindDegrees = Math.abs(angleDiff * 180 / Math.PI);

        // Helper function for linear interpolation between two points.
        const interpolate = (angle, p1, p2) => {
            const angleRange = p2.angle - p1.angle; if (angleRange === 0) return p1.speed; const progressInRange = (angle - p1.angle) / angleRange; return p1.speed + (progressInRange * (p2.speed - p1.speed));
        };

        // --- FIX: Directly look up the performance curve for the specific rig type. ---
        const pointsOfSail = RIG_PERFORMANCE_CURVES[rigType];

        if (!pointsOfSail) {
            // Fallback to the original Base Ship model if rig type is unknown.
            return getWindSpeedMultiplier(shipAngle, windDirection);
        }

        // Find the correct segment and interpolate the speed.
        if (absAngleOffWindDegrees <= pointsOfSail[0].angle) {
            return pointsOfSail[0].speed;
        }

        for (let i = 0; i < pointsOfSail.length - 1; i++) {
            const p1 = pointsOfSail[i];
            const p2 = pointsOfSail[i + 1];
            if (absAngleOffWindDegrees <= p2.angle) {
                return interpolate(absAngleOffWindDegrees, p1, p2);
            }
        }

        return pointsOfSail[pointsOfSail.length - 1].speed; // Fallback for 180 degrees
    }

    /**
     * Overrides the base draw method to render the procedural cannon layout.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawWorldSpace(ctx, zoomLevel, windDirection, renderMode = 'full') {
        // --- NEW: Draw Wake for Custom Ships ---
        if (renderMode !== 'sinking-effects') {
            // --- NEW: Hide wake when mostly submerged ---
            const sinkProgress = this.isSinking ? (this.sinkHp / this.maxSinkHp) : 0;
            if (sinkProgress <= 0.5) {
                this._drawWake(ctx, zoomLevel);
            }
        }

        if (this.isSinking && renderMode !== 'sinking-effects') {
            const progress = Math.min(1, this.sinkHp / this.maxSinkHp);

            // --- NEW: Smooth Transition Logic (Under Layer) ---
            let underOpacity = 1.0;
            const transitionStart = 0.4;
            const transitionEnd = 0.6;
            
            if (progress >= transitionEnd) {
                underOpacity = 0.0;
            } else if (progress > transitionStart) {
                underOpacity = 1.0 - ((progress - transitionStart) / (transitionEnd - transitionStart));
            }

            if (underOpacity > 0) {
                this._drawSinkingRings(ctx, zoomLevel, underOpacity);
            }
            const canvas = Ship.getSharedSinkingCanvas();
            const bCtx = canvas.getContext('2d');
            const bounds = this.getOverallBounds();
            const diag = Math.sqrt(bounds.length ** 2 + bounds.width ** 2);
            const size = diag * 1.5;
            
            if (canvas.width < size || canvas.height < size) {
                canvas.width = size;
                canvas.height = size;
            } else {
                bCtx.clearRect(0, 0, canvas.width, canvas.height);
            }
            
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            bCtx.save();
            bCtx.translate(cx, cy);
            this._drawShipComponents(bCtx, zoomLevel, windDirection);
            
            bCtx.globalCompositeOperation = 'source-atop';
            bCtx.rotate(this.sinkAngle);
            
            const extent = size / 2;
            const currentY = extent - (extent * 2 * progress);
            
            bCtx.beginPath();
            const baseAmp = 4 / zoomLevel;
            const time = performance.now();
            
            for (let x = -extent; x <= extent; x += (5 / zoomLevel)) {
                // Sum of sines for irregular "random" waves
                const y1 = Math.sin(x * 0.025 + time * 0.002) * (baseAmp * 1.2); // Long swell
                const y2 = Math.sin(x * 0.075 + time * 0.005) * baseAmp;         // Main wave
                const y3 = Math.sin(x * 0.20 + time * 0.012) * (baseAmp * 0.6); // Fast chop
                
                const yOffset = y1 + y2 + y3;
                if (x === -extent) bCtx.moveTo(x, currentY + yOffset);
                else bCtx.lineTo(x, currentY + yOffset);
            }
            bCtx.lineTo(extent, extent);
            bCtx.lineTo(-extent, extent);
            bCtx.closePath();
            
            const currentAlpha = 0.75 + (progress * 0.25);
            bCtx.fillStyle = `rgba(52, 152, 219, ${currentAlpha})`;
            bCtx.fill();
            
            bCtx.restore();

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            
            // Shrink as it sinks to simulate depth
            // Delay shrinking so water covers the hull first (starts at 33% progress)
            const effectiveProgress = Math.max(0, (progress - 0.33) / 0.67);
            const sinkScale = 1.0 - (effectiveProgress * 0.3);
            ctx.scale(sinkScale, sinkScale);
            
            // Simulate tilting by foreshortening along the sink direction
            ctx.rotate(this.sinkAngle);
            const tiltScale = Math.max(0.1, 1.0 - (effectiveProgress * 0.3));
            ctx.scale(1.0, tiltScale);
            ctx.rotate(-this.sinkAngle);
            
            ctx.drawImage(canvas, -cx, -cy);
            ctx.restore();
        } else if (!this.isSinking && renderMode === 'full') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            this._drawShipComponents(ctx, zoomLevel, windDirection);
            ctx.restore();
        }

        // --- NEW: Draw Fire (World Space, On Top) ---
        this._drawFire(ctx);
        // --- NEW: Draw Smoke (World Space, On Top) ---
        this._drawSmoke(ctx, zoomLevel);

        // --- NEW: Conditional Sinking Effects ---
        if (this.isSinking && renderMode !== 'sinking-hull') {
            const progress = Math.min(1, this.sinkHp / this.maxSinkHp);
            
            // --- NEW: Smooth Transition Logic (Over Layer) ---
            let overOpacity = 0.0;
            const transitionStart = 0.4;
            const transitionEnd = 0.6;
            
            if (progress >= transitionEnd) {
                overOpacity = 1.0;
            } else if (progress > transitionStart) {
                overOpacity = (progress - transitionStart) / (transitionEnd - transitionStart);
            }

            if (overOpacity > 0) { this._drawSinkingRings(ctx, zoomLevel, overOpacity); }
            // Bubbles are always on top
            this._drawSinkingBubbles(ctx, zoomLevel);
        }
    }

    /**
     * Helper to draw all custom ship components to the provided context.
     * Assumes context is already transformed to ship's local space.
     * @private
     */
    _drawShipComponents(ctx, zoomLevel, windDirection) {
        if (this.rigs) {
            this.rigs.forEach(rig => rig.drawSpritSail?.(ctx, zoomLevel, windDirection));
        }

        if (this.hullCacheCanvas) {
            ctx.drawImage(this.hullCacheCanvas, this.hullCacheOffset.x, this.hullCacheOffset.y);
        } else {
            this._drawHull(ctx, this.hullBaseVisualPoints, this.primaryHullColor, zoomLevel);
            this._drawTier1(ctx, zoomLevel);
            if (this.blueprint.layout.numDecks >= 2) this._drawTier2(ctx, zoomLevel);
            if (this.blueprint.layout.numDecks >= 3) this._drawTier3(ctx, zoomLevel);
            this._drawTopmostBulwarkRail(ctx);
            if (this.blueprint.geometry.aftercastle) this._drawAftercastle(ctx);
            if (this.blueprint.geometry.forecastle) this._drawForecastle(ctx);
            if (this.blueprint.geometry.midcastle) this._drawMidcastle(ctx);
            if (this.blueprint.geometry.midDeckhouse) this._drawMidDeckhouse(ctx);
            if (this.blueprint.geometry.foreDeckhouse) this._drawForeDeckhouse(ctx);
            if (this.blueprint.geometry.aftDeckhouse) this._drawAftDeckhouse(ctx);
            if (this.blueprint.geometry.sternCabin) this._drawSternCabin(ctx);
            if (this.blueprint.geometry.spardeck) this._drawSparDeckWithCutout(ctx);
            if (this.blueprint.geometry.sterncastle) this._drawSterncastle(ctx, this.blueprint.geometry.sterncastle);
            if (this.blueprint.geometry.spardeckSterncastle) this._drawSterncastle(ctx, this.blueprint.geometry.spardeckSterncastle);
        }

        // --- NEW: Draw Hull Damage Overlay ---
        // OPTIMIZATION: Only process damage overlay if the ship is actually damaged.
        if (this.hp < this.maxHp) {
            this._updateHullDamageCache();
            if (this.hullDamageCacheCanvas) {
                ctx.drawImage(this.hullDamageCacheCanvas, this.hullCacheOffset.x, this.hullCacheOffset.y);
            }
        }

        if (this.rigs) {
            this.rigs.forEach(rig => rig.drawRigging(ctx, zoomLevel, windDirection));
        }

        if (this.blueprint.layout.masts) {
            this.blueprint.layout.masts.forEach(mastConfig => this._drawMastTopAssembly(ctx, mastConfig));
        }
    }

    /**
     * New: Creates a pre-rendered image of the ship's static components (hull, decks, superstructures)
     * onto an offscreen canvas for performance. This is called once when the blueprint is applied.
     * @private
     */
    _cacheShipImage() {
        if (!this.blueprint) return;

        // 1. Calculate the bounding box of all static geometry to size the canvas.
        const allPoints = [];
        const geo = this.blueprint.geometry;

        const addPointsFromStructure = (structure) => {
            if (!structure) return;
            for (const key in structure) {
                const prop = structure[key];
                if (Array.isArray(prop) && prop.length > 0 && prop[0]?.hasOwnProperty('x')) {
                    allPoints.push(...prop);
                }
            }
        };

        allPoints.push(...geo.hull, ...geo.deck, ...geo.bulwark, ...geo.bulwarkCutout, ...geo.bulwarkRailOuter, ...geo.bulwarkRailInner);
        if (geo.tier2_hull) allPoints.push(...geo.tier2_hull, ...geo.tier2_deck, ...geo.tier2_bulwark, ...geo.tier2_bulwarkCutout, ...geo.tier2_bulwarkRailOuter, ...geo.tier2_bulwarkRailInner);
        if (geo.tier3_hull) allPoints.push(...geo.tier3_hull, ...geo.tier3_deck, ...geo.tier3_bulwark, ...geo.tier3_bulwarkCutout, ...geo.tier3_bulwarkRailOuter, ...geo.tier3_bulwarkRailInner);
        addPointsFromStructure(geo.aftercastle);
        addPointsFromStructure(geo.forecastle);
        addPointsFromStructure(geo.midcastle);
        addPointsFromStructure(geo.sterncastle);
        addPointsFromStructure(geo.spardeck);
        if (geo.spardeck?.gangwayRails) addPointsFromStructure(geo.spardeck.gangwayRails);
        addPointsFromStructure(geo.spardeckSterncastle);
        addPointsFromStructure(geo.sternCabin);

        const addPointsFromRect = (rect, centerX = 0) => {
            if (!rect) return;
            allPoints.push({ x: centerX - rect.length / 2, y: -rect.width / 2 }, { x: centerX + rect.length / 2, y: rect.width / 2 });
        };
        if (geo.midDeckhouse) addPointsFromRect(geo.midDeckhouse.outer);
        if (geo.foreDeckhouse) addPointsFromRect(geo.foreDeckhouse.outer, (geo.foreDeckhouse.outer.startX + geo.foreDeckhouse.outer.endX) / 2);
        if (geo.aftDeckhouse) addPointsFromRect(geo.aftDeckhouse.outer, (geo.aftDeckhouse.outer.startX + geo.aftDeckhouse.outer.endX) / 2);
        
        // Add the bowsprit spar's length to the bounding box calculation to ensure it isn't clipped from the cache.
        this.rigs.forEach(rig => {
            if (rig.bowspritDeckStart !== undefined) {
                // Add a point for the tip of the bowsprit spar.
                allPoints.push({ x: rig.bowspritDeckStart + rig.bowspritLength, y: 0 });
            }
        });

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        allPoints.forEach(p => { if (p) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); } });

        const margin = 5;
        minX -= margin; minY -= margin; maxX += margin; maxY += margin;
        const width = maxX - minX; const height = maxY - minY;

        if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) return;

        // 2. Create and prepare the offscreen canvas.
        // --- OPTIMIZATION: Reuse existing canvas if dimensions match ---
        if (!this.hullCacheCanvas || this.hullCacheCanvas.width !== width || this.hullCacheCanvas.height !== height) {
            this.hullCacheCanvas = document.createElement('canvas');
            this.hullCacheCanvas.width = width;
            this.hullCacheCanvas.height = height;
        }
        const offCtx = this.hullCacheCanvas.getContext('2d');
        offCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        offCtx.clearRect(0, 0, width, height); // Clear previous content

        this.hullCacheOffset = { x: minX, y: minY };
        offCtx.translate(-minX, -minY);

        // 3. Perform the one-time draw of all static components onto the offscreen canvas.
        const DUMMY_ZOOM_LEVEL = 1;
        this._drawHull(offCtx, this.hullBaseVisualPoints, this.primaryHullColor, DUMMY_ZOOM_LEVEL);
        this._drawTier1(offCtx, DUMMY_ZOOM_LEVEL);
        if (this.blueprint.layout.numDecks >= 2) this._drawTier2(offCtx, DUMMY_ZOOM_LEVEL);
        if (this.blueprint.layout.numDecks >= 3) this._drawTier3(offCtx, DUMMY_ZOOM_LEVEL);

        // --- Static Bowsprit Spar Draw ---
        // Draw the static spar into the cache.
        if (this.rigs) {
            this.rigs.forEach(rig => {
                if (rig.drawBowspritSpar) {
                    rig.drawBowspritSpar(offCtx, DUMMY_ZOOM_LEVEL);
                } else {
                    // Fallback for rigs that don't have a sprit sail (like Sloops)
                    // where drawBowsprit likely only draws the spar.
                    rig.drawBowsprit?.(offCtx, DUMMY_ZOOM_LEVEL);
                }
            });
        }
        this._drawTopmostBulwarkRail(offCtx);
        if (this.blueprint.geometry.aftercastle) this._drawAftercastle(offCtx);
        if (this.blueprint.geometry.forecastle) this._drawForecastle(offCtx);
        if (this.blueprint.geometry.midcastle) this._drawMidcastle(offCtx);
        if (this.blueprint.geometry.midDeckhouse) this._drawMidDeckhouse(offCtx);
        if (this.blueprint.geometry.foreDeckhouse) this._drawForeDeckhouse(offCtx);
        if (this.blueprint.geometry.aftDeckhouse) this._drawAftDeckhouse(offCtx);
        if (this.blueprint.geometry.sternCabin) this._drawSternCabin(offCtx);
        if (this.blueprint.geometry.spardeck) this._drawSparDeckWithCutout(offCtx);
        if (this.blueprint.geometry.sterncastle) this._drawSterncastle(offCtx, this.blueprint.geometry.sterncastle);
        if (this.blueprint.geometry.spardeckSterncastle) this._drawSterncastle(offCtx, this.blueprint.geometry.spardeckSterncastle);

        console.log(`[Cache] Pre-rendered hull for ${this.archetypeName || 'Player Ship'} to a ${width}x${height} canvas.`);
    }

    /**
     * New: Updates the cached hull damage image.
     * Uses shadowBlur to create a gradient/soft edge effect for holes and cracks.
     * @private
     */
    _updateHullDamageCache() {
        const currentHpPercent = this.hp / this.maxHp;
        
        // Only update if we've crossed a threshold (e.g., every 5% loss) or if cache is missing
        if (this.hullDamageCacheCanvas && Math.abs(this.lastCachedHullHpPercent - currentHpPercent) < 0.05) {
            return;
        }

        // 1. Setup Canvas (Reuse dimensions from hull cache)
        if (!this.hullDamageCacheCanvas && this.hullCacheCanvas) {
            this.hullDamageCacheCanvas = document.createElement('canvas');
            this.hullDamageCacheCanvas.width = this.hullCacheCanvas.width;
            this.hullDamageCacheCanvas.height = this.hullCacheCanvas.height;
        }
        if (!this.hullDamageCacheCanvas) return;

        const ctx = this.hullDamageCacheCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.hullDamageCacheCanvas.width, this.hullDamageCacheCanvas.height);
        
        ctx.save();
        // Apply same offset as hull cache
        ctx.translate(-this.hullCacheOffset.x, -this.hullCacheOffset.y);

        // 2. Draw Damage
        for (const pattern of this.hullDamagePatterns) {
            if (currentHpPercent < pattern.threshold) {
                ctx.save();
                ctx.translate(pattern.x, pattern.y);
                ctx.rotate(pattern.rotation);

                // --- Gradient/Soft Edge Effect ---
                ctx.shadowColor = 'rgba(20, 10, 5, 0.8)'; // Dark brown/black shadow
                ctx.shadowBlur = 4; // Soften edges
                ctx.fillStyle = '#1a1a1a'; // Dark hole center
                ctx.strokeStyle = '#2a2a2a'; // Dark crack line

                if (pattern.type === 'hole') {
                    ctx.beginPath();
                    pattern.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    pattern.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
        ctx.restore();

        this.lastCachedHullHpPercent = currentHpPercent;
    }

    /**
     * New: Draws standard deck objects like the cargo hatch.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @private
     */
    _drawDeckObjects(ctx) {
        const deckObjects = this.blueprint.geometry.deckObjects;
        if (!deckObjects) return;

        if (deckObjects.cargoHatches) {
            deckObjects.cargoHatches.forEach(hatch => {
                this._drawCargoHatch(ctx, hatch);
            });
        }
    }

    /**
     * New: Draws the cargo hatch grid onto the deck.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {object} hatch - The cargo hatch geometry data from the blueprint.
     * @private
     */
    _drawCargoHatch(ctx, hatch) {
        ctx.save();

        const scaledLength = hatch.length;
        const scaledWidth = hatch.width;
        const scaledBarThickness = hatch.barThickness;
        const scaledGridUnit = hatch.barThickness + hatch.spacing;

        // --- New: Draw the outer frame first ---
        // The frame is double the thickness of the bars.
        const frameThickness = scaledBarThickness * 2;
        const frameLength = scaledLength + (frameThickness * 2);
        const frameWidth = scaledWidth + (frameThickness * 2);
        const frameStartX = hatch.x - (frameLength / 2);
        const frameStartY = hatch.y - (frameWidth / 2);
        ctx.fillStyle = this.primaryHullColor; // Frame color matches the bars.
        ctx.fillRect(frameStartX, frameStartY, frameLength, frameWidth);

        // --- New: Draw a solid black rectangle underneath the hatch grid ---
        // This creates the illusion of a dark opening into the cargo hold.
        const startDrawX = hatch.x - (scaledLength / 2);
        const startDrawY = hatch.y - (scaledWidth / 2);
        ctx.fillStyle = 'black';
        ctx.fillRect(startDrawX, startDrawY, scaledLength, scaledWidth);

        ctx.fillStyle = this.lighterHullColor; // Use the lighter hull color for the bars.

        // Draw vertical bars (along the Y-axis)
        const startBarX = startDrawX;
        for (let i = 0; i < hatch.numBarsX; i++) {
            const xPos = startBarX + (i * scaledGridUnit);
            ctx.fillRect(xPos, startDrawY, scaledBarThickness, scaledWidth);
        }

        // Draw horizontal bars (along the X-axis)
        const startBarY = startDrawY;
        for (let i = 0; i < hatch.numBarsY; i++) {
            const yPos = startBarY + (i * scaledGridUnit);
            ctx.fillRect(startDrawX, yPos, scaledLength, scaledBarThickness);
        }

        ctx.restore();
    }

    /**
     * Draws only the plank lines over an existing deck shape.
     * @private
     */
    _drawDeckPlanks(ctx, plankLines, plankColor) {
        if (!plankLines || plankLines.length === 0) return;
        
        ctx.strokeStyle = plankColor;
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (const line of plankLines) {
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
        }
        ctx.stroke();
    }

    /**
     * Draws a simple, solid hull shape.
     * @private
     */
    _drawHull(ctx, hullPoints, color, zoomLevel) {
        ctx.fillStyle = color;
        ctx.beginPath();
        hullPoints.forEach((p, i) => (i === 0) ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        // FIX: Use the 'evenodd' fill rule to correctly render polygons with holes, like the spar-deck gangway.
        ctx.fill('evenodd');
    }

    /**
     * Draws a simple, solid bulwark shape with a cutout (no gunports).
     * @private
     */
    _drawBulwark(ctx, bulwarkPoints, innerCutoutPoints) {
        // This draws the solid "base" of the bulwark, using the lighter derived color.
        ctx.fillStyle = this.lighterHullColor;
        ctx.beginPath();
        // Outer path
        bulwarkPoints.forEach((p, i) => (i === 0) ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        // Inner path (for cutout)
        const scaledInnerBulwark = [...innerCutoutPoints].reverse();
        scaledInnerBulwark.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.closePath();
        ctx.fill('evenodd');
    }

    /**
     * New: Draws the "Bulwark Top" with gunports cut out.
     * @private
     */
    _drawBulwarkTopWithGunports(ctx, outerBulwarkPoints, innerBulwarkPoints, tier) {
        // --- FIX: The tier parameter can now be an array of cannons to draw. ---
        const cannonsForTier = typeof tier === 'number'
            ? this.blueprint.layout?.cannonLayouts?.[tier]
            : tier;

        // --- New Strategy: Use an offscreen canvas for isolated cutting ---
        const bbox = {
            minX: Math.min(...outerBulwarkPoints.map(p => p.x)),
            minY: Math.min(...outerBulwarkPoints.map(p => p.y)),
            maxX: Math.max(...outerBulwarkPoints.map(p => p.x)),
            maxY: Math.max(...outerBulwarkPoints.map(p => p.y)),
        };
        const width = bbox.maxX - bbox.minX;
        const height = bbox.maxY - bbox.minY;

        if (width <= 0 || height <= 0) return;

        const RESOLUTION_MULTIPLIER = 2; // Increase to 2x resolution for smoother cuts.

        const offscreenCanvas = CustomShip.getSharedCutoutCanvas();
        offscreenCanvas.width = width * RESOLUTION_MULTIPLIER;
        offscreenCanvas.height = height * RESOLUTION_MULTIPLIER;
        const offCtx = offscreenCanvas.getContext('2d');

        // Scale the offscreen context to draw at the higher resolution.
        offCtx.scale(RESOLUTION_MULTIPLIER, RESOLUTION_MULTIPLIER);
        // Translate the offscreen context so drawing happens relative to the bounding box.
        offCtx.translate(-bbox.minX, -bbox.minY);

        // 1. Draw the solid Bulwark Top onto the offscreen canvas.
        offCtx.fillStyle = this.secondaryHullColor;
        offCtx.beginPath();
        outerBulwarkPoints.forEach((p, i) => (i === 0) ? offCtx.moveTo(p.x, p.y) : offCtx.lineTo(p.x, p.y));
        offCtx.closePath();
        const reversedInner = [...innerBulwarkPoints].reverse();
        reversedInner.forEach((p, i) => (i === 0) ? offCtx.moveTo(p.x, p.y) : offCtx.lineTo(p.x, p.y));
        offCtx.closePath();
        offCtx.fill('evenodd');

        // 2. Cut the gunports out of the offscreen canvas shape.
        if (cannonsForTier && cannonsForTier.length > 0) {
            offCtx.globalCompositeOperation = 'destination-out';
            offCtx.beginPath();
            // --- FIX: Only cut gunports for broadside cannons ---
            // Filter out stern/bow chasers before creating cutouts.
            cannonsForTier.filter(c => c.side === 'port' || c.side === 'starboard').forEach(cannon => {
                this._createGunportBarSubPath(offCtx, cannon.x, outerBulwarkPoints, innerBulwarkPoints);
            });
            offCtx.fill();
        }

        // 3. Draw the final, pre-composited image onto the main canvas.
        // By specifying the original width/height, we let the browser downscale the hi-res image smoothly.
        ctx.drawImage(offscreenCanvas, bbox.minX, bbox.minY, width, height);

        // --- New Debug Drawing ---
        // If the debug flag is on, draw the gunport cutouts again in red to visualize them.
        if (DEBUG.ENABLED && DEBUG.DRAW_GUNPORT_CUTOUTS) {
            this._drawDebugGunportRects(ctx, outerBulwarkPoints, innerBulwarkPoints, tier);
        }
    }

    _drawDebugGunportRects(ctx, outerBulwarkPoints, innerBulwarkPoints, tier) {
        const cannonsForTier = this.blueprint.layout?.cannonLayouts?.[tier];
        if (!cannonsForTier || cannonsForTier.length === 0) return;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent red
        ctx.beginPath(); // FIX: Start a new path to isolate the debug rectangles.
        cannonsForTier.forEach(cannon => {
            this._createGunportBarSubPath(ctx, cannon.x, outerBulwarkPoints, innerBulwarkPoints);
        });
        ctx.fill(); // Fill the rectangles created by _createGunportBarSubPath
        ctx.restore();
    }

    /**
     * Helper to find the Y-coordinate on a line of points for a given X-coordinate.
     * @private
     */
    _interpolateY(x, points) {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
                const t = (x - p1.x) / (p2.x - p1.x);
                return p1.y + t * (p2.y - p1.y);
            }
        }
        return null; // X is outside the range of the points
    }

    /**
     * Helper to create the rectangular sub-path for a single gunport bar.
     * @private
     */
    _createGunportBarSubPath(ctx, cannonX, outerBulwarkPoints, innerBulwarkPoints) {
        const barThickness = CANNON_UNIT_SIZE;
        const scaledCannonX = cannonX;
        const scaledBarThickness = barThickness;
    
        // Create two separate cutouts, one for port and one for starboard.
        const sides = ['port', 'starboard'];
        sides.forEach(side => {
            // Use the actual bulwark geometry for interpolation.
            const sideOuterPoints = outerBulwarkPoints.filter(p => side === 'port' ? p.y <= 0 : p.y >= 0);
            const sideInnerPoints = innerBulwarkPoints.filter(p => side === 'port' ? p.y <= 0 : p.y >= 0);
            sideOuterPoints.sort((a, b) => a.x - b.x);
            sideInnerPoints.sort((a, b) => a.x - b.x);
            const yOuter = this._interpolateY(cannonX, sideOuterPoints); // This is the outer edge of the bulwark.
            const yInner = this._interpolateY(cannonX, sideInnerPoints);
    
            if (yOuter === null || yInner === null) return;
    
            // Scale the coordinates for drawing.
            const scaledYOuter = yOuter;
            const scaledYInner = yInner;
    
            // Define the corners of the rectangular cutout for this side.
            const x1 = scaledCannonX - scaledBarThickness / 2;
            const x2 = scaledCannonX + scaledBarThickness / 2;
    
            // Add this rectangle as a new sub-path.
            ctx.moveTo(x1, scaledYOuter);
            ctx.lineTo(x2, scaledYOuter);
            ctx.lineTo(x2, scaledYInner);
            ctx.lineTo(x1, scaledYInner);
            ctx.closePath();
        });
    }

    /**
     * Draws a bulwark rail shape with a cutout.
     * @private
     */
    _drawBulwarkRail(ctx, outerRailPoints, innerRailPoints) {
        ctx.fillStyle = this.bulwarkRailColor;
        ctx.beginPath();
        // Outer path
        outerRailPoints.forEach((p, i) => (i === 0) ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        // Inner path (for cutout)
        const scaledInnerRail = [...innerRailPoints].reverse();
        scaledInnerRail.forEach((point, index) => {
            if (index === 0) { ctx.moveTo(point.x, point.y); } else { ctx.lineTo(point.x, point.y); }
        });
        ctx.closePath();
        ctx.fill('evenodd');
    }


    /**
     * New: Draws all components of Tier 1.
     * @private
     */
    _drawTier1(ctx, zoomLevel) {
        // 1. Draw the solid base color of the deck.
        this._drawHull(ctx, this.deckVisualPoints, this.deckColor, zoomLevel);

        // 2. Draw the plank lines over the base color.
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.deck,
            this.deckPlankColor,                // Use the new calculated plank color
        );

        // 3. Draw deck objects (hatches) only if this is the top deck.
        if (this.blueprint.layout.numDecks === 1) {
            this._drawDeckObjects(ctx);
        }
        this._drawBulwark(ctx, this.bulwarkVisualPoints, this.bulwarkInnerCutoutVisualPoints);
        this._drawBulwarkTopWithGunports(ctx, this.bulwarkVisualPoints, this.bulwarkInnerCutoutVisualPoints, 1);
        this._drawCannons(ctx, 1);
    }

    /**
     * New: Draws all components of Tier 2.
     * @private
     */
    _drawTier2(ctx, zoomLevel) {
        // Draw everything *except* the final rail.
        this._drawHull(ctx, this.tier2_hull, this.primaryHullColor, zoomLevel);

        // Draw deck and planks for this tier
        this._drawHull(ctx, this.tier2_deck, this.deckColor, zoomLevel);
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.tier2_deck,
            this.deckPlankColor,
        );

        // Draw deck objects (hatches) only if this is the top deck.
        if (this.blueprint.layout.numDecks === 2) {
            this._drawDeckObjects(ctx);
        }

        this._drawBulwark(ctx, this.tier2_bulwark, this.tier2_bulwarkCutout);
        this._drawBulwarkTopWithGunports(ctx, this.tier2_bulwark, this.tier2_bulwarkCutout, 2);
        this._drawCannons(ctx, 2);
    }

    /**
     * New: Draws all components of Tier 3.
     * @private
     */
    _drawTier3(ctx, zoomLevel) {
        // Draw everything *except* the final rail.
        this._drawHull(ctx, this.tier3_hull, this.primaryHullColor, zoomLevel);

        // Draw deck and planks for this tier
        this._drawHull(ctx, this.tier3_deck, this.deckColor, zoomLevel);
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.tier3_deck,
            this.deckPlankColor,
        );

        // Draw deck objects (hatches) only if this is the top deck.
        if (this.blueprint.layout.numDecks === 3) {
            this._drawDeckObjects(ctx);
        }

        this._drawBulwark(ctx, this.tier3_bulwark, this.tier3_bulwarkCutout);
        this._drawBulwarkTopWithGunports(ctx, this.tier3_bulwark, this.tier3_bulwarkCutout, 3);
        this._drawCannons(ctx, 3);
    }

    /**
     * New: Draws only the bulwark rail of the highest full deck.
     * This is called after the bowsprit to ensure correct layering.
     * @private
     */
    _drawTopmostBulwarkRail(ctx) {
        const numDecks = this.blueprint.layout.numDecks;
        if (numDecks === 1) {
            this._drawBulwarkRail(ctx, this.bulwarkRailOuterVisualPoints, this.bulwarkRailInnerVisualPoints);
        } else if (numDecks === 2) {
            this._drawBulwarkRail(ctx, this.tier2_bulwarkRailOuter, this.tier2_bulwarkRailInner);
        } else if (numDecks >= 3) {
            this._drawBulwarkRail(ctx, this.tier3_bulwarkRailOuter, this.tier3_bulwarkRailInner);
        }
    }

    /**
     * New: Draws all components of the Aftercastle.
     * @private
     */
    _drawAftercastle(ctx) {
        const aftercastle = this.blueprint.geometry.aftercastle;
        const aftercastleTier = this.blueprint.layout.numDecks + 1;

        // The drawing order is the same as for other tiers.
        this._drawHull(ctx, aftercastle.hull, this.primaryHullColor);

        // Draw deck and planks
        this._drawHull(ctx, aftercastle.deck, this.deckColor);
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.aftercastle,
            this.deckPlankColor,
        );
        this._drawBulwark(ctx, aftercastle.bulwark, aftercastle.bulwarkCutout);
        // --- FIX: Use the dedicated cannon list for the aftercastle's side cannons. ---
        const aftercastleCannons = this.blueprint.geometry.aftercastle.cannons || [];
        this._drawBulwarkTopWithGunports(ctx, aftercastle.bulwark, aftercastle.bulwarkCutout, aftercastleCannons.filter(c => c.side === 'port' || c.side === 'starboard'));
        this._drawCannons(ctx, aftercastleCannons);
        this._drawBulwarkRail(ctx, aftercastle.bulwarkRailOuter, aftercastle.bulwarkRailInner);

        // --- FIX: Draw the forward lateral rail of the aftercastle. ---
        if (aftercastle.forwardRail) {
            this._drawHull(ctx, aftercastle.forwardRail, this.bulwarkRailColor);
        }
    }

    /**
     * New: Draws all components of the Forecastle.
     * @private
     */
    _drawForecastle(ctx) {
        const forecastle = this.blueprint.geometry.forecastle;
        const forecastleTier = this.blueprint.layout.numDecks + 1;

        // The drawing order is the same as for other tiers.
        this._drawHull(ctx, forecastle.hull, this.primaryHullColor);

        // Draw deck and planks
        this._drawHull(ctx, forecastle.deck, this.deckColor);
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.forecastle,
            this.deckPlankColor,
        );
        this._drawBulwark(ctx, forecastle.bulwark, forecastle.bulwarkCutout);
        // --- New: Draw the side cannons for the forecastle. ---
        const forecastleSideCannons = this.blueprint.geometry.forecastle.cannons.filter(c => c.side === 'port' || c.side === 'starboard');
        this._drawBulwarkTopWithGunports(ctx, forecastle.bulwark, forecastle.bulwarkCutout, forecastleSideCannons);
        this._drawCannons(ctx, this.blueprint.geometry.forecastle.cannons);
        this._drawBulwarkRail(ctx, forecastle.bulwarkRailOuter, forecastle.bulwarkRailInner);

        // --- New: Draw the forward and aft lateral rails of the forecastle. ---
        if (forecastle.forwardRail) {
            this._drawHull(ctx, forecastle.forwardRail, this.bulwarkRailColor); // Draw with rail color
        }
        if (forecastle.aftRail) {
            this._drawHull(ctx, forecastle.aftRail, this.bulwarkRailColor); // Draw with rail color
        }
    }

    /**
     * New: Draws all components of the Midcastle.
     * @private
     */
    _drawMidcastle(ctx) {
        const midcastle = this.blueprint.geometry.midcastle;

        // The drawing order is the same as for other tiers.
        this._drawHull(ctx, midcastle.hull, this.primaryHullColor);

        // Draw deck and planks
        this._drawHull(ctx, midcastle.deck, this.deckColor);
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.midcastle,
            this.deckPlankColor,
        );

        // --- New: Draw the cargo hatch if it exists on the midcastle deck. ---
        if (midcastle.cargoHatches) {
            midcastle.cargoHatches.forEach(hatch => { // zoomLevel was removed from _drawCargoHatch
                this._drawCargoHatch(ctx, zoomLevel, hatch);
            });
        }

        this._drawBulwark(ctx, midcastle.bulwark, midcastle.bulwarkCutout);
        
        // Draw side cannons and their gunports.
        const midcastleSideCannons = midcastle.cannons.filter(c => c.side === 'port' || c.side === 'starboard');
        this._drawBulwarkTopWithGunports(ctx, midcastle.bulwark, midcastle.bulwarkCutout, midcastleSideCannons);
        this._drawCannons(ctx, midcastle.cannons);
        this._drawBulwarkRail(ctx, midcastle.bulwarkRailOuter, midcastle.bulwarkRailInner);

        // Draw the forward and aft lateral rails.
        if (midcastle.forwardRail) {
            this._drawHull(ctx, midcastle.forwardRail, this.bulwarkRailColor);
        }
        if (midcastle.aftRail) {
            this._drawHull(ctx, midcastle.aftRail, this.bulwarkRailColor);
        }
    }

    /**
     * New: Draws all components of the Sterncastle.
     * @private
     */
    _drawSterncastle(ctx, sterncastle) {
        // The drawing order is the same as for other tiers.
        this._drawHull(ctx, sterncastle.hull, this.primaryHullColor);

        // Draw deck and planks
        this._drawHull(ctx, sterncastle.deck, this.deckColor);
        
        // --- FIX: Select correct plank cache based on which sterncastle this is ---
        const plankLines = (sterncastle === this.blueprint.geometry.spardeckSterncastle) 
            ? this.deckPlankCache.spardeckSterncastle 
            : this.deckPlankCache.sterncastle;

        this._drawDeckPlanks(ctx, 
            plankLines,
            this.deckPlankColor,
        );
        this._drawBulwark(ctx, sterncastle.bulwark, sterncastle.bulwarkCutout);

        const sterncastleSideCannons = sterncastle.cannons.filter(c => c.side === 'port' || c.side === 'starboard');
        this._drawBulwarkTopWithGunports(ctx, sterncastle.bulwark, sterncastle.bulwarkCutout, sterncastleSideCannons);
        this._drawCannons(ctx, sterncastle.cannons);
        this._drawBulwarkRail(ctx, sterncastle.bulwarkRailOuter, sterncastle.bulwarkRailInner);

        // Draw the forward lateral rail.
        if (sterncastle.forwardRail) {
            this._drawHull(ctx, sterncastle.forwardRail, this.bulwarkRailColor);
        }
    }

    /**
     * New: Draws all components of the Spar-deck.
     * @private
     */
    _drawSparDeckWithCutout(ctx) {
        const spardeck = this.blueprint.geometry.spardeck;    
        // --- FIX: Use an offscreen canvas to properly cut the gangway hole. ---
        const scaledHullPoints = spardeck.hull;
        const bbox = {
            minX: Math.min(...scaledHullPoints.map(p => p.x)),
            minY: Math.min(...scaledHullPoints.map(p => p.y)),
            maxX: Math.max(...scaledHullPoints.map(p => p.x)),
            maxY: Math.max(...scaledHullPoints.map(p => p.y)),
        };
        const width = bbox.maxX - bbox.minX;
        const height = bbox.maxY - bbox.minY;
    
        if (width <= 0 || height <= 0) return;
    
        const RESOLUTION_MULTIPLIER = 2; // Match the gunport resolution.
    
        const offscreenCanvas = CustomShip.getSharedCutoutCanvas();
        offscreenCanvas.width = width * RESOLUTION_MULTIPLIER;
        offscreenCanvas.height = height * RESOLUTION_MULTIPLIER;
        const offCtx = offscreenCanvas.getContext('2d');
    
        // Scale the offscreen context to draw at the higher resolution.
        offCtx.scale(RESOLUTION_MULTIPLIER, RESOLUTION_MULTIPLIER);
        // Translate the offscreen context so drawing happens relative to the bounding box.
        offCtx.translate(-bbox.minX, -bbox.minY);
    
        // 1. Draw solid hull and deck layers onto the offscreen canvas.
        this._drawHull(offCtx, spardeck.hull, this.primaryHullColor);
        this._drawHull(offCtx, spardeck.deck, this.deckColor);
    
        // 2. Cut the gangway hole from the offscreen canvas.
        offCtx.globalCompositeOperation = 'destination-out';
        const scaledCutout = spardeck.gangwayCutout;
        offCtx.beginPath();
        scaledCutout.forEach((p, i) => (i === 0) ? offCtx.moveTo(p.x, p.y) : offCtx.lineTo(p.x, p.y));
        offCtx.closePath();
        offCtx.fill();
        offCtx.globalCompositeOperation = 'source-over'; // Reset
    
        // 3. Draw the planks, using a clipping mask that respects the cutout.
        const scaledSparDeck = spardeck.deck;
        offCtx.save();
        offCtx.beginPath();
        scaledSparDeck.forEach((p, i) => (i === 0) ? offCtx.moveTo(p.x, p.y) : offCtx.lineTo(p.x, p.y));
        offCtx.closePath();
        scaledCutout.reverse(); // Ensure winding is opposite for the hole
        scaledCutout.forEach((p, i) => (i === 0) ? offCtx.moveTo(p.x, p.y) : offCtx.lineTo(p.x, p.y));
        offCtx.closePath();
        offCtx.clip('evenodd');
        this._drawDeckPlanks(offCtx, this.deckPlankCache.spardeck, this.deckPlankColor);
        offCtx.restore();
    
        // 4. Draw the completed offscreen canvas to the main context.
        // By specifying the original width/height, we let the browser downscale the hi-res image smoothly.
        ctx.drawImage(offscreenCanvas, bbox.minX, bbox.minY, width, height);
    
        // 4. Draw the remaining superstructure components.
        this._drawBulwark(ctx, spardeck.bulwark, spardeck.bulwarkCutout);
        const spardeckCannons = spardeck.cannons || [];
        this._drawBulwarkTopWithGunports(ctx, spardeck.bulwark, spardeck.bulwarkCutout, spardeckCannons.filter(c => c.side === 'port' || c.side === 'starboard'));
        this._drawCannons(ctx, spardeckCannons);
        this._drawBulwarkRail(ctx, spardeck.bulwarkRailOuter, spardeck.bulwarkRailInner);
    
        // Draw the forward lateral rail.
        if (spardeck.forwardRail) {
            this._drawHull(ctx, spardeck.forwardRail, this.bulwarkRailColor);
        }
    
        // Draw the gangway rails around the new hole.
        if (spardeck.gangwayRails) {
            this._drawBulwarkRail(ctx, spardeck.gangwayRails.outer, spardeck.gangwayRails.inner);
        }
    }

    /**
     * New: Draws the Mid Deckhouse.
     * @private
     */
    _drawMidDeckhouse(ctx) {
        const deckhouse = this.blueprint.geometry.midDeckhouse;
        const x = 0; // Center of the ship
        const y = 0; // Center of the ship

        // Helper function to draw a rectangle.
        const drawRect = (rect, color) => {
            ctx.fillStyle = color;
            const scaledLength = rect.length;
            const scaledWidth = rect.width;
            ctx.fillRect(x - scaledLength / 2, y - scaledWidth / 2, scaledLength, scaledWidth);
        };

        // 1. Draw the outer rectangle with the primary hull color.
        drawRect(deckhouse.outer, this.primaryHullColor);

        // 2. Draw the inner rectangle with the lighter hull color.
        drawRect(deckhouse.inner, this.lighterHullColor);

        // 3. Draw the plank lines on the inner rectangle with the primary hull color.
        const innerRect = deckhouse.inner;
        const scaledInnerLength = innerRect.length;
        const scaledInnerWidth = innerRect.width;
        this._drawDeckPlanks(ctx, this.deckPlankCache.midDeckhouse, this.primaryHullColor);

        // 4. Draw the central beam on top of everything else.
        drawRect(deckhouse.beam, this.primaryHullColor);
    }

    /**
     * New: Draws the Fore Deckhouse.
     * @private
     */
    _drawForeDeckhouse(ctx) {
        const deckhouse = this.blueprint.geometry.foreDeckhouse;

        // Calculate the center X position for the deckhouse.
        // The deckhouse is defined by startX and endX, so its center is (startX + endX) / 2.
        const centerX = (deckhouse.outer.startX + deckhouse.outer.endX) / 2;
        const y = 0; // Center of the ship for Y-axis

        // Helper function to draw a rectangle.
        const drawRect = (rect, color) => {
            ctx.fillStyle = color;
            const scaledLength = rect.length;
            const scaledWidth = rect.width;
            // Draw centered around centerX
            ctx.fillRect(centerX - scaledLength / 2, y - scaledWidth / 2, scaledLength, scaledWidth);
        };

        // 1. Draw the outer rectangle with the primary hull color.
        drawRect(deckhouse.outer, this.primaryHullColor);

        // 2. Draw the inner rectangle with the lighter hull color.
        drawRect(deckhouse.inner, this.lighterHullColor);

        // 3. Draw the plank lines on the inner rectangle with the primary hull color.
        const innerRect = deckhouse.inner;
        const scaledInnerLength = innerRect.length;
        const scaledInnerWidth = innerRect.width;
        this._drawDeckPlanks(ctx, this.deckPlankCache.foreDeckhouse, this.primaryHullColor);

        // 4. Draw the central beam on top of everything else.
        drawRect(deckhouse.beam, this.primaryHullColor);
    }

    /**
     * New: Draws the Aft Deckhouse.
     * @private
     */
    _drawAftDeckhouse(ctx) {
        const deckhouse = this.blueprint.geometry.aftDeckhouse;

        // Calculate the center X position for the deckhouse.
        const centerX = (deckhouse.outer.startX + deckhouse.outer.endX) / 2;
        const y = 0; // Center of the ship for Y-axis

        // Helper function to draw a rectangle.
        const drawRect = (rect, color) => {
            ctx.fillStyle = color;
            const scaledLength = rect.length;
            const scaledWidth = rect.width;
            // Draw centered around centerX
            ctx.fillRect(centerX - scaledLength / 2, y - scaledWidth / 2, scaledLength, scaledWidth);
        };

        // 1. Draw the outer rectangle with the primary hull color.
        drawRect(deckhouse.outer, this.primaryHullColor);

        // 2. Draw the inner rectangle with the lighter hull color.
        drawRect(deckhouse.inner, this.lighterHullColor);

        // 3. Draw the plank lines on the inner rectangle with the primary hull color.
        const innerRect = deckhouse.inner;
        const scaledInnerLength = innerRect.length;
        const scaledInnerWidth = innerRect.width;
        this._drawDeckPlanks(ctx, this.deckPlankCache.aftDeckhouse, this.primaryHullColor);

        // 4. Draw the central beam on top of everything else.
        drawRect(deckhouse.beam, this.primaryHullColor);
    }

    /**
     * New: Draws the Stern Cabin, which is a hybrid of a castle and a deckhouse.
     * @private
     */
    _drawSternCabin(ctx) {
        const cabin = this.blueprint.geometry.sternCabin;
        if (!cabin) return;

        // 1. Stern Cabin Base (like a castle's hull)
        this._drawHull(ctx, cabin.hull, this.primaryHullColor);

        // 2. Stern Cabin Top (like a deckhouse's deck)
        this._drawHull(ctx, cabin.deck, this.lighterHullColor);
        this._drawDeckPlanks(ctx, 
            this.deckPlankCache.sternCabin,
            this.primaryHullColor,
        );

        // 3. Stern Cabin Boundary (the bulwark, drawn as a border)
        ctx.fillStyle = this.primaryHullColor; // Use the main hull color as requested.
        ctx.beginPath();
        cabin.bulwark.forEach((p, i) => (i === 0) ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        const scaledInnerBulwark = [...cabin.bulwarkCutout].reverse();
        scaledInnerBulwark.forEach((p, i) => (i === 0) ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill('evenodd');

        // 4. Stern Cabin Beam (like a deckhouse's beam)
        const beam = cabin.beam;
        if (beam) {
            const centerX = (beam.startX + beam.endX) / 2;
            const scaledLength = beam.length;
            const scaledWidth = beam.width;
            ctx.fillStyle = this.primaryHullColor;
            ctx.fillRect(centerX - scaledLength / 2, 0 - scaledWidth / 2, scaledLength, scaledWidth);
        }

        // 5. Draw the Forward Boundary rail on top of everything else.
        if (cabin.forwardBoundary) {
            this._drawHull(ctx, cabin.forwardBoundary, this.primaryHullColor);
        }
    }

    /**
     * New: Draws the cannons for a specific tier.
     * @private
     */
    _drawCannons(ctx, tier) {
        const cannonsForTier = typeof tier === 'number'
            ? this.blueprint.layout?.cannonLayouts?.[tier]
            : tier;

        if (!cannonsForTier || cannonsForTier.length === 0) {
            return;
        }

        const desiredCarriageWidth = CANNON_UNIT_SIZE;
        cannonsForTier.forEach(cannon => {
            // --- NEW: Check for destruction ---
            if (!cannon.destroyed) {
                this._drawBlueprintCannon(ctx, cannon.x, cannon.y, desiredCarriageWidth, cannon.angle);
            }
        });
    }

    /**
     * New: Initializes the rig objects based on the ship's blueprint.
     * This is the bridge between the blueprint and the drawable rig components.
     * @private
     */
    _initializeRigs() {
        this.rigs = []; // Clear any existing rigs
        if (!this.blueprint.layout || !this.blueprint.layout.masts) return;

        const { rigType, masts } = this.blueprint.layout;

        if (rigType === 'sloop') {
            // A sloop rig is a single, complex entity. It uses the main mast's position.
            const mainMast = masts.find(m => m.type === 'main');
            if (mainMast) {
                this.rigs.push(new SloopRig(this, mainMast));
            }
        } else if (rigType === 'fore-and-aft-sloop') {
            const mainMast = masts.find(m => m.type === 'main');
            if (mainMast) {
                this.rigs.push(new ForeAndAftSloopRig(this, mainMast));
            }
        } else if (rigType === 'brig') {
            // A brig rig manages all its masts as a single entity.
            // We pass the entire masts array to its constructor.
            this.rigs.push(new BrigRig(masts, this.shipLength, this.shipWidth, this));
        } else if (rigType === 'full-rigged') {
            // A full-rigged ship also manages all its masts as a single entity.
            this.rigs.push(new FullRiggedShipRig(this, masts));
        } else if (rigType === 'schooner') {
            this.rigs.push(new SchoonerRig(this, masts));
        } else if (rigType === 'brigantine') {
            this.rigs.push(new BrigantineRig(this, masts));
        } else if (rigType === 'three-mast-schooner') {
            this.rigs.push(new ThreeMastSchoonerRig(this, masts));
        } else if (rigType === 'barque') {
            this.rigs.push(new BarqueRig(this, masts));
        } else if (rigType === 'barquentine') {
            this.rigs.push(new BarquentineRig(this, masts));
        } else if (rigType === 'square') {
            // For a square-rigged ship, each mast gets its own simple SquareRig object.
            masts.forEach(mastConfig => {
                this.rigs.push(new SquareRig(this, mastConfig));
            });
        }
    }

    /**
     * A dedicated method for drawing cannons based on the ship's blueprint.
     * This is a copy of the BaseShip._drawDetailedCannon, but simplified to remove
     * any logic that is not relevant to the procedurally generated layout.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} x - The local X position, NOT pre-scaled.
     * @param {number} y - The local Y position, NOT pre-scaled.
     * @param {number} desiredCarriageWidth - The target width for the cannon carriage in world units.
     * @param {number} rotation - The rotation in radians.
     * @param {number} zoomLevel - The current game zoom level for scaling strokes.
     * @private
     */
    _drawBlueprintCannon(ctx, x, y, desiredCarriageWidth, rotation) {
        // --- Base Dimensions from SVG (for ratio calculations) ---
        const carriageBaseLength_svg = 314; // This is the cannon's length (barrel direction)
        const carriageBaseWidth_svg = 166;

        // --- FIX: Scale based on the desired WIDTH on the deck, not length. ---
        // This makes it consistent with the default ship's cannon drawing.
        const scale = desiredCarriageWidth / carriageBaseWidth_svg;
        const finalLength = carriageBaseLength_svg * scale; // Length is now proportional to width
        const finalHeight = desiredCarriageWidth;

        ctx.save();
        // The context is already translated and rotated to the ship's position and angle.
        // We just need to apply the cannon's local transformations.
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // To align the front edge of the carriage with the bulwark line, we must:
        // 1. Shift the drawing origin backward by the carriage's full length.
        // 2. Shift the drawing origin "up" by half the carriage's height to center it.
        ctx.translate(-finalLength, -finalHeight / 2);

        // --- Carriage Base ---
        const rectX = 0;
        const rectY = 0;
        ctx.beginPath();
        ctx.rect(rectX, rectY, finalLength, finalHeight);

        const carriageFill = 'rgb(132, 125, 97)';
        ctx.fillStyle = carriageFill;
        ctx.fill();

        // --- Inner Stroke via Clipping ---
        const carriageStroke = darkenColor(carriageFill, 20);
        const carriageStrokeWidth = (finalHeight / 50) * 2;
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // --- Carriage Cheeks ---
        const cheekWidth = finalLength;
        const cheekHeight = finalHeight * (1 / 5);

        // Top Cheek
        ctx.save();
        ctx.beginPath();
        ctx.rect(rectX, rectY, cheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Bottom Cheek
        ctx.beginPath();
        ctx.rect(rectX, rectY + finalHeight - cheekHeight, cheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // --- Layered Cheeks ---
        const shorterCheekWidth = finalLength - (finalLength / 6);
        const shorterCheekX = rectX + finalLength - shorterCheekWidth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(shorterCheekX, rectY, shorterCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.rect(shorterCheekX, rectY + finalHeight - cheekHeight, shorterCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        const evenShorterCheekWidth = finalLength - (finalLength * 2 / 6);
        const evenShorterCheekX = rectX + finalLength - evenShorterCheekWidth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(evenShorterCheekX, rectY, evenShorterCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.rect(evenShorterCheekX, rectY + finalHeight - cheekHeight, evenShorterCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        const thirdLayerCheekWidth = finalLength - (finalLength * 3 / 6);
        const thirdLayerCheekX = rectX + finalLength - thirdLayerCheekWidth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(thirdLayerCheekX, rectY, thirdLayerCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.rect(thirdLayerCheekX, rectY + finalHeight - cheekHeight, thirdLayerCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // --- Barrel Area ---
        const barrelBoxLength = finalLength * (5 / 3);
        const barrelBoxWidth = finalHeight * (1 / 2);
        const barrelBoxX = rectX;
        const barrelBoxY = rectY + (finalHeight / 2) - (barrelBoxWidth / 2);
        const barrelFill = 'rgb(38, 38, 38)';
        const barrelStroke = darkenColor(barrelFill, 20);
        const barrelStrokeWidth = (finalHeight / 50) * 2;

        // Trunnion, Rimbase, Cascabel, Chase, Muzzle, etc. (All barrel drawing logic is identical)
        // ... (The rest of the barrel drawing code from _drawDetailedCannon is copied here)
        // Trunnion
        const trunnionLength = barrelBoxLength * (1 / 15);
        const trunnionWidth = finalHeight;
        const cornerRadius = trunnionLength * 0.25;
        const trunnionX = barrelBoxX + (barrelBoxLength / 2) - (trunnionLength / 2);
        const trunnionY = rectY;
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.roundRect(trunnionX, trunnionY, trunnionLength, trunnionWidth, cornerRadius);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Trunnion Plates
        const trunnionPlateLength = finalLength * (1 / 3);
        const trunnionPlateWidth = cheekHeight * 0.8;
        const trunnionPlateCornerRadius = trunnionPlateLength * 0.05;
        const trunnionPlateX = trunnionX + (trunnionLength / 2) - (trunnionPlateLength / 2);
        const plateGradient = ctx.createLinearGradient(trunnionPlateX, 0, trunnionPlateX + trunnionPlateLength, 0);
        plateGradient.addColorStop(0, '#4D4D4D');
        plateGradient.addColorStop(0.25, '#333333');
        plateGradient.addColorStop(0.5, '#666666');
        plateGradient.addColorStop(0.75, '#333333');
        plateGradient.addColorStop(1, '#4D4D4D');
        const bottomCheekCenterY = (rectY + finalHeight - cheekHeight) + (cheekHeight / 2);
        const bottomTrunnionPlateY = bottomCheekCenterY - (trunnionPlateWidth / 2);
        ctx.save();
        ctx.fillStyle = plateGradient;
        ctx.beginPath();
        ctx.roundRect(trunnionPlateX, bottomTrunnionPlateY, trunnionPlateLength, trunnionPlateWidth, trunnionPlateCornerRadius);
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();
        const topCheekCenterY = rectY + (cheekHeight / 2);
        const topTrunnionPlateY = topCheekCenterY - (trunnionPlateWidth / 2);
        ctx.save();
        ctx.fillStyle = plateGradient;
        ctx.beginPath();
        ctx.roundRect(trunnionPlateX, topTrunnionPlateY, trunnionPlateLength, trunnionPlateWidth, trunnionPlateCornerRadius);
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Rimbase
        const rimbaseLength = barrelBoxLength * (1 / 10);
        const rimbaseX = barrelBoxX + (barrelBoxLength / 2) - (rimbaseLength / 2);
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.rect(rimbaseX, barrelBoxY, rimbaseLength, barrelBoxWidth);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();
        
        // Trunnion Plates, Cascabel, Breech, etc. are all part of the detailed drawing.
        // The following is the complete, restored drawing logic for the barrel.

        // Cascabel Knob
        const knobRadius = (barrelBoxWidth * (2 / 5)) / 2;
        const knobCenterX = barrelBoxX + knobRadius;
        const knobCenterY = barrelBoxY + (barrelBoxWidth / 2);
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.arc(knobCenterX, knobCenterY, knobRadius, Math.PI / 2, -Math.PI / 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Cascabel Neck
        const neckLength = knobRadius;
        const neckWidth = knobRadius * 2;
        const neckX = knobCenterX;
        const neckY = knobCenterY - (neckWidth / 2);
        const curveAmount = neckWidth * 0.2;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.moveTo(neckX, neckY);
        ctx.quadraticCurveTo(neckX + neckLength / 2, neckY + curveAmount, neckX + neckLength, neckY);
        ctx.lineTo(neckX + neckLength, neckY + neckWidth);
        ctx.quadraticCurveTo(neckX + neckLength / 2, neckY + neckWidth - curveAmount, neckX, neckY + neckWidth);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Breech
        const breechLength = knobRadius;
        const breechX = neckX + neckLength;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.moveTo(breechX + breechLength, barrelBoxY);
        ctx.quadraticCurveTo(breechX + breechLength / 2, barrelBoxY, breechX, neckY);
        ctx.lineTo(breechX, neckY + neckWidth);
        ctx.quadraticCurveTo(breechX + breechLength / 2, barrelBoxY + barrelBoxWidth, breechX + breechLength, barrelBoxY + barrelBoxWidth);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Chase
        const chaseLength = barrelBoxLength * 0.8;
        const chaseFrontWidth = barrelBoxWidth * 0.8;
        const chaseX = breechX + breechLength;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.moveTo(chaseX, barrelBoxY);
        ctx.lineTo(chaseX + chaseLength, barrelBoxY + (barrelBoxWidth - chaseFrontWidth) / 2);
        ctx.lineTo(chaseX + chaseLength, barrelBoxY + barrelBoxWidth - (barrelBoxWidth - chaseFrontWidth) / 2);
        ctx.lineTo(chaseX, barrelBoxY + barrelBoxWidth);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Vent Field & Touch Hole
        const ventFieldWidth = barrelBoxWidth * (1 / 10);
        const ventFieldLength = barrelBoxLength * (1 / 12);
        const ventFieldX = chaseX;
        const ventFieldY = barrelBoxY + (barrelBoxWidth / 2) - (ventFieldWidth / 2);
        const ventFieldSemiCircleRadius = ventFieldWidth / 2;
        const ventFieldRectPartLength = ventFieldLength - ventFieldSemiCircleRadius;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.arc(ventFieldX + ventFieldRectPartLength, ventFieldY + ventFieldSemiCircleRadius, ventFieldSemiCircleRadius, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(ventFieldX, ventFieldY + ventFieldWidth);
        ctx.lineTo(ventFieldX, ventFieldY);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        const touchHoleBaseRadius = ventFieldWidth;
        const touchHoleBaseCenterX = ventFieldX + ventFieldLength / 2;
        const touchHoleBaseCenterY = ventFieldY + ventFieldWidth / 2;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.arc(touchHoleBaseCenterX, touchHoleBaseCenterY, touchHoleBaseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        const touchHoleRadius = touchHoleBaseRadius / 2;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.arc(touchHoleBaseCenterX, touchHoleBaseCenterY, touchHoleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Muzzle Swell
        const muzzleSwellLength = barrelBoxLength * (1 / 12);
        const muzzleSwellEndWidth = barrelBoxWidth * 0.9;
        const muzzleSwellX = chaseX + chaseLength;
        const muzzleSwellY = barrelBoxY + (barrelBoxWidth - chaseFrontWidth) / 2;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.moveTo(muzzleSwellX, muzzleSwellY);
        ctx.lineTo(muzzleSwellX + muzzleSwellLength, muzzleSwellY - (muzzleSwellEndWidth - chaseFrontWidth) / 2);
        ctx.lineTo(muzzleSwellX + muzzleSwellLength, muzzleSwellY + chaseFrontWidth + (muzzleSwellEndWidth - chaseFrontWidth) / 2);
        ctx.lineTo(muzzleSwellX, muzzleSwellY + chaseFrontWidth);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        // Muzzle Face
        const muzzleFaceLength = barrelBoxLength * (1 / 60);
        const muzzleFaceEndWidth = barrelBoxWidth * 0.8;
        const muzzleFaceX = muzzleSwellX + muzzleSwellLength;
        const muzzleFaceY = muzzleSwellY - (muzzleSwellEndWidth - chaseFrontWidth) / 2;
        ctx.save();
        ctx.fillStyle = barrelFill;
        ctx.beginPath();
        ctx.moveTo(muzzleFaceX, muzzleFaceY);
        ctx.lineTo(muzzleFaceX + muzzleFaceLength, muzzleFaceY + (muzzleSwellEndWidth - muzzleFaceEndWidth) / 2);
        ctx.lineTo(muzzleFaceX + muzzleFaceLength, muzzleFaceY + muzzleSwellEndWidth - (muzzleSwellEndWidth - muzzleFaceEndWidth) / 2);
        ctx.lineTo(muzzleFaceX, muzzleFaceY + muzzleSwellEndWidth);
        ctx.closePath();
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = barrelStroke;
        ctx.lineWidth = barrelStrokeWidth;
        ctx.stroke();
        ctx.restore();

        ctx.restore(); // Restore from the initial translation/rotation
    }

    /**
     * New: Draws the pennant and mast-top for a given mast.
     * This method now lives in CustomShip as it's the central drawing authority.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {object} mastConfig - The configuration for the mast to draw.
     * @private
     */
    _drawMastTopAssembly(ctx, mastConfig) {
        ctx.save();
        ctx.translate(mastConfig.x, mastConfig.y);
        this._drawPennantAndMastTop(ctx);
        ctx.restore();
    }

    /**
     * New: Draws just the pennant and mast-top.
     * This is a self-contained copy to avoid context issues with helper classes.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @private
     */
    _drawPennantAndMastTop(ctx) {
        ctx.save();
        ctx.rotate(this.pennantCurrentRelativeAngle);

        // --- NEW: Surrender Flag Logic ---
        if (this.aiState === 'surrendered') {
            const flagWidth = this.pennantWidth * 4;
            const flagLength = flagWidth * 2; // 2:1 Ratio
            
            // Calculate start X based on 45 degree bridle lines
            // tan(45) = 1, so x dist = y dist (half width)
            const bridleLengthX = flagWidth / 2;
            const startX = -bridleLengthX;
            
            // Draw Bridle (Lines connecting mast to flag)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(startX, -flagWidth / 2);
            ctx.moveTo(0, 0);
            ctx.lineTo(startX, flagWidth / 2);
            ctx.strokeStyle = '#DDDDDD'; // Light grey rope
            ctx.lineWidth = 1;
            ctx.stroke();

            // Generate Flag Points with Wave
            const numPoints = 10;
            const waveAmplitude = this.pennantWaveAmplitude;
            const waveFrequency = this.pennantWaveFrequency;
            const waveOffset = this.pennantWaveOffset;

            // Draw Flag
            ctx.fillStyle = '#FFFFFF'; // White
            ctx.beginPath();
            
            // Helper to calculate wave Y
            const getWaveY = (x) => {
                const wavePhase = (x / this.pennantLength * waveFrequency * Math.PI * 2) + waveOffset;
                return Math.sin(wavePhase) * waveAmplitude;
            };

            // Top edge
            for (let i = 0; i <= numPoints; i++) {
                const ratio = i / numPoints;
                const currentX = startX - (flagLength * ratio);
                const y = -flagWidth / 2 + getWaveY(currentX);
                if (i === 0) ctx.moveTo(currentX, y);
                else ctx.lineTo(currentX, y);
            }

            // Tattered Edge (Far end)
            const lastX = startX - flagLength;
            const lastWaveY = getWaveY(lastX);
            const lastTopY = -flagWidth / 2 + lastWaveY;
            const lastBottomY = flagWidth / 2 + lastWaveY;
            const tatters = CustomShip.getSurrenderFlagTatters();
            
            for (let i = 0; i < tatters.length; i++) {
                const t = tatters[i];
                // Interpolate Y between lastTop and lastBottom
                const y = lastTopY + (lastBottomY - lastTopY) * t.y;
                // Indent X (positive relative to the negative end X means moving back towards mast)
                const x = lastX + (t.indent * flagLength * 0.15); 
                ctx.lineTo(x, y);
            }

            // Bottom edge (reverse)
            for (let i = numPoints; i >= 0; i--) {
                const ratio = i / numPoints;
                const currentX = startX - (flagLength * ratio);
                const y = flagWidth / 2 + getWaveY(currentX);
                ctx.lineTo(currentX, y);
            }
            
            ctx.closePath();

            // --- NEW: Shadow for visibility (Optimized) ---
            // Instead of expensive shadowBlur, we draw a manual offset shadow.
            ctx.save();
            ctx.translate(2, 2); // Offset the shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fill();
            ctx.restore();

            // Draw Main Flag Body
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            
            // Stroke
            ctx.strokeStyle = '#CCCCCC'; // Light grey outline
            ctx.lineWidth = 1;
            ctx.stroke();

        } else {
            // --- Standard Pennant Logic ---
            const pennantBaseWidth = this.pennantWidth;
            const pennantActualLength = this.pennantLength;
            const numWavePoints = 10;
            const waveAmplitude = this.pennantWaveAmplitude;
            const waveFrequency = this.pennantWaveFrequency;
            const waveOffset = this.pennantWaveOffset;

            ctx.fillStyle = this.pennantColor;
            ctx.beginPath();

            // Top Edge
            ctx.moveTo(0, -pennantBaseWidth / 2);
            for (let i = 1; i <= numWavePoints; i++) {
                const ratio = i / numWavePoints;
                const currentX = -pennantActualLength * ratio;
                const currentSegmentWidth = pennantBaseWidth * (1 - ratio);
                const waveY = Math.sin((currentX / pennantActualLength * waveFrequency * Math.PI * 2) + waveOffset) * waveAmplitude * (1 - ratio * 0.5);
                ctx.lineTo(currentX, -currentSegmentWidth / 2 + waveY);
            }
            ctx.lineTo(-pennantActualLength, 0);

            // Bottom Edge (Reverse)
            for (let i = numWavePoints; i >= 1; i--) {
                const ratio = i / numWavePoints;
                const currentX = -pennantActualLength * ratio;
                const currentSegmentWidth = pennantBaseWidth * (1 - ratio);
                const waveY = Math.sin((currentX / pennantActualLength * waveFrequency * Math.PI * 2) + waveOffset) * waveAmplitude * (1 - ratio * 0.5);
                ctx.lineTo(currentX, currentSegmentWidth / 2 + waveY);
            }
            ctx.lineTo(0, pennantBaseWidth / 2);

            ctx.closePath();
            ctx.fill();

            // --- FIX: Add the missing stroke for the pennant ---
            ctx.save();
            ctx.clip(); // Use the same path to clip the stroke
            ctx.strokeStyle = darkenColor(this.pennantColor, 20); // 20% darker for consistency
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();

        // Draw Mast Top (over the pennant)
        ctx.fillStyle = this.mastTopColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.mastTopRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Calculates the minimum sailing crew based on the ship's blueprint.
     * Used to determine when turning penalties apply.
     * @returns {number}
     * @private
     */
    _calculateMinSailingCrew() {
        if (!this.blueprint) return 5; // Default fallback

        const { dimensions, layout } = this.blueprint;
        const { length, width } = dimensions;
        const rigType = layout.rigType;

        let squareSailCrewValue = 0;
        let foreAndAftCrewValue = 0;

        const addCrewForSail = (estimatedLongestDim, type) => {
            const dimInUnits = estimatedLongestDim / CARGO_UNIT_SIZE;
            if (type === 'square') {
                squareSailCrewValue += dimInUnits / 5;
            } else { // fore-and-aft
                foreAndAftCrewValue += dimInUnits / 10;
            }
        };

        // Estimate sails based on rig type (Logic mirrors main.js stats)
        switch (rigType) {
            case 'sloop':
            case 'fore-and-aft-sloop':
                addCrewForSail(length * 0.6, 'fore-and-aft');
                addCrewForSail(length * 0.5, 'fore-and-aft');
                break;
            case 'schooner':
                addCrewForSail(length * 0.5, 'fore-and-aft');
                addCrewForSail(length * 0.45, 'fore-and-aft');
                addCrewForSail(length * 0.4, 'fore-and-aft');
                break;
            case 'square':
                addCrewForSail(width * 1.8, 'square');
                addCrewForSail(width * 1.4, 'square');
                break;
            case 'brig':
            case 'brigantine':
                addCrewForSail(width * 1.8, 'square');
                addCrewForSail(width * 1.5, 'square');
                addCrewForSail(width * 1.6, 'square');
                addCrewForSail(width * 1.3, 'square');
                addCrewForSail(length * 0.3, 'fore-and-aft');
                break;
            case 'full-rigged':
            case 'barque':
            case 'barquentine':
            case 'three-mast-schooner':
                addCrewForSail(width * 1.8, 'square');
                addCrewForSail(width * 1.5, 'square');
                addCrewForSail(width * 1.6, 'square');
                addCrewForSail(width * 1.3, 'square');
                addCrewForSail(width * 1.4, 'square');
                addCrewForSail(length * 0.3, 'fore-and-aft');
                addCrewForSail(length * 0.3, 'fore-and-aft');
                break;
        }

        // Ensure at least 1 crew member is required
        const minSailingCrew = Math.max(1, Math.floor(squareSailCrewValue + foreAndAftCrewValue));
        return minSailingCrew;
    }
}