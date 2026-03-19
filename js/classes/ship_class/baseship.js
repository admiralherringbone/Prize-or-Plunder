// --- Constants ---
const SINK_RING_VARIATIONS = [
    { len: 0.65, ratio: 4 }, // Standard
    { len: 0.85, ratio: 6 }, // Long & Thin
    { len: 0.50, ratio: 2 }, // Short & Fat
    { len: 0.75, ratio: 5 }, // Medium-Long
    { len: 0.60, ratio: 3 }  // Medium-Short
];

// --- OPTIMIZATION: Wake Point Pooling & Shared Arrays ---
const wakePointPool = [];
function getWakePoint(x, y, vx, vy, width = 1.0) {
    if (wakePointPool.length > 0) {
        const p = wakePointPool.pop();
        p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.width = width;
        return p;
    }
    return { x, y, vx, vy, width };
}
function releaseWakePoint(p) {
    wakePointPool.push(p);
}

// --- OPTIMIZATION: Particle Pooling ---
const smokeParticlePool = [];
function getSmokeParticle() {
    if (smokeParticlePool.length > 0) return smokeParticlePool.pop();
    return {};
}
function releaseSmokeParticle(p) {
    smokeParticlePool.push(p);
}

const sinkParticlePool = [];
function getSinkParticle() {
    if (sinkParticlePool.length > 0) return sinkParticlePool.pop();
    return {};
}
function releaseSinkParticle(p) {
    sinkParticlePool.push(p);
}

const fireParticlePool = [];
function getFireParticle() {
    if (fireParticlePool.length > 0) return fireParticlePool.pop();
    return {};
}
function releaseFireParticle(p) {
    fireParticlePool.push(p);
}

const WAKE_MAX_POINTS = 64; // Sufficient for history length (40)
const wakeLeftX = new Float32Array(WAKE_MAX_POINTS);
const wakeLeftY = new Float32Array(WAKE_MAX_POINTS);
const wakeRightX = new Float32Array(WAKE_MAX_POINTS);
const wakeRightY = new Float32Array(WAKE_MAX_POINTS);

const tempSinkPoint = { x: 0, y: 0 }; // Reusable point for sinking calculations

/**
 * Represents the base class for all ships in the game.
 * It contains all the common properties and methods for physics, drawing, and core actions.
 * This class is intended to be extended by more specific classes like PlayerShip and NpcShip.
 */
class Ship {
    /**
     * @param {number} x - The initial X position in the world.
     * @param {number} y - The initial Y position in the world.
     * @param {string} color - The color of the ship's hull.
     * @param {number} hp - The maximum and initial health points.
     * @param {number} baseSpeed - The base speed of the ship.
     * @param {number} maneuverability - A multiplier for turning speed.
     * @param {object} [options={}] - An object for optional parameters like pennantColor and sailColor.
     */
    constructor(x, y, color, hp, baseSpeed, maneuverability, options = {}) {
        const {
            pennantColor = PENNANT_COLOR,
            sailColor = 'hsl(0, 0%, 95%)', // Default to white to match Player
            // --- FIX: Correctly destructure and use the reloadTime from options. ---
            reloadTime = PLAYER_CANNON_RELOAD_TIME_MS,
            skipCache = false // --- OPTIMIZATION: Option to skip canvas caching ---
        } = options;
        this.skipCache = skipCache;
        // --- Core Physics & Position ---
        this.x = x;
        this.y = y;
        this.vx = 0; // velocity x
        this.vy = 0; // velocity y
        this.angle = 0; // current angle in radians
        this.lastAngle = 0; // angle in the previous frame (for turn rate calc)
        this.currentTurnRate = 0; // --- NEW: Store turn rate for rendering ---
        this.wakeHistory = [[], [], [], []]; // --- NEW: Trail history [PortBow, StbdBow, PortStern, StbdStern] ---
        this.friction = 0.99; // Factor to reduce velocity each frame

        // --- Core Attributes ---
        this.baseSpeed = baseSpeed;
        this._color = color; // Internal storage for hull color
        this.maneuverability = maneuverability;
        this.hp = hp;
        // --- New: Rigging HP ---
        this.rigHp = 10; // Default value, will be overridden by subclasses.
        this.maxRigHp = 10;
        this.maxHp = hp;
        // --- New: Crew Stats ---
        this.crew = 20; // Default crew, overridden by subclasses/blueprints
        this.maxCrew = 20;
        this.minSailingCrew = 5; // Default minimum sailing crew for base ships
        this.recoveringCrew = 0; // Crew that successfully boarded and are returning
        this.crewRecoveryAccumulator = 0; // Timer for crew recovery

        this.shipLength = SHIP_TARGET_LENGTH;
        this.shipWidth = SHIP_TARGET_WIDTH;

        // --- Visual & Collision Shapes (pre-calculated in config.js) ---
        this.hullBaseVisualPoints = SHIP_HULL_BASE_VISUAL_POLYGON;
        this.deckVisualPoints = SHIP_DECK_VISUAL_POLYGON;
        this.bulwarkVisualPoints = SHIP_BULWARK_VISUAL_POLYGON;
        this.bulwarkInnerCutoutVisualPoints = SHIP_BULWARK_INNER_CUTOUT_VISUAL_POLYGON;
        this.collisionPoints = SHIP_HULL_BASE_COLLISION_POLYGON;
        this.points = this.collisionPoints; // Alias for collision system
        this.convexParts = triangulatePolygon(this.collisionPoints);

        // --- OPTIMIZATION: Pre-allocate transformed points to avoid GC ---
        this.transformedPoints = [];
        this._aabbDirty = true; // --- OPTIMIZATION: Dirty flag for AABB ---
        this.aabb = { minX: 0, minY: 0, maxX: 0, maxY: 0 }; // Pre-allocate AABB

        // --- OPTIMIZATION: Transform Cache State ---
        this._transformCache = {
            x: null,
            y: null,
            angle: null
        };

        // --- Component & State Properties ---
        this.lastDamageTime = -Infinity; // Timestamp of last damage taken
        this.obstacleContactTimers = new Map();
        this.isOverShoal = false;
        this.isOverCoralReef = false;
        this.islandCollisionNormal = null; // New: Stores the normal vector of the island collision.
        this.isAgainstIsland = false; // New: Flag for when the ship is colliding with an island.
        this.daysStarving = 0; // New: Tracks how many days the crew has gone without full rations.

        this._initializeShipComponents(sailColor, pennantColor);
        this.hullStrokeColor = darkenColor(this._color, 10); // 10% darker for the hull outline, making it lighter
        this.sailStrokeColor = darkenColor(this._sailColor, 40); // 40% darker for the outline

        // --- Anchor ---
        this.isAnchored = false;
        this.anchorPoint = null;
        this.anchorLineMaxDistance = 0;
        this.effectiveAnchorLineLength = 0;
        this.anchorPulseScale = 1.0;
        this.anchorPulseDirection = 1;
        this.anchorPulseSpeed = 0.008;

        this.isReefed = false; // New: State for reefed sails
        // --- Cannons ---
        this.portCannonReloadTime = 0;
        this.starboardCannonReloadTime = 0;
        this.bowCannonReloadTime = 0;
        this.sternCannonReloadTime = 0;
        this.lastPortFireTime = 0;
        this.lastStarboardFireTime = 0;
        this.lastBowFireTime = 0;
        this.lastSternFireTime = 0;
        this.reloadTime = reloadTime; // Apply the reload time from options.

        // --- New: Caching for base ship drawing ---
        this.shipCacheCanvas = null;
        this.shipCacheOffset = { x: 0, y: 0 };
        
        // --- NEW: Tattered Sail State ---
        this.sailDamagePatterns = []; // Stores the geometry of potential holes
        this.sailCacheCanvas = null;  // Offscreen canvas for the tattered sail
        this.lastCachedRigHpPercent = 1.0; // Track when to refresh the cache

        // --- Sinking State ---
        this.isSinking = false;
        this.isSunk = false;
        this.sinkHp = 0;      // "Negative HP" that fills up
        this.maxSinkHp = 100; // Arbitrary duration units
        this.sinkAngle = 0;   // The angle the water comes from (relative to ship)

        this.sinkParticles = []; // New: Particles for sinking effect
        this.smokeParticles = []; // New: Particles for damage smoke
        this.fireParticles = []; // New: Particles for active fires
        this.sinkRings = []; // New: Agitated water rings for sinking effect
        this.ringSpawnTimer = 0; // New: Timer for consistent ring spawning
        this.repairAccumulator = 0; // New: Accumulator for fractional HP repair
        this.rigRepairAccumulator = 0; // New: Accumulator for fractional Rig HP repair
        this.wasInCooldown = false; // New: Track cooldown state for crew regen logic
        this.type = 'ship'; // Optimization for spatial grid checks
    }

    /**
     * Helper to get a shared offscreen canvas for sinking effects.
     * @returns {HTMLCanvasElement}
     */
    static getSharedSinkingCanvas() {
        if (!Ship._sharedSinkingCanvas) {
            Ship._sharedSinkingCanvas = document.createElement('canvas');
            Ship._sharedSinkingCanvas.width = 512;
            Ship._sharedSinkingCanvas.height = 512;
        }
        return Ship._sharedSinkingCanvas;
    }

    /**
     * Static helper to get (or create) a cached smoke texture.
     * @param {number} darkness - 0.0 (Light Grey) to 1.0 (Dark Charcoal).
     * @returns {HTMLCanvasElement}
     */
    static getSmokeTexture(darkness) {
        if (!Ship.smokeCache) Ship.smokeCache = [];
        
        // Quantize darkness to 10 levels (0-9) for caching
        const level = Math.floor(Math.max(0, Math.min(1, darkness)) * 9);
        
        if (!Ship.smokeCache[level]) {
            const size = 32;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            
            // Interpolate color: Light Grey (200) -> Black (0)
            const val = Math.floor(200 - (200 * (level / 9)));
            const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            grad.addColorStop(0, `rgba(${val},${val},${val}, 1)`);
            grad.addColorStop(1, `rgba(${val},${val},${val}, 0)`);
            ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
            Ship.smokeCache[level] = c;
        }
        return Ship.smokeCache[level];
    }

    /**
     * Static helper to get (or create) a cached fire texture.
     * @returns {HTMLCanvasElement}
     */
    static getFireTexture() {
        if (!Ship.fireTexture) {
            const size = 32;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            
            // Radial Gradient: White -> Yellow -> Orange -> Red -> Transparent
            const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(0.2, 'rgba(255, 255, 0, 1)');
            grad.addColorStop(0.4, 'rgba(255, 165, 0, 0.8)');
            grad.addColorStop(0.6, 'rgba(255, 0, 0, 0.5)');
            grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
            Ship.fireTexture = c;
        }
        return Ship.fireTexture;
    }

    /**
     * NEW: Static helper to get (or create) a cached cannon fire sprite.
     * @returns {HTMLCanvasElement}
     */
    static getCannonFireSprite() {
        if (!Ship.cannonFireSprite) {
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = 64;
            const ctx = c.getContext('2d');

            // Gradient from white/yellow at base to red/transparent at tip
            const grad = ctx.createLinearGradient(0, 0, 256, 0);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(0.1, 'rgba(255, 255, 200, 1)');
            grad.addColorStop(0.5, 'rgba(255, 150, 0, 0.8)');
            grad.addColorStop(1, 'rgba(255, 0, 0, 0)');

            ctx.fillStyle = grad;
            // Sharp pointed cone shape
            ctx.beginPath();
            ctx.moveTo(0, 0); // Base left
            ctx.lineTo(256, 32); // Tip
            ctx.lineTo(0, 64); // Base right
            ctx.closePath();
            ctx.fill();
            
            Ship.cannonFireSprite = c;
        }
        return Ship.cannonFireSprite;
    }

    /**
     * NEW: Static helper to get (or create) a cached cannon smoke sprite.
     * @returns {HTMLCanvasElement}
     */
    static getCannonSmokeSprite() {
        if (!Ship.cannonSmokeSprite) {
            const c = document.createElement('canvas');
            c.width = 64;
            c.height = 64;
            const ctx = c.getContext('2d');
            const center = 32;
            const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
            grad.addColorStop(0, 'rgba(200, 200, 200, 1)');
            grad.addColorStop(0.5, 'rgba(210, 210, 210, 0.5)');
            grad.addColorStop(1, 'rgba(220, 220, 220, 0)');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(center, center, center, 0, Math.PI * 2); ctx.fill(); Ship.cannonSmokeSprite = c;
        }
        return Ship.cannonSmokeSprite;
    }

