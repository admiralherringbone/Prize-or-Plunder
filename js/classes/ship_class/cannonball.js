class Cannonball {
    static pool = [];

    static get(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        if (Cannonball.pool.length > 0) {
            const ball = Cannonball.pool.pop();
            ball.init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
            return ball;
        }
        return new Cannonball(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    static release(ball) {
        Cannonball.pool.push(ball);
    }

    constructor(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        this.init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    init(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        // The cannonball's final velocity is its own speed plus the velocity of the ship that fired it.
        this.vx = Math.cos(angle) * speed + inheritedVx;
        this.vy = Math.sin(angle) * speed + inheritedVy;
        this.owner = owner; // The ship that fired this cannonball
        this.distanceTraveled = 0;
        this.initialX = x;
        this.initialY = y;
        this.markedForRemoval = false; // Flag for cleanup
        this.type = 'cannonball'; // Optimization for spatial grid checks
        this.maxDistance = CANNONBALL_MAX_TRAVEL_DISTANCE; // Default max distance

        // --- FIX: Nudge the cannonball forward one frame's worth of movement. --- // This prevents the cannonball from spawning inside its owner and causing an // immediate self-collision, which was the root cause of the "tunneling" issue.
        this.x += this.vx * (1 / 60); // Assuming 60 FPS for a 1-frame nudge.
        this.y += this.vy * (1 / 60);

        // --- OPTIMIZATION: Cache AABB to avoid allocation per frame ---
        this.aabb = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        this._updateAABB();
    }

    getAABB() {
        return this.aabb;
    }

    _updateAABB() {
        this.aabb.minX = this.x - this.radius;
        this.aabb.minY = this.y - this.radius;
        this.aabb.maxX = this.x + this.radius;
        this.aabb.maxY = this.y + this.radius;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this._updateAABB(); // Update cached AABB
        this.distanceTraveled = distance({ x: this.initialX, y: this.initialY }, { x: this.x, y: this.y });
    }

    static get tracerSprite() {
        if (!this._tracerSprite) {
            const c = document.createElement('canvas');
            c.width = 256; 
            c.height = 32;
            const cCtx = c.getContext('2d');
            // Gradient from transparent (left/tail) to white (right/head)
            const g = cCtx.createLinearGradient(0, 0, 256, 0);
            g.addColorStop(0, 'rgba(255, 255, 255, 0)');
            g.addColorStop(1, 'rgba(255, 255, 255, 1.0)');
            cCtx.fillStyle = g;
            // Draw a tapered triangle shape
            cCtx.beginPath();
            cCtx.moveTo(0, 16); // Tail tip center
            cCtx.lineTo(256, 0); // Head top
            cCtx.lineTo(256, 32); // Head bottom
            cCtx.fill();
            this._tracerSprite = c;
        }
        return this._tracerSprite;
    }

    static get smokyTracerSprite() {
        if (!this._smokyTracerSprite) {
            const c = document.createElement('canvas');
            c.width = 256; 
            c.height = 64; // Wider for a softer look
            const cCtx = c.getContext('2d');
            
            // Add blur effect using shadow
            cCtx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            cCtx.shadowBlur = 15;

            // Gradient from transparent (tail) to semi-transparent white (head)
            const g = cCtx.createLinearGradient(0, 0, 256, 0);
            g.addColorStop(0, 'rgba(255, 255, 255, 0)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
            cCtx.fillStyle = g;
            // Draw a rectangle slightly smaller than canvas to allow blur to spread
            cCtx.fillRect(0, 16, 256, 32);
            this._smokyTracerSprite = c;
        }
        return this._smokyTracerSprite;
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // --- NEW: Tracer Trail Effect ---
        // Draws a fading white line opposite to the velocity vector to simulate motion blur/tracers.
        // --- OPTIMIZATION: Use a pre-rendered sprite for the tracer ---
        // This supports dynamic length (drag) and rotation (curving) without
        // the performance cost of creating a new gradient every frame.

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.0) {
            // Dynamic length: You can now easily link this to speed (e.g., speed * 2)
            const trailLength = this.radius * 32; 
            const angle = Math.atan2(this.vy, this.vx);

            ctx.save();
            ctx.rotate(angle);
            // Draw the sprite extending backwards from (0,0)
            // The sprite is 256px long. We scale it to 'trailLength'.
            // The sprite is 32px high. We scale it to 'radius * 2'.
            // We draw it from -trailLength to 0 so the white head lands on the ball.
            ctx.drawImage(Cannonball.tracerSprite, -trailLength, -this.radius, trailLength, this.radius * 2);
            ctx.restore();
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Represents a Chain Shot projectile.
 * Two half-balls connected by a chain, spinning through the air.
 */
class ChainShot extends Cannonball {
    static pool = [];

    static get(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        if (ChainShot.pool.length > 0) {
            const ball = ChainShot.pool.pop();
            ball.init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
            return ball;
        }
        return new ChainShot(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    static release(ball) {
        ChainShot.pool.push(ball);
    }

    constructor(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        // This call is a bit redundant but necessary to satisfy the 'super' call requirement.
        // The real initialization happens in init().
        super(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy) {
        // Chain Shot Mechanics:
        // Speed is 1/2 normal.
        // Collision box is a circle with diameter = full length.
        // Full length = 2 * Radius (ends) + 8 * Radius (chain) = 10 * Radius.
        // Collision Radius = 5 * Radius.
        const baseRadius = radius;
        const collisionRadius = baseRadius * 5; 
        const adjustedSpeed = speed * CHAIN_SHOT_SPEED_MULTIPLIER;

        super.init(x, y, angle, collisionRadius, adjustedSpeed, color, owner, inheritedVx, inheritedVy);

        this.baseRadius = baseRadius; // Store original radius for drawing
        this.spinAngle = 0;
        this.type = 'chain-shot';
        this.maxDistance = CANNONBALL_MAX_TRAVEL_DISTANCE * CHAIN_SHOT_RANGE_MULTIPLIER;
    }

    update() {
        super.update();
        this.spinAngle += CHAIN_SHOT_SPIN_SPEED;
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // --- NEW: Single Non-Spinning Tracer Trail ---
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.0) {
            const trailLength = this.radius * 5; 
            const angle = Math.atan2(this.vy, this.vx);

            ctx.save();
            ctx.globalAlpha = 0.7; 
            ctx.rotate(angle);
            ctx.drawImage(Cannonball.smokyTracerSprite, -trailLength, -this.radius, trailLength, this.radius * 2);
            ctx.restore();
        }
        
        // Rotate the entire assembly by the spin angle
        ctx.rotate(this.spinAngle);

        // --- Draw Tracers ---
        // Tracers follow the arc of the spin.
        const halfLen = this.radius; // The visual extent from center (approx collision radius)
        
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = this.baseRadius;
        ctx.lineCap = 'round';
        
        // Trail 1 (Behind Top/Right end)
        ctx.beginPath();
        ctx.arc(0, 0, halfLen - this.baseRadius, -3.2, 0); // Arc trail behind 0
        ctx.stroke();
        
        // Trail 2 (Behind Bottom/Left end)
        ctx.beginPath();
        ctx.arc(0, 0, halfLen - this.baseRadius, Math.PI - 3.2, Math.PI); // Arc trail behind PI
        ctx.stroke();
        ctx.restore();

        // --- Draw Chain Shot Sprite ---
        // Visual Length = 10 * baseRadius.
        // Center is at 0,0. 
        // Chain is 8 * baseRadius long (from -4R to 4R).
        
        const chainEnd = 4 * this.baseRadius;

        // Chain Links (Line of rings)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = this.baseRadius * 0.4;
        ctx.beginPath();
        ctx.moveTo(-chainEnd, 0);
        ctx.lineTo(chainEnd, 0);
        ctx.stroke();
        
        // Draw Links (Simple circles along the line)
        ctx.fillStyle = 'transparent';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        const numLinks = 4;
        const step = (chainEnd * 2) / numLinks;
        for(let i=0; i<=numLinks; i++) {
            ctx.beginPath();
            ctx.arc(-chainEnd + i*step, 0, this.baseRadius * 0.5, 0, Math.PI*2);
            ctx.stroke();
        }

        // Draw Half-Circles (Weights)
        ctx.fillStyle = '#111'; // Iron color
        
        // Right Weight (Facing Out)
        ctx.beginPath();
        ctx.arc(chainEnd, 0, this.baseRadius, -Math.PI/2, Math.PI/2);
        ctx.fill();
        
        // Left Weight (Facing Out)
        ctx.beginPath();
        ctx.arc(-chainEnd, 0, this.baseRadius, Math.PI/2, -Math.PI/2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * Represents a Grape Shot projectile.
 * A cluster of small balls that spread out over time.
 */
class GrapeShot extends Cannonball {
    static pool = [];

    static get(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        if (GrapeShot.pool.length > 0) {
            const ball = GrapeShot.pool.pop();
            ball.init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
            return ball;
        }
        return new GrapeShot(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    static release(ball) {
        GrapeShot.pool.push(ball);
    }

    constructor(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        // This call is a bit redundant but necessary to satisfy the 'super' call requirement.
        // The real initialization happens in init().
        super(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy) {
        // Mechanics: Speed 1/2, Range 1/2
        const adjustedSpeed = speed * GRAPE_SHOT_SPEED_MULTIPLIER;
        
        // The collision radius starts at the base radius (cluster size) and expands.
        super.init(x, y, angle, radius, adjustedSpeed, color, owner, inheritedVx, inheritedVy);

        this.baseRadius = radius;
        this.subBallRadius = radius * GRAPE_SHOT_SUB_RADIUS_FACTOR;
        this.spreadFactor = 1.0;
        this.type = 'grape-shot';
        this.maxDistance = CANNONBALL_MAX_TRAVEL_DISTANCE * GRAPE_SHOT_RANGE_MULTIPLIER;

        // Pre-calculate random offsets for the 15 balls within the unit circle.
        // We do this once to avoid math in the draw loop.
        if (!this.offsets) this.offsets = [];
        this.offsets.length = 0;
        for (let i = 0; i < GRAPE_SHOT_COUNT; i++) {
            // Random point inside circle: sqrt(random) ensures uniform distribution
            const r = Math.sqrt(Math.random()) * (this.baseRadius - this.subBallRadius);
            const theta = Math.random() * 2 * Math.PI;
            this.offsets.push({
                x: r * Math.cos(theta),
                y: r * Math.sin(theta)
            });
        }
    }

    update() {
        super.update();
        
        // Expand the spread over time
        if (this.spreadFactor < GRAPE_SHOT_MAX_SPREAD) {
            this.spreadFactor += GRAPE_SHOT_SPREAD_RATE;
        }

        // Update collision radius to encompass the spreading cluster
        this.radius = this.baseRadius * this.spreadFactor + this.subBallRadius;
        this._updateAABB();
    }

    static get ballSprite() {
        if (!this._ballSprite) {
            const size = 64;
            const center = size / 2;
            const ballRadius = size / 8; // 8px. Cloud radius is 32px (4x ball radius).
            
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // 1. Draw Cloud (Gradient) - Double the size of the ball
            const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
            grad.addColorStop(0, 'rgba(192, 192, 192, 0.9)'); // Light grey center
            grad.addColorStop(0.6, 'rgba(211, 211, 211, 0.3)'); // Fading light grey
            grad.addColorStop(1, 'rgba(220, 220, 220, 0)');   // Transparent edge
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(center, center, center, 0, Math.PI * 2);
            ctx.fill();

            // 2. Draw Ball
            ctx.fillStyle = '#202020'; // Dark iron
            ctx.beginPath();
            ctx.arc(center, center, ballRadius, 0, Math.PI * 2);
            ctx.fill();

            this._ballSprite = canvas;
        }
        return this._ballSprite;
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // --- NEW: Single Tracer Trail ---
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.0) {
            const trailLength = this.radius * 5; 
            const angle = Math.atan2(this.vy, this.vx);

            ctx.save();
            ctx.globalAlpha = 0.7; // Make it more transparent
            ctx.rotate(angle);
            ctx.drawImage(Cannonball.smokyTracerSprite, -trailLength, -this.radius, trailLength, this.radius * 2);
            ctx.restore();
        }
        
        const sprite = GrapeShot.ballSprite;
        // The sprite has width = 8 * ballRadius.
        // We want to draw it such that the ball part equals this.subBallRadius.
        // So drawn width = this.subBallRadius * 8.
        const size = this.subBallRadius * 8;
        const offset = size / 2;

        for (let i = 0; i < this.offsets.length; i++) {
            const o = this.offsets[i];
            const ox = o.x * this.spreadFactor;
            const oy = o.y * this.spreadFactor;
            
            ctx.drawImage(sprite, ox - offset, oy - offset, size, size);
        }

        ctx.restore();
    }
}

/**
 * Represents a Canister Shot projectile.
 * A cloud of shrapnel represented by a spikey, pulsing star.
 */
class CanisterShot extends Cannonball {
    static pool = [];

    static get(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        if (CanisterShot.pool.length > 0) {
            const ball = CanisterShot.pool.pop();
            ball.init(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
            return ball;
        }
        return new CanisterShot(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    static release(ball) {
        CanisterShot.pool.push(ball);
    }

    constructor(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        // Redundant super call for constructor compliance.
        super(x, y, angle, radius, speed, color, owner, inheritedVx, inheritedVy);
    }

    init(x, y, angle, radius, speed, color, owner, inheritedVx = 0, inheritedVy = 0) {
        const adjustedSpeed = speed * CANISTER_SHOT_SPEED_MULTIPLIER;
        super.init(x, y, angle, radius, adjustedSpeed, color, owner, inheritedVx, inheritedVy);
        
        this.baseRadius = radius;
        this.spreadFactor = 1.0;
        this.type = 'canister-shot';
        this.maxDistance = CANNONBALL_MAX_TRAVEL_DISTANCE * CANISTER_SHOT_RANGE_MULTIPLIER;
        
        // Random offset for pulse phase to make multiple shots look different
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update() {
        super.update();
        // Expand the spread over time
        this.spreadFactor += CANISTER_SHOT_SPREAD_RATE;
        
        // Update collision radius
        this.radius = this.baseRadius * this.spreadFactor; 
        this._updateAABB();
    }

    static get starSprite() {
        if (!this._starSprite) {
            const size = 64; // Higher res for star details
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            const cx = size / 2;
            const cy = size / 2;
            const outerRadius = size / 2;
            const innerRadius = size / 5; // Spikey look
            const spikes = 24;
            
            ctx.beginPath();
            for (let i = 0; i < spikes * 2; i++) {
                const r = (i % 2 === 0) ? outerRadius : innerRadius;
                const a = (Math.PI * i) / spikes;
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();

            const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
            grad.addColorStop(0, 'rgba(50, 50, 50, 0.9)');
            grad.addColorStop(0.6, 'rgba(80, 80, 80, 0.3)');
            grad.addColorStop(1, 'rgba(100, 100, 100, 0)');
            
            ctx.fillStyle = grad;
            ctx.fill();
            this._starSprite = canvas;
        }
        return this._starSprite;
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // --- NEW: Single Tracer Trail ---
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.0) {
            const trailLength = this.radius * 5; 
            const angle = Math.atan2(this.vy, this.vx);

            ctx.save();
            ctx.globalAlpha = 0.7; // Make it more transparent
            ctx.rotate(angle);
            ctx.drawImage(Cannonball.smokyTracerSprite, -trailLength, -this.radius, trailLength, this.radius * 2);
            ctx.restore();
        }
        
        const sprite = CanisterShot.starSprite;
        
        // Erratic Pulse: High frequency sine + cosine interference
        const t = this.spreadFactor;
        const pulse = 1.0 + 0.3 * (Math.sin(t * 20.0 + this.pulsePhase) * Math.cos(t * 8.0));
        
        // Size is half of Grape Shot (Grape was 4.0, so 2.0 here)
        const size = this.radius * 2.0 * pulse; 
        
        // Rotate based on distance for churning effect
        ctx.rotate(this.distanceTraveled * 0.05);

        ctx.globalAlpha = 0.6; 
        ctx.drawImage(sprite, -size/2, -size/2, size, size);
        
        ctx.restore();
    }
}

/**
 * Represents a group of cannonballs or a single shot as a unified threat for AI avoidance.
 * This is a logical entity and is not drawn.
 */
class Volley {
    static pool = [];

    static get(x, y, vx, vy, radius, owner) {
        if (Volley.pool.length > 0) {
            const volley = Volley.pool.pop();
            volley.init(x, y, vx, vy, radius, owner);
            return volley;
        }
        return new Volley(x, y, vx, vy, radius, owner);
    }

    static release(volley) {
        Volley.pool.push(volley);
    }

    constructor(x, y, vx, vy, radius, owner) {
        this.init(x, y, vx, vy, radius, owner);
    }

    init(x, y, vx, vy, radius, owner) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.owner = owner;
        this.distanceTraveled = 0;
        this.markedForRemoval = false;
        this.type = 'volley'; // For spatial grid identification
        this.initialX = x;
        this.initialY = y;
        // --- OPTIMIZATION: Cache AABB ---
        this.aabb = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        this._updateAABB();
    }

    getAABB() {
        return this.aabb;
    }

    _updateAABB() {
        this.aabb.minX = this.x - this.radius;
        this.aabb.minY = this.y - this.radius;
        this.aabb.maxX = this.x + this.radius;
        this.aabb.maxY = this.y + this.radius;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this._updateAABB();
        // Simple distance check to expire the volley matching cannonball range
        const dx = this.x - this.initialX;
        const dy = this.y - this.initialY;
        this.distanceTraveled = Math.sqrt(dx * dx + dy * dy);
    }
}