    /**
     * Initializes or re-initializes all ship components that depend on the ship's dimensions.
     * This can be called by the constructor or by a subclass after changing dimensions.
     * @param {string} sailColor - The color for the sail.
     * @param {string} pennantColor - The color for the pennant.
     * @private
     */
    _initializeShipComponents(sailColor, pennantColor) {
        // --- Mast & Spar ---
        this.mastBaseRadius = this.shipWidth / 16;
        this.mastTopRadius = this.mastBaseRadius / 2;
        const sparThickness = this.mastBaseRadius;
        // The sail's length is double the ship's beam.
        const sailLength = this.shipWidth * 2;
        // The spar's length is 90% of the sail's length.
        const squareYardLength = sailLength * 0.9;
        this.mastTopColor = lightenColor(MAST_BASE_COLOR, 20); // Set a default value. CustomShip will override this.
        this.squareYardOffsetX = this.mastBaseRadius + (sparThickness / 2);
        this.squareYardOffsetY = 0;
        this.squareYardPoints = [
            { x: -sparThickness / 4, y: -squareYardLength / 2 },
            { x:  sparThickness / 4, y: -squareYardLength / 2 },
            { x:  sparThickness / 2, y: 0 },
            { x:  sparThickness / 4, y:  squareYardLength / 2 },
            { x: -sparThickness / 4, y:  squareYardLength / 2 },
            { x: -sparThickness / 2, y: 0 },
            { x:  sparThickness / 2, y: -squareYardLength / 4 },
            { x:  sparThickness / 2, y:  squareYardLength / 4 },
            { x: -sparThickness / 2, y:  squareYardLength / 4 },
            { x: -sparThickness / 2, y: -squareYardLength / 4 }
        ];

        // --- Sail ---
        const sailGameLengthY = sailLength; // Use the full sail length for generation.
        const sailGameWidthX = sailGameLengthY / 10;
        const sailResult = parseAndFlattenSvgPath(SAIL_SVG_DATA_CACHE, sailGameWidthX, sailGameLengthY, 20, true, true);
        this.sailVisualPoints = sailResult.points;
        this._sailColor = sailColor;
        this.sailOffsetX = this.squareYardOffsetX - sailResult.straightEdgeGameX;
        this.sailOffsetY = 0;
        this.sailCurrentRelativeAngle = 0;
        const sailMinY = Math.min(...this.sailVisualPoints.map(p => p.y));
        const sailMaxY = Math.max(...this.sailVisualPoints.map(p => p.y));
        this.sailHeight = sailMaxY - sailMinY;
        this.isSailOpen = true;

        // --- Pennant (Flag) ---
        const PENNANT_LENGTH_MULTIPLIER = 5;
        this._pennantColor = pennantColor;
        this.pennantWidth = this.mastTopRadius * 2;
        this.pennantLength = this.pennantWidth * PENNANT_LENGTH_MULTIPLIER;
        this.pennantCurrentRelativeAngle = 0;
        this.pennantWaveOffset = Math.random() * Math.PI * 2;
        this.pennantWaveSpeed = 0.08;
        this.pennantWaveAmplitude = this.pennantWidth * 0.4;
        this.pennantWaveFrequency = 1;
        this.pennantEaseFactor = 0.1;
        this.pennantStrokeColor = darkenColor(this._pennantColor, 20);

        // --- New: Generate Sail Damage Patterns ---
        this._generateSailDamagePatterns();

        // --- New: Pre-calculate Deck Planks ---
        this._precalculateDeckPlanks();

        // --- New: Pre-render the static ship parts to a cache canvas ---
        if (!this.skipCache) {
            this._cacheShipImage();
        }
    }

    /**
     * New: Generates random damage patterns (holes/tears) for the sail.
     * These are stored and only rendered when Rig HP drops below their threshold.
     * @private
     */
    _generateSailDamagePatterns() {
        this.sailDamagePatterns = [];
        if (!this.sailVisualPoints || this.sailVisualPoints.length === 0) return;

        // Calculate bounding box of the sail
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.sailVisualPoints.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const numHoles = Math.floor(width * height / 200); // Density heuristic

        for (let i = 0; i < numHoles; i++) {
            // Random position within bounding box
            const x = minX + Math.random() * width;
            const y = minY + Math.random() * height;

            // Check if point is actually inside the sail polygon
            if (isPointInPolygon({x, y}, this.sailVisualPoints)) {
                // Generate a jagged hole (irregular polygon)
                const radius = 2 + Math.random() * 4;
                const points = [];
                const sides = 5 + Math.floor(Math.random() * 4);
                for (let j = 0; j < sides; j++) {
                    const angle = (j / sides) * Math.PI * 2;
                    const r = radius * (0.5 + Math.random() * 0.5); // Jaggedness
                    points.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
                }

                this.sailDamagePatterns.push({
                    points: points,
                    // Assign a random HP threshold between 0% and 90%.
                    // The hole appears when HP drops BELOW this percentage.
                    threshold: Math.random() * 0.9 
                });
            }
        }
    }

    // New: Setter for hull color to auto-update stroke color
    set color(newColor) {
        this._color = newColor;
        this.hullStrokeColor = darkenColor(newColor, 10);
    }
    get color() { return this._color; }

    // New: Setter for pennantColor to auto-update stroke color
    set pennantColor(newColor) {
        this._pennantColor = newColor;
        this.pennantStrokeColor = darkenColor(newColor, 20);
    }
    get pennantColor() { return this._pennantColor; }

    // New: Setter for sailColor to auto-update stroke color
    set sailColor(newColor) {
        this._sailColor = newColor;
        this.sailStrokeColor = darkenColor(newColor, 40);
    }
    get sailColor() {
        return this._sailColor;
    }

    /**
     * Pre-calculates the deck plank lines to avoid expensive math per frame.
     * @private
     */
    _precalculateDeckPlanks() {
        this.deckPlankLines = [];
        const deckMinY = Math.min(...this.deckVisualPoints.map(p => p.y));
        const deckMaxY = Math.max(...this.deckVisualPoints.map(p => p.y));
        const deckHeight = deckMaxY - deckMinY;
        const numPlanks = Math.max(1, Math.floor(deckHeight / DECK_PLANK_SPACING) - 1);
        const actualEvenSpacing = deckHeight / (numPlanks + 1);

        for (let i = 1; i <= numPlanks; i++) {
            const plankY = deckMinY + (i * actualEvenSpacing);
            let minX = Infinity;
            let maxX = -Infinity;

            for (let j = 0; j < this.deckVisualPoints.length; j++) {
                const p1 = this.deckVisualPoints[j];
                const p2 = this.deckVisualPoints[(j + 1) % this.deckVisualPoints.length];

                if ((p1.y <= plankY && p2.y > plankY) || (p2.y <= plankY && p1.y > plankY)) {
                    const intersectX = (plankY - p1.y) * (p2.x - p1.x) / (p2.y - p1.y) + p1.x;
                    minX = Math.min(minX, intersectX);
                    maxX = Math.max(maxX, intersectX);
                }
            }

            if (isFinite(minX) && isFinite(maxX)) {
                this.deckPlankLines.push({ x1: minX, y1: plankY, x2: maxX, y2: plankY });
            }
        }
    }

    /**
     * New: Creates a pre-rendered image of the ship's static components (hull, decks, cannons)
     * onto an offscreen canvas for performance. This is called once from the constructor.
     * @private
     */
    _cacheShipImage() {
        // 1. Calculate the bounding box of all static geometry to size the canvas.
        const allPoints = [
            ...this.hullBaseVisualPoints,
            ...this.deckVisualPoints,
            ...this.bulwarkVisualPoints,
            ...this.bulwarkInnerCutoutVisualPoints
        ];

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        allPoints.forEach(p => { if (p) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); } });

        // Add cannon dimensions to bounding box
        const cannonWidth = (this.shipWidth * 0.9) * (1 / 3);
        const cannonHeight = cannonWidth * (166/314); // Approximate height based on aspect ratio
        minY = Math.min(minY, -this.shipWidth * 0.4 - cannonHeight);
        maxY = Math.max(maxY, this.shipWidth * 0.4 + cannonHeight);

        const margin = 10; // Add a margin to prevent clipping strokes
        minX -= margin; minY -= margin; maxX += margin; maxY += margin;
        const width = maxX - minX; const height = maxY - minY;

        if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) return;

        // 2. Create and prepare the offscreen canvas.
        this.shipCacheCanvas = window.CanvasManager.getCanvas(width, height);
        this.shipCacheCanvas.width = width;
        this.shipCacheCanvas.height = height;
        const offCtx = this.shipCacheCanvas.getContext('2d');

        // Defensive check: If context creation fails, return early to prevent TypeError.
        // This can happen if canvas dimensions are excessively large or due to browser issues.
        if (!offCtx) {
            console.warn(`Failed to get 2D context for base ship cache. Width: ${width}, Height: ${height}.`, this);
            this.shipCacheCanvas = null; // Ensure we don't try to use a failed canvas
            return;
        }
        this.shipCacheOffset = { x: minX, y: minY };
        offCtx.translate(-minX, -minY);

        // 3. Perform the one-time draw of all static components onto the offscreen canvas.
        // We use a dummy scale of 1.0, which means line widths will be fixed.
        // This is consistent with how CustomShip caching works.
        // const DUMMY_WORLD_TO_SCREEN_SCALE = 1.0;
        // this._drawCachedBaseShip(offCtx, DUMMY_WORLD_TO_SCREEN_SCALE);

        console.log(`[Cache] Pre-rendered base ship to a ${width}x${height} canvas.`);
    }

    /**
     * New: Updates the cached sail image if the damage level has changed significantly.
     * @private
     */
    _updateSailCache() {
        const currentHpPercent = this.rigHp / this.maxRigHp;
        
        // Only update if we've crossed a threshold (e.g., every 10% loss) or if cache is missing
        if (this.sailCacheCanvas && Math.abs(this.lastCachedRigHpPercent - currentHpPercent) < TATTERED_SAIL_UPDATE_THRESHOLD) {
            return;
        }

        // 1. Setup Canvas
        if (!this.sailCacheCanvas) {
            this.sailCacheCanvas = document.createElement('canvas');
            // Size it to the sail's bounding box + margin
            const bounds = getPolygonAABB(this.sailVisualPoints);
            this.sailCacheCanvas.width = bounds.maxX - bounds.minX + 20;
            this.sailCacheCanvas.height = bounds.maxY - bounds.minY + 20;
            this.sailCacheOffset = { x: bounds.minX - 10, y: bounds.minY - 10 };
        }

        const ctx = this.sailCacheCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.sailCacheCanvas.width, this.sailCacheCanvas.height);
        
        ctx.save();
        ctx.translate(-this.sailCacheOffset.x, -this.sailCacheOffset.y);

        // 2. Draw Clean Sail
        ctx.fillStyle = this.sailColor;
        ctx.beginPath();
        this.sailVisualPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();

        // 3. Cut Out Holes (Destination-Out)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'black'; // Color doesn't matter, alpha does
        
        for (const hole of this.sailDamagePatterns) {
            // If current HP is BELOW the hole's threshold, draw the hole.
            if (currentHpPercent < hole.threshold) {
                ctx.beginPath();
                hole.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.closePath();
                ctx.fill();
            }
        }

        // 4. Draw Stroke (Source-Over)
        // We draw the stroke *after* cutting holes so the outline isn't erased,
        // but we might want the outline to be broken too? 
        // Usually, tattered sails have frayed edges, so keeping the outline solid looks weird.
        // Let's draw the outline *before* cutting holes if we want breaks, or after if we want a border.
        // Standard "cloth" logic: The hole cuts everything.
        // So we actually should have drawn the stroke in step 2.
        
        ctx.restore();

        this.lastCachedRigHpPercent = currentHpPercent;
    }

    /**
     * New: Calculates the performance penalty due to starvation.
     * 1.0 = No penalty. < 1.0 = Penalty.
     * Penalty increases by 10% per day of starvation.
     */
    getStarvationPenalty() {
        if (this.daysStarving <= 0) return 1.0;
        return Math.max(0.1, 1.0 - (this.daysStarving * 0.1));
    }

    /**
     * New: Calculates the dynamic reload time based on crew availability.
     * Rules:
     * 1. Base efficient crew is 5 per cannon (2.0s reload).
     * 2. Below 5, reload increases by 0.4s per missing crew avg.
     * 3. Below 1, reload increases by 4.0s per uncrewed cannon.
     * @returns {number} The calculated reload time in milliseconds.
     */
    getReloadTime() {
        const broadsideCount = this.getBroadsideCount();
        if (broadsideCount <= 0) return this.reloadTime;

        // Crew is divided between all cannons of a single broadside.
        const averageCrewPerCannon = this.crew / broadsideCount;

        // Use the instance's specific base reload time (from blueprint/options)
        const baseTime = this.reloadTime || RELOAD_TIME_BASE_MS;

        let calculatedTime;
        if (averageCrewPerCannon >= CREW_PER_CANNON_OPTIMAL) {
            calculatedTime = baseTime;
        } else if (averageCrewPerCannon >= 1) {
            // Linear increase: Base + (5 - avg) * 0.4s
            const missingAvg = CREW_PER_CANNON_OPTIMAL - averageCrewPerCannon;
            calculatedTime = baseTime + (missingAvg * RELOAD_PENALTY_PER_MISSING_CREW_MS);
        } else {
            // Below 1 crew per cannon.
            // Calculate time at 1 crew first based on the ship's specific base time
            const timeAtOneCrew = baseTime + ((CREW_PER_CANNON_OPTIMAL - 1) * RELOAD_PENALTY_PER_MISSING_CREW_MS);
            
            const uncrewedCannons = broadsideCount - this.crew;
            calculatedTime = timeAtOneCrew + (uncrewedCannons * RELOAD_PENALTY_UNMANNED_MS);
        }
        // Apply Starvation Penalty (Slower reload)
        return calculatedTime / this.getStarvationPenalty();
    }

    /**
     * Consumes a specific amount of an item from the ship's inventory.
     * Handles conversion between individual item units and container weights.
     * @param {string} itemId - The ID of the item (e.g., 'round-shot', 'log').
     * @param {number} count - The number of individual units to consume.
     * @returns {boolean} True if items were successfully consumed, False if insufficient.
     */
    consumeItem(itemId, count) {
        // If no inventory exists (e.g., simple NPCs), assume infinite ammo or handle elsewhere.
        if (!this.inventory || !this.inventory.cargo) return true;

        const itemDef = window.ITEM_DATABASE?.[itemId];
        if (!itemDef) return false;

        // The size/weight of a single unit of item
        const itemUnitSize = (typeof itemDef.fixedSize === 'number') ? itemDef.fixedSize : itemDef.weight;
        let totalMassRequired = count * itemUnitSize;

        // 1. Check if we have enough total mass of this item type
        let totalAvailableMass = 0;
        for (const entry of this.inventory.cargo) {
            if (entry.item.id === itemId) {
                // If in a container, the "unit" of quantity is the container's weight (e.g., 1.0 for Large Crate)
                // If loose, it's the item's own unit size.
                const entryUnitWeight = (entry.container && entry.container.weight > 0) ? entry.container.weight : itemUnitSize;
                totalAvailableMass += entry.quantity * entryUnitWeight;
            }
        }

        if (totalAvailableMass < totalMassRequired) return false;

        // 2. Consume the item
        // We iterate backwards to safely remove empty entries
        for (let i = this.inventory.cargo.length - 1; i >= 0; i--) {
            if (totalMassRequired <= 0.0001) break; // Done

            const entry = this.inventory.cargo[i];
            if (entry.item.id === itemId) {
                const entryUnitWeight = (entry.container && entry.container.weight > 0) ? entry.container.weight : itemUnitSize;
                
                // Calculate how much mass we can take from this specific entry
                const massToTake = Math.min(entry.quantity * entryUnitWeight, totalMassRequired);
                
                // Convert that mass back into "quantity" units for this entry (e.g., fraction of a crate)
                const quantityReduction = massToTake / entryUnitWeight;

                entry.quantity -= quantityReduction;
                entry.lastUpdated = performance.now(); // Track update time
                totalMassRequired -= massToTake;

                // Update inventory capacity tracking if it exists
                if (this.inventory.usedCapacity !== undefined) {
                    this.inventory.usedCapacity -= massToTake;
                }

                // Remove entry if empty (or close enough to zero)
                if (entry.quantity <= 0.0001) {
                    this.inventory.cargo.splice(i, 1);
                }
            }
        }

        return true;
    }

    /**
     * New: Helper to get the total quantity of an item in the inventory.
     * @param {string} itemId 
     * @returns {number}
     */
    getItemQuantity(itemId) {
        if (!this.inventory || !this.inventory.cargo) return 0;
        let total = 0;
        for (const entry of this.inventory.cargo) {
            if (entry.item.id === itemId) {
                // ShipInventory stores 'quantity' as the number of items (or container units)
                total += entry.quantity;
            }
        }
        return total;
    }

    /**
     * New: Helper to get the total mass of an item in the inventory.
     * @param {string} itemId 
     * @returns {number}
     */
    getItemMass(itemId) {
        if (!this.inventory || !this.inventory.cargo) return 0;
        let totalMass = 0;
        for (const entry of this.inventory.cargo) {
            if (entry.item.id === itemId) {
                // entry.unitWeight is pre-calculated size of one unit in the entry (container or item)
                totalMass += entry.quantity * entry.unitWeight;
            }
        }
        return totalMass;
    }

    /**
     * Legacy alias for consumeItem to maintain backward compatibility.
     * @deprecated Use consumeItem instead.
     * @param {string} itemId 
     * @param {number} count 
     */
    consumeAmmunition(itemId, count) {
        return this.consumeItem(itemId, count);
    }

    /**
     * Checks if the ship has a specific amount of an item.
     * @param {string} itemId - The ID of the item.
     * @param {number} count - The number of individual units.
     * @returns {boolean} True if available.
     */
    hasItem(itemId, count) {
        if (!this.inventory || !this.inventory.cargo) return true;
        
        const itemDef = window.ITEM_DATABASE?.[itemId];
        if (!itemDef) return false;

        const itemUnitSize = (typeof itemDef.fixedSize === 'number') ? itemDef.fixedSize : itemDef.weight;
        let totalMassRequired = count * itemUnitSize;
        let totalAvailableMass = 0;

        for (const entry of this.inventory.cargo) {
            if (entry.item.id === itemId) {
                const entryUnitWeight = (entry.container && entry.container.weight > 0) ? entry.container.weight : itemUnitSize;
                totalAvailableMass += entry.quantity * entryUnitWeight;
            }
        }
        return totalAvailableMass >= totalMassRequired;
    }

    /**
     * Calculates the world coordinates of the cannon muzzle for a given side.
     * @param {string} side - 'port' or 'starboard'.
     * @param {object} [out] - Optional object to write the result into.
     * @returns {{x: number, y: number}} The world coordinates of the muzzle.
     */
    getMuzzlePosition(side, out = {x: 0, y: 0}) {
        // --- FIX: Correctly replicate the scaling logic from _drawDetailedCannon ---
        // The drawing logic scales based on the desired *width* (which is the cannon's length along the barrel).
        const desiredCarriageWidth = (this.shipWidth * 0.9) * (1 / 3);
        const carriageBaseLength_svg = 314;
        const carriageBaseWidth_svg = 166;
        const cannonYOffset = (this.shipWidth * 0.8 / 2);

        // --- Determine the local position of the muzzle tip ---
        // This logic is derived from the _drawDetailedCannon method.
        const scale = desiredCarriageWidth / carriageBaseLength_svg;
        const finalLength = desiredCarriageWidth; // This is the key fix
        const barrelBoxLength = finalLength * (5 / 3);
        const finalHeight = carriageBaseWidth_svg * scale;
        const barrelBoxWidth = finalHeight * (1 / 2);
        // The muzzle tip's local X position is calculated relative to the carriage's drawing origin (0,0),
        // before the final translation in _drawDetailedCannon.
        // It's the sum of all the forward-facing barrel components.
        const knobRadius = (barrelBoxWidth * (2 / 5)) / 2;
        const muzzleTipLocalX = knobRadius * 3 + barrelBoxLength * 0.8 + barrelBoxLength * (1 / 12) + barrelBoxLength * (1 / 60);

        // --- Determine the local position of the cannon on the ship's deck ---
        let localCannonX = 0;
        let localCannonY = 0;
        let cannonRotation = 0;

        if (side === 'starboard') {
            localCannonY = cannonYOffset;
            cannonRotation = Math.PI / 2;
        } else if (side === 'port') {
            localCannonY = -cannonYOffset;
            cannonRotation = -Math.PI / 2;
        } else if (side === 'bow') {
            localCannonX = this.shipLength / 2;
        } else if (side === 'stern') {
            localCannonX = -this.shipLength / 2;
            cannonRotation = Math.PI;
        }

        // --- OPTIMIZATION: Inline Math to avoid object allocation ---
        // 1. Muzzle relative to cannon origin
        const mx = muzzleTipLocalX - finalLength;
        const my = -finalHeight / 2;

        // 2. Rotate by cannonRotation (on deck)
        const cCos = Math.cos(cannonRotation);
        const cSin = Math.sin(cannonRotation);
        const deckX = (mx * cCos - my * cSin) + localCannonX; // Add deck X offset
        const deckY = (mx * cSin + my * cCos) + localCannonY; // Add deck Y offset

        // 3. Rotate by ship angle and translate to world
        const sCos = Math.cos(this.angle);
        const sSin = Math.sin(this.angle);
        
        out.x = this.x + (deckX * sCos - deckY * sSin);
        out.y = this.y + (deckX * sSin + deckY * sCos);
        return out;
    }

    /**
     * Fires a cannonball from the specified side of the ship.
     * @param {string} side - 'port' or 'starboard'.
     * @param {Array<Cannonball>} cannonballs - The global array of cannonballs to add to.
     * @param {Array<Volley>} [volleys=null] - The global array of volleys to add to.
     * @param {number|null} [fireAngleOverride=null] - A specific angle to fire at. If null, fires perpendicular to the ship.
     * @returns {boolean} True if a cannonball was fired, false otherwise.
     */
    fireCannonball(side, cannonballs, volleys = null, fireAngleOverride = null) {
        const now = performance.now();
        let canFire = false;

        // --- FIX: Use dynamic getReloadTime() for checks ---
        const currentReloadTime = this.getReloadTime();

        if (side === 'starboard' && now - this.lastStarboardFireTime >= currentReloadTime) {
            canFire = true;
            this.lastStarboardFireTime = now;
            this.starboardCannonReloadTime = currentReloadTime;
        } else if (side === 'port' && now - this.lastPortFireTime >= currentReloadTime) {
            canFire = true;
            this.lastPortFireTime = now;
            this.portCannonReloadTime = currentReloadTime;
        }

        if (!canFire) {
            // console.log(`[fireCannonball] Cannot fire ${side}. Reloading.`); // --- DEBUG LOGGING ---
            return false; // Cannon not reloaded yet
        }

        // Firing a cannon is an action that resets the HP regeneration cooldown.
        this.performAction();

        // --- NEW: Consume Ammunition ---
        // Determine shot type (Player uses selection, Base/NPC defaults to round-shot)
        const shotType = this.selectedShotType || 'round-shot';

        // Check for both Round Shot and Gunpowder (0.005 mass units per shot)
        if (!this.hasItem(shotType, 1) || !this.hasItem('gunpowder', 0.005)) {
            console.log(`[${this.shipId || 'Player'}] Cannot fire ${shotType}: Insufficient ammunition or gunpowder.`);
            return false; // Out of ammo
        }
        this.consumeItem(shotType, 1);
        this.consumeItem('gunpowder', 0.005);

        // Get the precise world coordinates of the muzzle tip.
        const muzzlePosition = this.getMuzzlePosition(side);
        console.log(`[fireCannonball] Muzzle position for ${side}:`, muzzlePosition); // --- DEBUG LOGGING ---

        // The fire angle is the override if provided; otherwise, it's perpendicular to the ship's hull.
        const fireAngle = fireAngleOverride !== null
            ? fireAngleOverride
            : (side === 'starboard') ? this.angle + Math.PI / 2 : this.angle - Math.PI / 2;

        // --- NEW: Dynamically calculate cannonball radius based on the default cannon size ---
        // This ensures that if the base cannon size changes, the cannonball size will too.
        // --- FIX: Use the correct scaling logic consistent with the drawing method ---
        // The desired width for the cannon carriage is 1/3 of the deck width.
        const desiredCarriageLength = (this.shipWidth * 0.9) * (1 / 3);
        // The scale is based on the SVG's original length (314).
        const scale = desiredCarriageLength / 314;
        // The cannonball radius is proportional to the cannon's final scaled size.
        const dynamicRadius = (166 * scale) / 4; // Proportional to the final height of the cannon

        console.log(`[fireCannonball] Creating cannonball at (${muzzlePosition.x.toFixed(2)}, ${muzzlePosition.y.toFixed(2)}) with angle ${fireAngle.toFixed(2)}`); // --- DEBUG LOGGING ---
        
        // --- NEW: Instantiate correct projectile type ---
        if (shotType === 'chain-shot') {
            cannonballs.push(ChainShot.get(muzzlePosition.x, muzzlePosition.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, this.vx, this.vy));
        } else if (shotType === 'grape-shot') {
            cannonballs.push(GrapeShot.get(muzzlePosition.x, muzzlePosition.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, this.vx, this.vy));
        } else if (shotType === 'canister-shot') {
            cannonballs.push(CanisterShot.get(muzzlePosition.x, muzzlePosition.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, this.vx, this.vy));
        } else {
            cannonballs.push(Cannonball.get(muzzlePosition.x, muzzlePosition.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, this.vx, this.vy));
        }

        // --- NEW: Create a small Volley for this single shot ---
        if (volleys) {
            let speed = CANNONBALL_SPEED;
            if (shotType === 'chain-shot') speed *= CHAIN_SHOT_SPEED_MULTIPLIER;
            if (shotType === 'grape-shot') speed *= GRAPE_SHOT_SPEED_MULTIPLIER;
            if (shotType === 'canister-shot') speed *= CANISTER_SHOT_SPEED_MULTIPLIER;
            
            const vx = Math.cos(fireAngle) * speed + this.vx;
            const vy = Math.sin(fireAngle) * speed + this.vy;
            volleys.push(Volley.get(muzzlePosition.x, muzzlePosition.y, vx, vy, dynamicRadius * 4, this));
        }

        // --- NEW: Create Visual Effect ---
        if (window.PlunderGame && window.PlunderGame.createCannonEffect) {
            window.PlunderGame.createCannonEffect(muzzlePosition.x, muzzlePosition.y, fireAngle, window.windDirection);
        }
        return true;
    }

    /**
     * New: Fires a single cannonball based on a cannon's blueprint definition.
     * This is a helper for the fireBroadside method, now in the base class.
     * @param {object} cannon - The cannon object from the blueprint's layout.
     * @param {Array<Cannonball>} cannonballs - The global array to add new cannonballs to.
     */
    fireSingleCannon(cannon, cannonballs) {
        let muzzleWorldPos;

        if (cannon.localMuzzlePos) {
            // --- OPTIMIZATION: Use pre-calculated local position ---
            // We only need to rotate the ship-relative vector by the ship's current angle.
            // Inlining the rotation math here avoids creating intermediate objects.
            const cos = Math.cos(this.angle);
            const sin = Math.sin(this.angle);
            const dx = cannon.localMuzzlePos.x;
            const dy = cannon.localMuzzlePos.y;
            
            muzzleWorldPos = {
                x: this.x + (dx * cos - dy * sin),
                y: this.y + (dx * sin + dy * cos)
            };
        }

        const fireAngle = normalizeAngle(this.angle + cannon.angle);

        // --- NEW: Dynamically calculate cannonball radius based on the blueprint cannon size ---
        // --- FIX: Set the radius to be 1/4 of the cannon's unit size for clear scaling. ---
        const dynamicRadius = CANNON_UNIT_SIZE / 4;

        // 5. Create the cannonball at the correct world position with the correct world angle.
        console.log(`[fireSingleCannon] Firing from blueprint. World Pos: (${muzzleWorldPos.x.toFixed(2)}, ${muzzleWorldPos.y.toFixed(2)}), Fire Angle: ${fireAngle.toFixed(2)}`); // --- DEBUG LOGGING ---
        // --- FIX: Pass the ship's current velocity to the cannonball for inherited momentum. ---
        const inheritedVx = this.vx;
        const inheritedVy = this.vy;
        
        // --- NEW: Instantiate correct projectile type ---
        const shotType = this.selectedShotType || 'round-shot';
        if (shotType === 'chain-shot') {
            cannonballs.push(ChainShot.get(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        } else if (shotType === 'grape-shot') {
            cannonballs.push(GrapeShot.get(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        } else if (shotType === 'canister-shot') {
            cannonballs.push(CanisterShot.get(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        } else {
            cannonballs.push(Cannonball.get(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, dynamicRadius, CANNONBALL_SPEED, CANNONBALL_COLOR, this, inheritedVx, inheritedVy));
        }

        // --- NEW: Create Visual Effect ---
        if (window.PlunderGame && window.PlunderGame.createCannonEffect) {
            window.PlunderGame.createCannonEffect(muzzleWorldPos.x, muzzleWorldPos.y, fireAngle, window.windDirection);
        }
    }

    /**
     * New: Base implementation for getting the broadside count.
     * The default ship has one cannon per side.
     * @returns {number}
     */
    getBroadsideCount() {
        return 1;
    }

    /**
     * New: Calculates a rough "power level" for the ship.
     * This is used by AI to compare relative strength.
     * @returns {number} A numeric score representing the ship's power.
     */
    getPowerLevel() {
        // A simple formula combining key stats.
        // maxHp is a good base.
        // shipLength contributes to ramming damage and presence.
        // Broadside count is the primary offensive measure.
        const lengthFactor = this.shipLength / SHIP_TARGET_LENGTH; // Normalize against a base ship
        const broadsideFactor = this.getBroadsideCount();

        // The formula gives weight to durability, size, and firepower.
        const power = this.maxHp + (lengthFactor * 10) + (broadsideFactor * 5);
        return Math.round(power);
    }

    /**
     * Signals that the ship has performed an action, resetting the health regeneration cooldown.
     */
    performAction() {
        this.lastDamageTime = performance.now();
    }

    /**
     * Reduces the ship's HP and updates the last damage time.
     * @param {number} amount - The amount of HP to deduct.
     */
    takeDamage(amount) {
        // If already sinking, damage fills the sink meter faster
        if (this.isSinking) {
            this.sinkHp += amount;
            return;
        }

        this.hp -= amount;
        this.lastDamageTime = performance.now();
        if (this.hp < 0) {
            this.hp = 0;
        }
    }

    /**
     * New: Reduces the ship's Rig HP and updates the last damage time.
     * @param {number} amount - The amount of Rig HP to deduct.
     */
    takeRigDamage(amount) {
        this.rigHp -= amount;
        this.lastDamageTime = performance.now();
        if (this.rigHp < 0) {
            this.rigHp = 0;
        }
    }

    /**
     * Calculates a speed multiplier based on the ship's current health.
     * Speed is progressively reduced when HP drops below 50%.
     * @returns {number} A multiplier for speed (between 0.0 and 1.0).
     */
    getDamageSpeedMultiplier() {
        let multiplier = 1.0;

        // Hull Damage: Speed drops when HP < 50%
        if (this.maxHp > 0) {
            const hpRatio = this.hp / this.maxHp;
            if (hpRatio < 0.5) {
                multiplier *= (hpRatio * 2);
            }
        }

        // Rig Damage: Speed drops immediately and linearly with Rig HP
        if (this.maxRigHp > 0) {
            const rigRatio = this.rigHp / this.maxRigHp;
            multiplier *= rigRatio;
        }

        // Apply Starvation Penalty
        return multiplier * this.getStarvationPenalty();
    }

    /**
     * New: Calculates turning speed multiplier based on Rig HP.
     * Affects turning while moving when Rig HP < 50%.
     */
    getRigTurningMultiplier() {
        if (this.maxRigHp <= 0) return 1.0;
        const rigRatio = this.rigHp / this.maxRigHp;
        if (rigRatio < 0.5) {
            // Scales from 1.0 at 50% Rig HP down to 0.0 at 0% Rig HP.
            return rigRatio * 2;
        }
        return 1.0;
    }

    /**
     * New: Calculates turning speed multiplier based on Crew Num.
     * Affects turning while moving and pivoting when Crew < Min Sailing Crew.
     * @returns {number} A multiplier between 0.0 and 1.0.
     */
    getCrewTurningMultiplier() {
        if (this.minSailingCrew <= 0) return 1.0;
        if (this.crew < this.minSailingCrew) {
            // Linearly scale from 1.0 at minSailingCrew down to 0.0 at 0 crew.
            return Math.max(0, this.crew / this.minSailingCrew);
        }
        return 1.0;
    }

    /**
     * Gets the ship's collision points transformed by its current position and rotation.
     * @returns {Array<{x: number, y: number}>} An array of absolute point objects.
     */
    getTransformedPoints() {
        // --- OPTIMIZATION: Check Cache ---
        if (this.x === this._transformCache.x && 
            this.y === this._transformCache.y && 
            this.angle === this._transformCache.angle &&
            this.transformedPoints.length === this.points.length) {
            return this.transformedPoints;
        }

        // --- OPTIMIZATION: Object Pooling & Inlining ---
        // 1. Ensure pool size matches current points (handles blueprint changes)
        if (this.transformedPoints.length !== this.points.length) {
            this.transformedPoints = this.points.map(() => ({ x: 0, y: 0 }));
        }

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            // Inline rotation and translation to avoid creating intermediate objects
            this.transformedPoints[i].x = (p.x * cos - p.y * sin) + this.x;
            this.transformedPoints[i].y = (p.x * sin + p.y * cos) + this.y;
        }

        // Update Cache State
        this._transformCache.x = this.x;
        this._transformCache.y = this.y;
        this._transformCache.angle = this.angle;
        this._aabbDirty = true; // Mark AABB as dirty since points changed

        return this.transformedPoints;
    }

    /**
     * Returns the Axis-Aligned Bounding Box (AABB) of the ship.
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
     */
    getAABB() {
        // Ensure points are up to date (this might set _aabbDirty to true)
        this.getTransformedPoints();

        // Return cached AABB if valid
        if (!this._aabbDirty) return this.aabb;

        const transformedPoints = this.transformedPoints;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        transformedPoints.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        this.aabb.minX = minX; this.aabb.minY = minY;
        this.aabb.maxX = maxX; this.aabb.maxY = maxY;
        this._aabbDirty = false;
        return this.aabb;
    }

    /**
     * Gets the ship's bow point in world coordinates.
     * @param {object} [out] - Optional object to write the result into.
     * @returns {{x: number, y: number}}
     */
    getBowPointWorldCoords(out = {x: 0, y: 0}) {
        // --- FIX: Use the visual hull's forward-most point for the anchor connection ---
        // The visual hull is often longer and more pointed than the collision hull.
        // Using its max X value ensures the anchor line connects to the visible tip.
        const visualBowX = this.hullBaseVisualPoints.reduce((max, p) => Math.max(max, p.x), -Infinity);
        
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        out.x = (visualBowX * cos) + this.x;
        out.y = (visualBowX * sin) + this.y;
        return out;
    }

    /**
     * Gets the ship's stern point in world coordinates.
     * @param {object} [out] - Optional object to write the result into.
     * @returns {{x: number, y: number}}
     */
    getSternPointWorldCoords(out = {x: 0, y: 0}) {
        // --- FIX: Use the visual hull's aft-most point for dynamic stern position ---
        const visualSternX = this.hullBaseVisualPoints.reduce((min, p) => Math.min(min, p.x), Infinity);
        
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        out.x = (visualSternX * cos) + this.x;
        out.y = (visualSternX * sin) + this.y;
        return out;
    } 

    /**
     * The main update method for a ship, called every frame.
     * Subclasses will override this to add their specific logic (input/AI)
     * and then call super.update() to run this common logic.
     * @param {number} deltaTime - Time elapsed since the last frame in milliseconds.
     * @param {object} [keys={}] - The state of keyboard keys. Only used by PlayerShip.
     * @param {PlayerShip} [player=null] - The player ship instance. Only used by NpcShip.
     * @param {number} [windDirection=0] - The current wind direction in radians.
     * @param {Array<Cannonball>} [cannonballs=[]] - The array to add new cannonballs to.
     * @param {Array<Volley>} [volleys=[]] - The array to add new volleys to.
     * @param {Array<Island>} [islands=[]] - The array of islands, used for navigation.
     * @param {Array<NpcShip>} [npcs=[]] - The array of all NPC ships, for context.
     * @param {Pathfinder} [pathfinder=null] - The global pathfinder instance.
     */
    update(deltaTime, keys = {}, player = null, windDirection = 0, cannonballs = [], volleys = [], islands = [], npcs = [], pathfinder = null) {
        // Update timers and visuals first
        this.updateReloadTimers(deltaTime);
        this._updateVisuals(windDirection);

        // --- NEW: Smoke Logic (Damage Effects) ---
        this._updateFire(deltaTime);
        this._updateSmoke(deltaTime, windDirection);

        // --- NEW: Sinking Logic ---
        if (this.hp <= 0 && !this.isSinking) {
            this.isSinking = true;
            this.sinkAngle = Math.random() * Math.PI * 2; // Random list/pitch direction
            this.isSailOpen = false; // Sails drop automatically
            this.ringSpawnTimer = 300; // Ensure immediate first ring
        }

        if (this.isSinking) {
            this.sinkHp += deltaTime * 0.005; // Base sink rate
            if (this.sinkHp >= this.maxSinkHp) {
                this.isSunk = true;
            }
            // Sinking ships lose velocity rapidly
            this.vx *= 0.95;
            this.vy *= 0.95;

            // --- NEW: Generate Sinking Particles (Bubbles/Foam) ---
            // Stop generating bubbles at 90% progress so they clear up before removal.
            if (this.sinkHp / this.maxSinkHp < 0.9 && Math.random() < 0.4) { // Spawn chance
                const angle = Math.random() * Math.PI * 2;
                // Spawn within the ship's radius
                const dist = Math.random() * (Math.max(this.shipLength, this.shipWidth) * 0.5);
                const p = getSinkParticle();
                p.x = Math.cos(angle) * dist;
                p.y = Math.sin(angle) * dist;
                p.r = Math.random() * 4 + 2; // Radius
                p.alpha = 1.0;
                p.life = 1.0; // Life percentage
                p.decay = 0.01 + Math.random() * 0.02; // Decay rate
                this.sinkParticles.push(p);
            }

            // Update particles
            for (let i = this.sinkParticles.length - 1; i >= 0; i--) {
                const p = this.sinkParticles[i];
                p.life -= p.decay;
                p.r += 0.1; // Expand slowly
                if (p.life <= 0) {
                    releaseSinkParticle(p);
                    this.sinkParticles.splice(i, 1);
                }
            }

            // --- NEW: Generate Sinking Rings (Agitated Water) ---
            // Stop generating rings at 80% progress so they fade out before the ship is removed.
            if (this.sinkHp / this.maxSinkHp < 0.8) {
                this.ringSpawnTimer += deltaTime;
                if (this.ringSpawnTimer >= 300) { // Spawn every 300ms (approx 20 frames)
                    this.ringSpawnTimer = 0;
                    // Scale effect based on ship size relative to standard size
                    const scale = this.shipWidth / SHIP_TARGET_WIDTH;

                    // Calculate expansion to reach exactly 1 ship length diameter at end of life
                    const lifeSpanFrames = 0.8 / 0.005; // alpha / decay

                // X Axis (Length)
                const endRadiusX = this.shipLength * 0.75;
                const startRadiusX = endRadiusX * 0.25;
                const expansionX = (endRadiusX - startRadiusX) / lifeSpanFrames;

                // Y Axis (Width)
                const endRadiusY = this.shipWidth * 0.75;
                const startRadiusY = endRadiusY * 0.25;
                const expansionY = (endRadiusY - startRadiusY) / lifeSpanFrames;

                    this.sinkRings.push({
                    rX: startRadiusX,
                    rY: startRadiusY,
                    expansionX: expansionX,
                    expansionY: expansionY,
                        alpha: 0.8,
                        rotation: Math.random() * Math.PI * 2,
                        freq: Math.floor(6 + Math.random() * 6), // 6-12 lobes (marquise shapes)
                        speed: (Math.random() - 0.5) * 0.01, // Rotation speed
                        amp: (3 + Math.random() * 4) * scale, // Wave amplitude, scaled
                        thickness: 1.5 * scale, // Thickness, scaled
                        numDashes: Math.max(4, Math.floor(6 * scale)) // Fixed number of dashes, scaled by ship size
                    });
                }
            }

            // Update Rings
            for (let i = this.sinkRings.length - 1; i >= 0; i--) {
                const ring = this.sinkRings[i];
                ring.rX += ring.expansionX; // Expand outward X
                ring.rY += ring.expansionY; // Expand outward Y
                ring.rotation += ring.speed;
                ring.alpha -= 0.005; // Fade out
                if (ring.alpha <= 0) this.sinkRings.splice(i, 1);
            }
        }

        // Then apply physics
        this.applyPhysicsAndBoundaries(windDirection);

        // --- NEW: Calculate turn rate before updating lastAngle ---
        this.currentTurnRate = this.angle - this.lastAngle;
        while (this.currentTurnRate <= -Math.PI) this.currentTurnRate += Math.PI * 2;
        while (this.currentTurnRate > Math.PI) this.currentTurnRate -= Math.PI * 2;

        // --- NEW: Update Wake Trails ---
        this._updateWake(deltaTime);

        // Update lastAngle for the next frame (used by AI for stability checks)
        this.lastAngle = this.angle;
    }

    /**
     * Updates fire particles, handles spawning based on damage, and applies fire damage.
     * @private
     */
    _updateFire(deltaTime) {
        // 1. Spawn Logic: Fire starts appearing below 40% HP
        const fireThreshold = this.maxHp * 0.4;
        
        if (!this.isSinking && this.hp < fireThreshold && this.hp > 0) {
            // Probability increases as HP drops further
            const fireIntensity = 1.0 - (this.hp / fireThreshold);
            // Base chance per frame (scaled by delta)
            const spawnChance = 0.05 + (fireIntensity * 0.2); 
            
            if (Math.random() < spawnChance * (deltaTime / 16)) {
                this._spawnFireParticle();
            }
        }

        // 2. Update Particles
        for (let i = this.fireParticles.length - 1; i >= 0; i--) {
            const p = this.fireParticles[i];
            p.life -= deltaTime;
            
            // Fire moves with the ship (attached)
            p.x += this.vx * (deltaTime / 16);
            p.y += this.vy * (deltaTime / 16);
            
            if (p.life <= 0) {
                releaseFireParticle(p);
                this.fireParticles.splice(i, 1);
            }
        }

        // 3. Apply Fire Damage (DoT)
        // If the ship is on fire, it takes damage over time.
        if (this.fireParticles.length > 0) {
            // Damage scales with the number of active fire particles (intensity of fire)
            // Approx 0.02 HP per particle per second.
            const damage = 0.02 * this.fireParticles.length * (deltaTime / 1000);
            this.takeDamage(damage);
        }
    }

    _spawnFireParticle() {
        const p = getFireParticle();
        // Random position on deck
        const spreadLen = this.shipLength * 0.8;
        const spreadWidth = this.shipWidth * 0.6;
        const lx = (Math.random() - 0.5) * spreadLen;
        const ly = (Math.random() - 0.5) * spreadWidth;
        
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        p.x = this.x + (lx * cos - ly * sin);
        p.y = this.y + (lx * sin + ly * cos);
        
        p.life = 400 + Math.random() * 400; // Short life for flickering effect
        p.maxLife = p.life;
        p.size = 10 + Math.random() * 15;
        p.rotation = Math.random() * Math.PI * 2;
        
        this.fireParticles.push(p);
    }

    /**
     * Updates smoke particles and spawns new ones if damaged.
     * @private
     */
    _updateSmoke(deltaTime, windDirection) {
        // 1. Spawn new smoke if damaged (and not fully sunk)
        const damageThreshold = this.maxHp * 0.5;
        const sinkProgress = this.isSinking ? (this.sinkHp / this.maxSinkHp) : 0;

        // Continue smoking until 70% submerged
        if (this.hp < damageThreshold && sinkProgress < 0.7) {
            // Intensity 0.0 (at 50% HP) -> 1.0 (at 0% HP)
            // Clamp intensity to 1.2 to prevent massive spread on overkill damage (negative HP)
            const intensity = Math.min(1.2, 1.0 - (this.hp / damageThreshold));
            
            // Spawn Rate: Increases with intensity.
            // Base: ~0.06/frame (1 per 16 frames). Max: ~1.0/frame.
            const spawnRate = 0.004 + (intensity * 0.06); 
            const count = Math.floor(spawnRate * deltaTime);
            const remainder = (spawnRate * deltaTime) - count;
            
            const toSpawn = count + (Math.random() < remainder ? 1 : 0);
            
            for (let i = 0; i < toSpawn; i++) {
                this._spawnSmokeParticle(intensity, windDirection);
            }
        }

        // 2. Update existing particles
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const p = this.smokeParticles[i];
            p.life -= deltaTime;
            // Move with wind + momentum
            p.x += p.vx * (deltaTime / 16);
            p.y += p.vy * (deltaTime / 16);
            p.size += 0.05 * (deltaTime / 16); // Expand
            p.rotation += p.rotSpeed * (deltaTime / 16);
            
            if (p.life <= 0) {
                releaseSmokeParticle(p);
                this.smokeParticles.splice(i, 1);
            }
        }
    }

    /**
     * Spawns a single smoke particle.
     * @private
     */
    _spawnSmokeParticle(intensity, windDirection) {
        // Spread increases with intensity (more fires breaking out)
        const spreadLen = this.shipLength * (0.2 + 0.6 * intensity); 
        const spreadWidth = this.shipWidth * 0.6;
        
        // Random position on deck (Local)
        const lx = (Math.random() - 0.5) * spreadLen;
        const ly = (Math.random() - 0.5) * spreadWidth;
        
        // Rotate to World
        const cos = Math.cos(this.angle); const sin = Math.sin(this.angle);
        const wx = this.x + (lx * cos - ly * sin);
        const wy = this.y + (lx * sin + ly * cos);
        
        // Velocity: Wind Drift + Partial Ship Momentum
        const windSpeed = 0.5 + Math.random() * 0.5;
        const vx = Math.cos(windDirection) * windSpeed + (this.vx * 0.2);
        const vy = Math.sin(windDirection) * windSpeed + (this.vy * 0.2);

        // Darkness: Higher intensity = Darker smoke
        // Remap intensity so it reaches 1.0 (Black) at 0.8 intensity (10% HP)
        const colorIntensity = intensity / 0.8;
        const darkness = colorIntensity + (Math.random() * 0.2 - 0.1);

        const p = getSmokeParticle();
        p.x = wx; p.y = wy; p.vx = vx; p.vy = vy;
        p.life = 1000 + Math.random() * 1000; p.maxLife = 2000;
        p.size = 10 + Math.random() * 20;
        p.rotation = Math.random() * Math.PI * 2;
        p.rotSpeed = (Math.random() - 0.5) * 0.05;
        p.darkness = Math.max(0, darkness);
        
        this.smokeParticles.push(p);
    }

    /**
     * Updates the wake trail history by recording current emitter positions.
     * @private
     */
    _updateWake(deltaTime) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        
        // --- NEW: Calculate ripple fluctuation based on time for new points ---
        const time = performance.now(); // Get current time once for both calculations
        
        // Sum of sines for organic variation (Performance cost is negligible)
        const bowRipple = 0.95 + (
            Math.sin(time * 0.02) + 
            Math.sin(time * 0.049 + 2.0) * 0.5 + 
            Math.sin(time * 0.087 + 4.0) * 0.25
        ) * 0.04;

        const sternRipple = 0.95 + (
            Math.sin(time * 0.025) + 
            Math.sin(time * 0.057 + 1.5) * 0.7
        ) * 0.08;

        // Transform to world space and push to history
        for (let i = 0; i < 4; i++) {
            // OPTIMIZATION: Calculate emitter position inline to avoid array allocation
            let ex, ey;
            if (i === 0) { ex = this.shipLength * 0.5; ey = -this.shipWidth * 0.02; } // Port Bow
            else if (i === 1) { ex = this.shipLength * 0.5; ey = this.shipWidth * 0.02; } // Stbd Bow
            else if (i === 2) { ex = -this.shipLength * 0.45; ey = -this.shipWidth * 0.35; } // Port Stern
            else { ex = -this.shipLength * 0.45; ey = this.shipWidth * 0.35; } // Stbd Stern

            const wx = this.x + (ex * cos - ey * sin);
            const wy = this.y + (ex * sin + ey * cos);

            const trail = this.wakeHistory[i];
            
            // --- NEW: Calculate outward velocity for bow wakes ---
            let pVx = 0;
            let pVy = 0;
            
            // Only apply to bow wakes (0 and 1) to make them curve out
            if (i === 0) { // Port Bow
                // Outward is Left (-PI/2) relative to ship heading
                const outAngle = this.angle - Math.PI / 2;
                // --- MODIFIED: Reduced the impact of ship width on wake expansion ---
                // The multiplier now has a smaller range, making the effect more subtle.
                const expansionMultiplier = 0.9 + (this.shipWidth / SHIP_TARGET_WIDTH) * 0.1;
                const expansionSpeed = speed * expansionMultiplier * bowRipple; // Apply bow ripple
                pVx = Math.cos(outAngle) * expansionSpeed;
                pVy = Math.sin(outAngle) * expansionSpeed;
            } else if (i === 1) { // Stbd Bow
                // Outward is Right (+PI/2) relative to ship heading
                const outAngle = this.angle + Math.PI / 2;
                // --- MODIFIED: Reduced the impact of ship width on wake expansion ---
                const expansionMultiplier = 0.9 + (this.shipWidth / SHIP_TARGET_WIDTH) * 0.1;
                const expansionSpeed = speed * expansionMultiplier * bowRipple; // Apply bow ripple
                pVx = Math.cos(outAngle) * expansionSpeed;
                pVy = Math.sin(outAngle) * expansionSpeed;
            } else if (i === 2) { // Port Stern
                const outAngle = this.angle - Math.PI / 2;
                const expansionSpeed = speed * 0.15 * sternRipple; // Added physical expansion to stern
                pVx = Math.cos(outAngle) * expansionSpeed;
                pVy = Math.sin(outAngle) * expansionSpeed;
            } else { // Stbd Stern
                const outAngle = this.angle + Math.PI / 2;
                const expansionSpeed = speed * 0.15 * sternRipple;
                pVx = Math.cos(outAngle) * expansionSpeed;
                pVy = Math.sin(outAngle) * expansionSpeed;
            }

            // --- FIX: Distance Check ---
            // Only add a new point if we've moved far enough from the last one.
            // This prevents "streaking" (by allowing updates during slow drift)
            // and "stacking" (by preventing updates when stationary).
            let shouldAdd = true;
            if (trail.length > 0) {
                const last = trail[0];
                const distSq = (wx - last.x) ** 2 + (wy - last.y) ** 2;
                if (distSq < 4) shouldAdd = false; // Minimum 2 pixels movement
            }

            if (shouldAdd) {
                // Store the appropriate ripple as width multiplier for drawing
                const currentRipple = (i === 0 || i === 1) ? bowRipple : sternRipple;
                trail.unshift(getWakePoint(wx, wy, pVx, pVy, currentRipple));

                // --- MODIFIED: Use specific length for bow vs stern wakes ---
                const maxLength = (i === 0 || i === 1) ? BOW_WAKE_TRAIL_LENGTH : WAKE_TRAIL_LENGTH;

                if (trail.length > maxLength) { 
                    const removed = trail.pop();
                    releaseWakePoint(removed);
                }
            }
            
            // --- NEW: Update positions of existing points (Expansion) ---
            // Run for ALL trails so stern also ripples geometrically
            for (let j = 0; j < trail.length; j++) {
                const p = trail[j];
                p.x += p.vx;
                p.y += p.vy;
                // Decay velocity to simulate resistance/drag
                p.vx *= 0.9;
                p.vy *= 0.9;
            }
        }
    }

    /**
     * Draws the wake trails.
     * @private
     */
    _drawWake(ctx, scale) {
        if (!this.wakeHistory) return;

        const alpha = 0.5;
        ctx.fillStyle = 'white'; // Set color once, control opacity with globalAlpha
        const originalGlobalAlpha = ctx.globalAlpha;

        for (let t = 0; t < 4; t++) {
            const isBow = (t === 0 || t === 1);
            const trail = this.wakeHistory[t];
            if (trail.length < 2) continue;
            
            for (let i = 0; i < trail.length; i++) {
                const p = trail[i];
                
                // Calculate tangent vector (direction of trail at this point)
                let dx, dy;
                if (i === 0) {
                    dx = trail[1].x - p.x;
                    dy = trail[1].y - p.y;
                } else {
                    dx = p.x - trail[i-1].x;
                    dy = p.y - trail[i-1].y;
                }
                
                const len = Math.sqrt(dx*dx + dy*dy);
                if (len === 0) continue;
                
                // Calculate Normal vector (perpendicular to tangent)
                const nx = -dy / len;
                const ny = dx / len;

                // Taper width: Newest points (i=0) are widest, oldest are narrowest
                let ratio = 1 - (i / trail.length);

                // Only apply head taper to stern wakes (2, 3) to keep them from overlapping the hull.
                // Bow wakes (0, 1) should start at full width to represent spray/churn.
                if (!isBow) {
                    const headTaper = Math.min(1, i / 5);
                    ratio *= headTaper;
                }

                // --- MODIFIED: Increased width factor for bow wakes ---
                const currentMaxWidth = isBow ? this.shipWidth * 0.15 : this.shipWidth * 0.2;
                // --- MODIFIED: Use pre-calculated width from the point ---
                const currentWidth = currentMaxWidth * ratio * (p.width || 1.0);

                // Extrude vertices
                const offset = currentWidth * 0.5;

                wakeLeftX[i] = p.x + nx * offset;
                wakeLeftY[i] = p.y + ny * offset;
                wakeRightX[i] = p.x - nx * offset;
                wakeRightY[i] = p.y - ny * offset;
            }

            // --- OPTIMIZATION: Draw wake as alpha-faded segments to avoid gradient creation ---
            // This prevents creating new gradient objects every frame, reducing garbage collection pressure.
            for (let i = 0; i < trail.length - 1; i++) {
                const alphaRatio = 1 - (i / (trail.length - 1));
                const currentAlpha = alpha * alphaRatio;

                if (currentAlpha < 0.05) continue; // More aggressive culling for nearly invisible segments

                ctx.globalAlpha = currentAlpha;

                // --- NEW: Rounded Head for Bow Wakes ---
                // Draw a circle at the source point to create a rounded leading edge.
                if (i === 0 && isBow) {
                    ctx.beginPath();
                    const radius = Math.hypot(trail[0].x - wakeLeftX[0], trail[0].y - wakeLeftY[0]);
                    ctx.arc(trail[0].x, trail[0].y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.moveTo(wakeLeftX[i], wakeLeftY[i]);
                ctx.lineTo(wakeLeftX[i + 1], wakeLeftY[i + 1]);
                ctx.lineTo(wakeRightX[i + 1], wakeRightY[i + 1]);
                ctx.lineTo(wakeRightX[i], wakeRightY[i]);
                ctx.closePath();
                ctx.fill();
            }
        }
        
        ctx.globalAlpha = originalGlobalAlpha; // Restore alpha
    }

    /**
     * Updates the rotation of the sail and the animation of the pennant.
     * This is now part of the base class so all ships benefit from it.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _updateVisuals(windDirection) {
        // Update Sail Rotation
        let targetSailRotationRadians = 0;
        if (this.isSailOpen) {
            let windToShipAngle = normalizeAngle(windDirection - this.angle);
            if (windToShipAngle > Math.PI) { windToShipAngle -= 2 * Math.PI; }
            const absWindToShipAngleDegrees = Math.abs(windToShipAngle * 180 / Math.PI);
            let targetSailRotationDegrees = 0;
            if (absWindToShipAngleDegrees >= 10) {
                targetSailRotationDegrees = (-75 / 170) * (absWindToShipAngleDegrees - 10) + 75;
            }
            targetSailRotationRadians = -Math.sign(windToShipAngle) * (targetSailRotationDegrees * Math.PI / 180);
        }
        this.sailCurrentRelativeAngle += (targetSailRotationRadians - this.sailCurrentRelativeAngle) * SAIL_EASE_FACTOR;

        // Update Pennant Rotation and Wave Animation
        this.pennantWaveOffset = (this.pennantWaveOffset + this.pennantWaveSpeed) % (Math.PI * 2);
        const targetPennantRotation = normalizeAngle(windDirection - this.angle);

        // Find the shortest angle to rotate towards the target. This is the key fix.
        let angleDiff = targetPennantRotation - this.pennantCurrentRelativeAngle;
        if (angleDiff > Math.PI) { angleDiff -= 2 * Math.PI; }
        if (angleDiff < -Math.PI) { angleDiff += 2 * Math.PI; }

        // Apply the eased rotation and normalize the final angle
        this.pennantCurrentRelativeAngle += angleDiff * this.pennantEaseFactor;
        this.pennantCurrentRelativeAngle = normalizeAngle(this.pennantCurrentRelativeAngle);
    }

    /**
     * Updates the reload timers for cannons.
     * @param {number} deltaTime - Time elapsed since last frame in milliseconds.
     */
    updateReloadTimers(deltaTime) {
        this.portCannonReloadTime = Math.max(0, this.portCannonReloadTime - deltaTime);
        this.starboardCannonReloadTime = Math.max(0, this.starboardCannonReloadTime - deltaTime);
        this.bowCannonReloadTime = Math.max(0, this.bowCannonReloadTime - deltaTime);
        this.sternCannonReloadTime = Math.max(0, this.sternCannonReloadTime - deltaTime);
    }

    /**
     * Applies generic physics effects, world boundaries, and HP regeneration.
     * Player-specific logic like anchor constraints is handled in the PlayerShip subclass.
     * @param {number} windDirection - The current wind direction in radians.
     */
    applyPhysicsAndBoundaries(windDirection) {
        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Apply wind drift, but reduce it by half if the ship is moving backward.
        let currentDriftSpeed = WIND_DRIFT_SPEED;
        if (this.isMovingBackward) {
            currentDriftSpeed *= 0.5;
        }
        this.vx += Math.cos(windDirection + Math.PI) * currentDriftSpeed;
        this.vy += Math.sin(windDirection + Math.PI) * currentDriftSpeed;

        // --- NEW: Rotational Wind Drift ---
        // If the ship is stationary (not anchored and not moving), the wind will slowly rotate it
        // to be parallel with the wind direction.
        const currentSpeed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
        if (!this.isAnchored && currentSpeed < MIN_TURNING_SPEED_FOR_RADIUS) {
            const downwindAngle = normalizeAngle(windDirection + Math.PI);
            const upwindAngle = normalizeAngle(windDirection);

            // Find the shortest angle difference to either downwind or upwind alignment.
            let angleDiffDownwind = normalizeAngle(downwindAngle - this.angle);
            if (angleDiffDownwind > Math.PI) angleDiffDownwind -= 2 * Math.PI;

            let angleDiffUpwind = normalizeAngle(upwindAngle - this.angle);
            if (angleDiffUpwind > Math.PI) angleDiffUpwind -= 2 * Math.PI;

            // Favor pointing downwind slightly if the ship is perfectly perpendicular.
            if (Math.abs(Math.abs(angleDiffDownwind) - Math.abs(angleDiffUpwind)) < 0.1) {
                angleDiffUpwind += Math.sign(angleDiffUpwind) * 0.2;
            }

            // Choose the closer of the two stable angles as the target.
            const rotationDirection = (Math.abs(angleDiffDownwind) < Math.abs(angleDiffUpwind)) ? angleDiffDownwind : angleDiffUpwind;

            // Apply a small rotational force to ease the ship towards the target angle.
            this.angle += rotationDirection * WIND_DRIFT_ROTATION_FACTOR;
            this.angle = normalizeAngle(this.angle);
        }

        // --- NEW: Exponential Deceleration for Hazards ---
        // This creates a smooth but rapid slowdown effect that feels more like hitting mud or seaweed.
        if (this.isOverShoal) {
            // --- FIX: Base the target speed on the ship's POTENTIAL speed, not its current speed. ---
            // 1. Calculate the potential speed for this frame based on wind.
            const windMultiplier = (typeof this.getWindSpeedMultiplier === 'function') ? this.getWindSpeedMultiplier(this.angle, windDirection) : getWindSpeedMultiplier(this.angle, windDirection);
            const potentialSpeed = this.baseSpeed * windMultiplier * this.getDamageSpeedMultiplier();
            // 2. Determine the target "crawling speed" as a fraction of that potential.
            const targetSpeedFactor = (SHOAL_SLOW_FACTOR_EDGE + SHOAL_SLOW_FACTOR_CENTER) / 2;
            const targetSpeed = potentialSpeed * targetSpeedFactor;
            // 3. Create the target velocity vector.
            const targetVx = Math.cos(this.angle) * targetSpeed;
            const targetVy = Math.sin(this.angle) * targetSpeed;
            // Interpolate the current velocity towards the target velocity.
            this.vx += (targetVx - this.vx) * HAZARD_EASING_FACTOR;
            this.vy += (targetVy - this.vy) * HAZARD_EASING_FACTOR;
        }

        if (this.isOverCoralReef) {
            const windMultiplier = (typeof this.getWindSpeedMultiplier === 'function') ? this.getWindSpeedMultiplier(this.angle, windDirection) : getWindSpeedMultiplier(this.angle, windDirection);
            const potentialSpeed = this.baseSpeed * windMultiplier * this.getDamageSpeedMultiplier();
            const targetSpeed = potentialSpeed * CORAL_REEF_SLOW_FACTOR;
            const targetVx = Math.cos(this.angle) * targetSpeed;
            const targetVy = Math.sin(this.angle) * targetSpeed;
            this.vx += (targetVx - this.vx) * HAZARD_EASING_FACTOR;
            this.vy += (targetVy - this.vy) * HAZARD_EASING_FACTOR;
        }

        // --- NEW: Eased stop when colliding with an island ---
        // If the collision flag is set, rapidly ease the ship's velocity to zero.
        if (this.isAgainstIsland) {
            this.vx += (0 - this.vx) * HAZARD_EASING_FACTOR;
            this.vy += (0 - this.vy) * HAZARD_EASING_FACTOR;
        }

        // Keep ship within world boundaries
        const now = performance.now();
        const inCooldown = (now - this.lastDamageTime < REGENERATION_COOLDOWN_TIME);

        // --- NEW: Crew Regeneration Logic ---
        // Triggered exactly once when the cooldown expires (transition from active to inactive).
        if (!inCooldown && this.wasInCooldown) {
            if (this.hp > 0 && this.aiState !== 'surrendered' && this.crew < this.maxCrew) {
                const loss = this.maxCrew - this.crew;
                // Recover 50% of the loss
                const recovery = Math.floor(loss * 0.5);
                this.crew += recovery;
                // The new total becomes the new maximum (permanent loss of the unrecovered portion)
                this.maxCrew = this.crew;
            }
            this.wasInCooldown = false;
        }

        if (inCooldown) {
            this.wasInCooldown = true;
        }

        // --- FIX: Prevent regeneration if dead or surrendered ---
        if (this.hp > 0 && this.aiState !== 'surrendered' && !inCooldown) {
            // --- Hull Regeneration ---
            if (this.hp < this.maxHp) {
                // Accumulate potential repair amount (1 HP per second)
                this.repairAccumulator += (1 / 60);
                
                // Apply repair in discrete steps to allow for item consumption (e.g., every 0.1 HP)
                const REPAIR_STEP = 0.1;
                
                if (this.repairAccumulator >= REPAIR_STEP) {
                    // Requirement: 0.5 unit of Wood (Log or Timber) AND 0.5 unit of Iron Fittings per 1 HP restored.
                    const amountNeeded = REPAIR_STEP / 2;
                    
                    // Check if we have enough resources before consuming
                    if (this.hasItem('iron-fittings', amountNeeded) && (this.hasItem('log', amountNeeded) || this.hasItem('timber', amountNeeded))) {
                        this.consumeItem('iron-fittings', amountNeeded);
                        if (!this.consumeItem('log', amountNeeded)) {
                            this.consumeItem('timber', amountNeeded);
                        }
                        this.hp += REPAIR_STEP;
                        this.repairAccumulator -= REPAIR_STEP;
                    } else {
                        this.repairAccumulator = REPAIR_STEP; // Cap accumulator if resources missing
                    }
                }
            } else {
                this.repairAccumulator = 0;
            }

            // --- Rigging Regeneration ---
            if (this.rigHp < this.maxRigHp) {
                this.rigRepairAccumulator += (1 / 60);
                const REPAIR_STEP = 0.1;

                if (this.rigRepairAccumulator >= REPAIR_STEP) {
                    // Requirement: 1 unit of Rope/Canvas per 2 HP (0.5 per 1 HP)
                    // Requirement: 1 unit of Spars per 5 HP (0.2 per 1 HP)
                    const ropeCanvasNeeded = REPAIR_STEP * 0.5;
                    const sparNeeded = REPAIR_STEP * 0.2;

                    const hasCanvas = this.hasItem('cotton-roll', ropeCanvasNeeded) || this.hasItem('hemp-roll', ropeCanvasNeeded) || this.hasItem('canvas', ropeCanvasNeeded);

                    if (this.hasItem('hemp-rope', ropeCanvasNeeded) && this.hasItem('spars', sparNeeded) && hasCanvas) {
                        this.consumeItem('hemp-rope', ropeCanvasNeeded);
                        this.consumeItem('spars', sparNeeded);
                        // Consume canvas (try cotton, then hemp, then generic)
                        if (!this.consumeItem('cotton-roll', ropeCanvasNeeded)) {
                            if (!this.consumeItem('hemp-roll', ropeCanvasNeeded)) {
                                this.consumeItem('canvas', ropeCanvasNeeded);
                            }
                        }
                        this.rigHp += REPAIR_STEP;
                        this.rigRepairAccumulator -= REPAIR_STEP;
                    } else {
                        this.rigRepairAccumulator = REPAIR_STEP;
                    }
                }
            } else {
                this.rigRepairAccumulator = 0;
            }
        } else {
            this.repairAccumulator = 0;
            this.rigRepairAccumulator = 0;
        }
        this.hp = Math.min(this.hp, this.maxHp); // Clamp HP to maxHp
        this.rigHp = Math.min(this.rigHp, this.maxRigHp); // Clamp Rig HP

        // --- NEW: Crew Recovery ---
        // Crew that successfully boarded return slowly over time.
        if (this.recoveringCrew > 0) {
            this.crewRecoveryAccumulator += (1 / 60); // Assuming 60 FPS
            if (this.crewRecoveryAccumulator >= 1.0) { // Recover 1 crew per second (matches Hull HP regen)
                this.crew = Math.min(this.crew + 1, this.maxCrew);
                this.recoveringCrew--;
                this.crewRecoveryAccumulator = 0;
            }
        }
    }

    /**
     * Applies an external force to the ship, affecting its velocity.
     * @param {{x: number, y: number}} force - Force vector.
     */
    applyForce(force) {
        this.vx += force.x;
        this.vy += force.y;
    }

    /**
     * Draws the ship on the canvas in world space.
     * Assumes the global canvas context has already been transformed by the camera.
     * Subclasses can override this to add specific visuals (e.g., HP bars, status effects).
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawWorldSpace(ctx, worldToScreenScale, windDirection, renderMode = 'full') {
        // Draw wake only if we are drawing the hull or full ship
        if (renderMode !== 'sinking-effects') {
            // --- NEW: Hide wake when mostly submerged ---
            const sinkProgress = this.isSinking ? (this.sinkHp / this.maxSinkHp) : 0;
            if (sinkProgress <= 0.5) {
                this._drawWake(ctx, worldToScreenScale);
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
                this._drawSinkingRings(ctx, worldToScreenScale, underOpacity);
            }
            const canvas = Ship.getSharedSinkingCanvas();
            const bCtx = canvas.getContext('2d');
            const diag = Math.sqrt(this.shipLength ** 2 + this.shipWidth ** 2);
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
            this._drawShipComponents(bCtx, worldToScreenScale, windDirection);
            
            bCtx.globalCompositeOperation = 'source-atop';
            bCtx.rotate(this.sinkAngle);
            
            const extent = size / 2; 
            const currentY = extent - (extent * 2 * progress);
            
            bCtx.beginPath();
            const baseAmp = 4 / worldToScreenScale; // Reduced base amp since we sum multiple waves
            const time = performance.now();
            
            for (let x = -extent; x <= extent; x += (5 / worldToScreenScale)) {
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
            this._drawShipComponents(ctx, worldToScreenScale, windDirection);
            ctx.restore();
        }

        // --- NEW: Draw Fire & Smoke (World Space, On Top) ---
        this._drawFire(ctx);
        // --- NEW: Draw Smoke (World Space, On Top) ---
        this._drawSmoke(ctx, worldToScreenScale);

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

            if (overOpacity > 0) {
                this._drawSinkingRings(ctx, worldToScreenScale, overOpacity);
            }

            // Bubbles are always on top
            this._drawSinkingBubbles(ctx, worldToScreenScale);
        }

        // --- Debug Dots for Bow and Stern ---
        if (DEBUG.ENABLED && DEBUG.DRAW_BOW_STERN_MARKERS) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(SHIP_BOW_LOCAL_X_OFFSET, 0, 5 / worldToScreenScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(SHIP_STERN_LOCAL_X_OFFSET, 0, 5 / worldToScreenScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // --- Debug Dots for Spar Points ---
        if (DEBUG.ENABLED && DEBUG.DRAW_SPAR_POINTS) {
            ctx.save();
            // The spar is rotated with the sail, so we need to apply that rotation first.
            ctx.rotate(this.sailCurrentRelativeAngle);
            
            // --- New: Draw Bezier Control Arms for Spar ---
            const scaledSparPoints = this.sparPoints.map(pt => ({ x: pt.x + this.sparOffsetX, y: pt.y + this.sparOffsetY }));
            
            // Draw control arms (thin black lines)
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1; // A thin 1px line, regardless of zoom
            ctx.beginPath();
            // Right side arms
            ctx.moveTo(scaledSparPoints[1].x, scaledSparPoints[1].y); // Top-right
            ctx.lineTo(scaledSparPoints[6].x, scaledSparPoints[6].y); // Control point
            ctx.lineTo(scaledSparPoints[2].x, scaledSparPoints[2].y); // Mid-right
            ctx.lineTo(scaledSparPoints[7].x, scaledSparPoints[7].y); // Control point
            ctx.lineTo(scaledSparPoints[3].x, scaledSparPoints[3].y); // Bottom-right
            // Left side arms
            ctx.moveTo(scaledSparPoints[4].x, scaledSparPoints[4].y); // Bottom-left
            ctx.lineTo(scaledSparPoints[8].x, scaledSparPoints[8].y); // Control point
            ctx.lineTo(scaledSparPoints[5].x, scaledSparPoints[5].y); // Mid-left
            ctx.lineTo(scaledSparPoints[9].x, scaledSparPoints[9].y); // Control point
            ctx.lineTo(scaledSparPoints[0].x, scaledSparPoints[0].y); // Top-left
            ctx.stroke();

            // Draw vertex points (red dots)
            ctx.fillStyle = 'red';
            // Only draw the 6 vertices
            this.sparPoints.slice(0, 6).forEach(point => {
                const x = point.x + this.sparOffsetX;
                const y = point.y + this.sparOffsetY;
                ctx.fillRect(x - (2 / worldToScreenScale), y - (2 / worldToScreenScale), 4 / worldToScreenScale, 4 / worldToScreenScale);
            });

            // Draw control handles (white dots) on top
            ctx.fillStyle = 'white';
            // Draw the 4 new control points
            this.sparPoints.slice(6).forEach(point => {
                const x = point.x + this.sparOffsetX;
                const y = point.y + this.sparOffsetY;
                ctx.fillRect(x - (2 / worldToScreenScale), y - (2 / worldToScreenScale), 4 / worldToScreenScale, 4 / worldToScreenScale);
            });

            ctx.restore();
        }

    }

    /**
     * Draws the smoke particles using cached gradients.
     * @private
     */
    _drawSmoke(ctx, scale) {
        if (this.smokeParticles.length === 0) return;

        for (const p of this.smokeParticles) {
            const texture = Ship.getSmokeTexture(p.darkness);
            const alpha = (p.life / p.maxLife) * 0.8; // Max opacity 0.8
            
            ctx.globalAlpha = alpha;
            
            // OPTIMIZATION: Manual transform instead of save/restore
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            
            const size = p.size * 2; // Texture is 32x32, p.size is radius-like. Original scale was p.size/16.
            ctx.drawImage(texture, -size/2, -size/2, size, size);
            
            ctx.rotate(-p.rotation);
            ctx.translate(-p.x, -p.y);
        }
        ctx.globalAlpha = 1.0;
    }

    _drawFire(ctx) {
        if (this.fireParticles.length === 0) return;
        
        const texture = Ship.getFireTexture();
        ctx.globalCompositeOperation = 'lighter';
        
        for (const p of this.fireParticles) {
            const alpha = (p.life / p.maxLife); 
            ctx.globalAlpha = alpha;
            
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            
            const s = p.size * (0.8 + Math.random() * 0.4); // Flicker size
            ctx.drawImage(texture, -s/2, -s/2, s, s);
            
            ctx.rotate(-p.rotation);
            ctx.translate(-p.x, -p.y);
        }
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }

    /**
     * Draws the churning bubbles for a sinking ship.
     * @private
     */
    _drawSinkingBubbles(ctx, worldToScreenScale) {
        if (!this.sinkParticles || this.sinkParticles.length === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle); // Rotate with ship so bubbles emerge from hull

        // OPTIMIZATION: Use globalAlpha instead of string parsing for color
        ctx.fillStyle = '#FFFFFF';
        for (const p of this.sinkParticles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.globalAlpha = p.life * 0.6;
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * Helper to calculate a point on the sinking ring wave.
     * @private
     */
    _calculateSinkRingPoint(t, ring, phaseOffset, outPoint) {
        const baseWave = Math.sin(t * ring.freq + phaseOffset) * ring.amp;
        const noise = Math.sin(t * 20 + phaseOffset) * (ring.amp * 0.05);
        const rX = ring.rX + baseWave + noise;
        const rY = ring.rY + baseWave + noise;
        outPoint.x = Math.cos(t) * rX;
        outPoint.y = Math.sin(t) * rY;
        return outPoint;
    }

    /**
     * Draws the agitated water rings for a sinking ship.
     * @private
     */
    _drawSinkingRings(ctx, worldToScreenScale, opacityMultiplier = 1.0) {
        if (!this.sinkRings || this.sinkRings.length === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // OPTIMIZATION: Use globalAlpha instead of string parsing for color
        ctx.fillStyle = '#FFFFFF';
        for (const ring of this.sinkRings) {
            ctx.globalAlpha = ring.alpha * opacityMultiplier;
            
            // Approximate circumference of an ellipse: 2 * PI * sqrt((a^2 + b^2) / 2)
            const circumference = 2 * Math.PI * Math.sqrt((ring.rX * ring.rX + ring.rY * ring.rY) / 2);
            
            const numDashes = ring.numDashes || 6; // Use fixed count
            
            // Draw two interlaced waves. The interference pattern creates the "marquise" shapes.
            for (let k = 0; k < 2; k++) {
                const phaseOffset = k * Math.PI; // Offset second wave by 180 degrees
                
                ctx.beginPath();
                
                for (let j = 0; j < numDashes; j++) {
                    // Select variation deterministically based on index
                    const variant = SINK_RING_VARIATIONS[j % SINK_RING_VARIATIONS.length];
                    const segmentArc = circumference / numDashes;
                    const dashLength = segmentArc * variant.len;
                    const dashWidth = dashLength / variant.ratio;

                    // Rotate the dashes so they orbit, masking the spacing jitter
                    const theta = (j / numDashes) * Math.PI * 2 + ring.rotation;

                    // --- Bending Logic ---
                    // Calculate angular span of the dash based on current radius
                    const safeR = Math.max((ring.rX + ring.rY) / 2, 1); // Use average radius for span calc
                    const halfSpan = (dashLength / 2) / safeR;

                    // Sample points along the curve for Front and Back
                    // Use the shared temp point for calculations. We copy values immediately to local vars.
                    this._calculateSinkRingPoint(theta - halfSpan, ring, phaseOffset, tempSinkPoint);
                    const pBackX = tempSinkPoint.x, pBackY = tempSinkPoint.y;

                    this._calculateSinkRingPoint(theta + halfSpan, ring, phaseOffset, tempSinkPoint);
                    const pFrontX = tempSinkPoint.x, pFrontY = tempSinkPoint.y;
                    
                    this._calculateSinkRingPoint(theta, ring, phaseOffset, tempSinkPoint);
                    const pCenterX = tempSinkPoint.x, pCenterY = tempSinkPoint.y;
                    
                    // Calculate normal vector from the chord (Back -> Front)
                    const dx = pFrontX - pBackX;
                    const dy = pFrontY - pBackY;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 0.001) {
                        const nx = -dy / len; // Normal X
                        const ny = dx / len;  // Normal Y
                        const halfW = dashWidth / 2; // Use the varied width
                        
                        // Calculate Chord Midpoint
                        const mx = (pBackX + pFrontX) / 2;
                        const my = (pBackY + pFrontY) / 2;

                        // Calculate Control Points to ensure the curve passes through the desired width at the center.
                        // Formula: ControlPoint = 2 * PeakPoint - Midpoint
                        // PeakPoint is (pCenter +/- normal * halfW)
                        
                        const cpTopX = 2 * (pCenterX + nx * halfW) - mx;
                        const cpTopY = 2 * (pCenterY + ny * halfW) - my;
                        
                        const cpBottomX = 2 * (pCenterX - nx * halfW) - mx;
                        const cpBottomY = 2 * (pCenterY - ny * halfW) - my;

                        ctx.moveTo(pBackX, pBackY);
                        ctx.quadraticCurveTo(cpTopX, cpTopY, pFrontX, pFrontY);
                        ctx.quadraticCurveTo(cpBottomX, cpBottomY, pBackX, pBackY);
                    }
                }
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /**
     * Helper to draw all ship components (hull, sails, etc.) to the provided context.
     * Assumes context is already transformed to ship's local space.
     * @private
     */
    _drawShipComponents(ctx, worldToScreenScale, windDirection) {
        if (this.shipCacheCanvas) {
            ctx.drawImage(this.shipCacheCanvas, this.shipCacheOffset.x, this.shipCacheOffset.y);
        } else {
            // this._drawCachedBaseShip(ctx, worldToScreenScale);
        }

        ctx.fillStyle = MAST_BASE_COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, this.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(this.sailCurrentRelativeAngle);

        let currentSailWidthScale = 1.0;
        if (this.isSailOpen) {
            const effectiveSpeedMultiplier = getWindSpeedMultiplier(this.angle, windDirection);
            if (this.isReefed) {
                currentSailWidthScale = 1 + (effectiveSpeedMultiplier * REEFING_SPEED_PENALTY);
            } else {
                currentSailWidthScale = 1 + effectiveSpeedMultiplier;
            }
        }

        // --- NEW: Draw Tattered Sail from Cache ---
        this._updateSailCache(); // Check if cache needs refresh
        
        if (this.sailCacheCanvas) {
            // We need to apply the reefing scale (currentSailWidthScale) to the cached image.
            // The cache is unscaled.
            // The sail scales relative to SAIL_STRAIGHT_EDGE_LOCAL_X.
            
            ctx.save();
            // Translate to the pivot axis
            ctx.translate(SAIL_STRAIGHT_EDGE_LOCAL_X + this.sailOffsetX, this.sailOffsetY);
            // Apply reefing scale
            ctx.scale(currentSailWidthScale, 1.0);
            // Translate back
            ctx.translate(-(SAIL_STRAIGHT_EDGE_LOCAL_X + this.sailOffsetX), -this.sailOffsetY);
            
            // Draw the cache
            ctx.drawImage(this.sailCacheCanvas, this.sailCacheOffset.x, this.sailCacheOffset.y);
            ctx.restore();
        }

        // Draw Stroke
        ctx.save();
        // Apply the same transforms as the fill (reefing)
        ctx.translate(SAIL_STRAIGHT_EDGE_LOCAL_X + this.sailOffsetX, this.sailOffsetY);
        ctx.scale(currentSailWidthScale, 1.0);
        ctx.translate(-(SAIL_STRAIGHT_EDGE_LOCAL_X + this.sailOffsetX), -this.sailOffsetY);

        // Re-define the path for stroking/clipping
        ctx.beginPath();
        this.sailVisualPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();

        ctx.clip();
        ctx.strokeStyle = this.sailStrokeColor;
        ctx.lineWidth = 2 / worldToScreenScale;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = lightenColor(MAST_BASE_COLOR, 20);
        ctx.beginPath();
        const p = this.squareYardPoints.map(pt => ({ x: (pt.x + this.squareYardOffsetX), y: (pt.y + this.squareYardOffsetY) }));
        
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.quadraticCurveTo(p[6].x, p[6].y, p[2].x, p[2].y);
        ctx.quadraticCurveTo(p[7].x, p[7].y, p[3].x, p[3].y);
        ctx.lineTo(p[4].x, p[4].y);
        ctx.quadraticCurveTo(p[8].x, p[8].y, p[5].x, p[5].y);
        ctx.quadraticCurveTo(p[9].x, p[9].y, p[0].x, p[0].y);

        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = ANCHOR_LINE_COLOR;
        ctx.lineWidth = 1 / worldToScreenScale;
        ctx.lineCap = 'round';
        const numLashings = 6;
        const totalLength = SPAR_TARGET_LENGTH;
        const spacing = totalLength / (numLashings + 1);

        for (let i = 1; i <= numLashings; i++) {
            const y = -totalLength / 2 + i * spacing;
            let minX = Infinity;
            let maxX = -Infinity;

            for (let j = 0; j < 6; j++) {
                const p1 = this.squareYardPoints[j];
                const p2 = this.squareYardPoints[(j + 1) % 6];

                if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                    const intersectX = (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y) + p1.x;
                    minX = Math.min(minX, intersectX);
                    maxX = Math.max(maxX, intersectX);
                }
            }

            if (isFinite(minX) && isFinite(maxX)) {
                ctx.beginPath();
                ctx.moveTo(minX + this.squareYardOffsetX, y + this.squareYardOffsetY);
                ctx.lineTo(maxX + this.squareYardOffsetX, y + this.squareYardOffsetY);
                ctx.stroke();
            }
        }

        ctx.lineCap = 'butt';
        ctx.restore();

        ctx.save();
        ctx.rotate(this.pennantCurrentRelativeAngle);

        const pennantBaseWidth = this.pennantWidth;
        const pennantActualLength = this.pennantLength;
        const numWavePoints = 10;
        const waveAmplitude = this.pennantWaveAmplitude;
        const waveFrequency = this.pennantWaveFrequency;
        const waveOffset = this.pennantWaveOffset;
        
        const topEdgePoints = [];
        const bottomEdgePoints = [];

        topEdgePoints.push({ x: 0, y: -pennantBaseWidth / 2 });
        bottomEdgePoints.push({ x: 0, y: pennantBaseWidth / 2 });

        for (let i = 1; i <= numWavePoints; i++) {
            const ratio = i / numWavePoints;
            const currentX = -pennantActualLength * ratio;
            const currentSegmentWidth = pennantBaseWidth * (1 - ratio);
            const waveY = Math.sin((currentX / pennantActualLength * waveFrequency * Math.PI * 2) + waveOffset) * waveAmplitude * (1 - ratio * 0.5);
            topEdgePoints.push({ x: currentX, y: -currentSegmentWidth / 2 + waveY });
            bottomEdgePoints.push({ x: currentX, y: currentSegmentWidth / 2 + waveY });
        }

        topEdgePoints.push({ x: -pennantActualLength, y: 0 });
        bottomEdgePoints.push({ x: -pennantActualLength, y: 0 });

        ctx.fillStyle = this.pennantColor;
        ctx.beginPath();
        ctx.moveTo(topEdgePoints[0].x, topEdgePoints[0].y);
        for (let i = 1; i < topEdgePoints.length; i++) {
            ctx.lineTo(topEdgePoints[i].x, topEdgePoints[i].y);
        }
        for (let i = bottomEdgePoints.length - 1; i >= 0; i--) {
            ctx.lineTo(bottomEdgePoints[i].x, bottomEdgePoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.pennantStrokeColor;
        ctx.lineWidth = 2 / worldToScreenScale;
        ctx.stroke();
        ctx.restore();

        ctx.restore();

        ctx.fillStyle = this.mastTopColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.mastTopRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draws a detailed, standalone preview of a cannon from pre-parsed SVG data.
     * This is a static method on the Ship class.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} canvasWidth - The width of the preview canvas.
     * @param {number} canvasHeight - The height of the preview canvas.
     */
    static drawCannonPreview(ctx, canvasWidth, canvasHeight) {
        // The desired height of the cannon carriage will be 1/3 of the canvas height.
        const desiredCarriageHeight = canvasHeight / 3;

        // The original SVG rect has a width of ~166 and height of ~314.
        // We are displaying it horizontally, so the original "height" (314) is our length,
        // and the original "width" (166) is our height for scaling purposes.
        const carriageBaseWidth_svg = 166;

        // Calculate the scale needed to achieve the desired display height.
        const scale = desiredCarriageHeight / carriageBaseWidth_svg;

        // The desired width for the preview is based on this scale.
        const desiredCarriageWidth = 314 * scale;

        // Center the cannon in the preview window.
        // _drawDetailedCannon draws the cannon ending at x (front), centered vertically at y.
        // So we want x to be the right edge of the centered box, and y to be the vertical center.
        const x = (canvasWidth + desiredCarriageWidth) / 2;
        const y = canvasHeight / 2;

        // We can now use the same drawing logic as the in-game cannon,
        // but we pass `1` for the zoomLevel since we are already in a 2D canvas context.
        // We also need a temporary 'ship' object to call the method.
        const tempShip = new Ship(0, 0, '', 0, 0, 0);
        tempShip._drawDetailedCannon(ctx, x, y, desiredCarriageWidth, 0, 1);
    }

    /**
     * Draws a single detailed cannon, positioned and scaled for in-game rendering.
     * This logic is adapted from the original static drawCannonPreview method.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} x - The local X position to start drawing (relative to ship center).
     * @param {number} y - The local Y position to start drawing (relative to ship center).
     * @param {number} desiredCarriageWidth - The target width for the cannon carriage in world units.
     * @param {number} rotation - The rotation in radians.
     * @param {number} zoomLevel - The current game zoom level for scaling strokes.
     * @private
     */
    _drawDetailedCannon(ctx, x, y, desiredCarriageWidth, rotation, worldToScreenScale) {
        // --- Base Dimensions from SVG (for ratio calculations) ---
        const carriageBaseLength_svg = 314; // This is the cannon's length (barrel direction)
        const carriageBaseWidth_svg = 166;

        // --- Scaling ---
        // The scale is determined by making the SVG's length match our desired in-game width.
        const scale = desiredCarriageWidth / carriageBaseLength_svg;
        const finalLength = desiredCarriageWidth;
        const finalHeight = carriageBaseWidth_svg * scale;

        ctx.save();
        // Translate and rotate to the correct position on the ship's deck.
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // The cannon is drawn with its barrel along the +X axis. We shift it
        // so that its front edge aligns with the provided (x, y) coordinates.
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
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.rect(shorterCheekX, rectY + finalHeight - cheekHeight, shorterCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.rect(evenShorterCheekX, rectY + finalHeight - cheekHeight, evenShorterCheekWidth, cheekHeight);
        ctx.fillStyle = carriageFill;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = carriageStroke;
        ctx.lineWidth = carriageStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
        ctx.stroke();
        ctx.restore();

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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
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
        ctx.lineWidth = barrelStrokeWidth / worldToScreenScale;
        ctx.stroke();
        ctx.restore();

        ctx.restore(); // Restore from the initial translation/rotation
    }
}
