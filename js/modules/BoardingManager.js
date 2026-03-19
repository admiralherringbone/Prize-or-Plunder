/**
 * Manages the state and logic for all boarding-related activities.
 */
class BoardingManager {
    constructor(options) {
        this.getPlayer = options.getPlayer;
        this.openInventoryMenu = options.openInventoryMenu;
        this.closeInventoryMenu = options.closeInventoryMenu;
        this.triggerGameOver = options.triggerGameOver;

        this.isActive = false;
        this.isInventoryOpen = false;
        this.target = null;
        this.jointPoint = null;
        this.tension = 0;
        this.crewProjectiles = [];

        // Slingshot Input State
        this.isAiming = false;
        this.aimStart = null;
        this.aimStartLocal = null;
        this.aimCurrent = null;

        // NPC Boarding AI State
        this.npcState = 'IDLE';
        this.npcTimer = 0;
        this.npcChargeStartLocal = null;

        // This will be the ship whose inventory is open.
        this.inventoryTarget = null;

        // Cache for the visual indicator
        this.boardingIndicatorSprite = null;
        
        // --- NEW: Map to track animation progress for each ship (Ship object -> float 0..1) ---
        this.indicatorAnimations = new Map();
    }

    /**
     * Resets all boarding state to its initial values.
     */
    reset() {
        this.isActive = false;
        this.isInventoryOpen = false;
        this.target = null;
        this.jointPoint = null;
        this.tension = 0;
        this.crewProjectiles = [];
        this.isAiming = false;
        this.aimStart = null;
        this.aimStartLocal = null;
        this.aimCurrent = null;
        this.npcState = 'IDLE';
        this.npcTimer = 0;
        this.npcChargeStartLocal = null;
        this.inventoryTarget = null;
    }

    // --- Input Handlers ---

    handleMouseDown(event, camera, scale, rect) {
        const player = this.getPlayer ? this.getPlayer() : null;
        if (!this.isActive || !player || this.isInventoryOpen) return;

        const mouseX = (event.clientX - rect.left) / scale + camera.x;
        const mouseY = (event.clientY - rect.top) / scale + camera.y;

        const distToPlayer = distance({x: mouseX, y: mouseY}, player);
        if (distToPlayer < player.shipLength / 2) {
            this.isAiming = true;
            this.aimStart = { x: mouseX, y: mouseY };
            
            const dx = mouseX - player.x;
            const dy = mouseY - player.y;
            this.aimStartLocal = rotatePoint({x: dx, y: dy}, {x: 0, y: 0}, -player.angle);
            this.aimCurrent = { x: mouseX, y: mouseY };
        }
    }

    handleMouseMove(event, camera, scale, rect) {
        if (!this.isActive || !this.isAiming) return;
        
        const mouseX = (event.clientX - rect.left) / scale + camera.x;
        const mouseY = (event.clientY - rect.top) / scale + camera.y;
        this.aimCurrent = { x: mouseX, y: mouseY };
    }

    handleMouseUp(event) {
        if (!this.isActive || !this.isAiming) return;
        
        this._launchCrewAttack();
        
        this.isAiming = false;
        this.aimStart = null;
        this.aimStartLocal = null;
    }

    // --- Core Logic ---

    startBoarding(target, contactPoint) {
        const player = this.getPlayer();
        if (this.isActive || !player) return;
        
        console.log(`[Boarding] Initiated with ${target.shipId}`);
        this.isActive = true;
        this.target = target;
        this.jointPoint = contactPoint;
        this.tension = 0;
        this.crewProjectiles = [];
        
        if (target.crew <= 0 || target.aiState === 'surrendered' || target.isAllied) {
            this.isInventoryOpen = true;
            if (!target.isAllied) {
                target.aiState = 'surrendered';
            }
            target.isSailOpen = false;
            player.isSailOpen = false;

            if (this.openInventoryMenu) {
                this.openInventoryMenu(target, player);
                if (target instanceof NpcShip && !target.hasBeenBoardedByPlayer) {
                    target.hasBeenBoardedByPlayer = true;
                    player.stats.shipsBoarded++;
                    player.updateRank();
                }
                this.inventoryTarget = target;
            }
        } else {
            this.isInventoryOpen = false;
            target.aiState = 'boarded';
            target.isSailOpen = false;
            player.isSailOpen = false;
        }

        target.abandonedTime = null;
    }

    endBoarding() {
        if (!this.isActive) return;
        console.log(`[Boarding] Ended.`);
        
        if (this.target) {
            if (this.target.aiState !== 'surrendered' && !this.target.isAllied) {
                this.target.aiState = 'combat';
                this.target.resetFailsafeState();
            } else {
                this.target.isSailOpen = false;
            }
        }
        
        this.isActive = false;
        this.isInventoryOpen = false;
        this.target = null;
        this.jointPoint = null;
        this.crewProjectiles = [];

        if (this.closeInventoryMenu) {
            this.closeInventoryMenu();
        }
        this.inventoryTarget = null;
    }

    onInventoryClose() {
        this.isInventoryOpen = false;
        this.inventoryTarget = null;

        if (this.isActive && this.target && (this.target.aiState === 'surrendered' || this.target.isAllied)) {
            this.endBoarding();
        }
    }

    /**
     * New: Centralized logic to handle victory in a boarding action.
     * Opens the inventory menu and updates player stats.
     * @param {PlayerShip} player - The player ship instance.
     * @private
     */
    _handleVictory(player) {
        // Failsafe: Don't do anything if the inventory is already open.
        if (this.isInventoryOpen || !this.target) return;

        console.log(`[Boarding] Target ${this.target.shipId} has been defeated. Opening inventory.`);
        this.isInventoryOpen = true;
        this.target.aiState = 'surrendered'; // Ensure state is correctly set.
        this.target.isSailOpen = false;      // Furl sails.

        if (this.openInventoryMenu) {
            this.openInventoryMenu(this.target, player);
            if (this.target instanceof NpcShip && !this.target.hasBeenBoardedByPlayer) {
                this.target.hasBeenBoardedByPlayer = true;
                player.stats.shipsBoarded++;
                player.updateRank();
            }
            this.inventoryTarget = this.target;
        }
    }

    update(deltaTime) {
        if (!this.isActive) return;

        const player = this.getPlayer();
        const target = this.target;
        if (!player || !target) {
            this.endBoarding();
            return;
        }

        // --- Tension Calculation (Common to both combat and inventory states) ---
        const dx = player.x - target.x;
        const dy = player.y - target.y;
        const angleToPlayer = Math.atan2(dy, dx);
        let angleDiff = normalizeAngle(player.angle - angleToPlayer);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        const isPullingAway = Math.abs(angleDiff) < Math.PI / 2;
        const pullForce = Math.sqrt(player.vx**2 + player.vy**2);

        if (isPullingAway && pullForce > 0.5) {
            this.tension += BOARDING_TENSION_BUILD_RATE * (deltaTime / 16);
        } else {
            this.tension = Math.max(0, this.tension - BOARDING_TENSION_DECAY_RATE * (deltaTime / 16));
        }

        if (this.tension >= BOARDING_TENSION_BREAK_THRESHOLD) {
            console.log("[Boarding] Lines snapped! Breaking free.");
            this.endBoarding();
            return;
        }

        // If inventory is open, just manage physics to keep ships together and exit.
        if (this.isInventoryOpen) {
            const dist = distance(player, target);
            // Use a fallback for shipLength in case it's not defined, and use the constant from config.js
            const maxDist = (player.shipLength || 50) * INVENTORY_MAX_DISTANCE_MULTIPLIER;
            if (dist > maxDist) {
                console.log(`[Boarding] Ships drifted too far apart (${dist.toFixed(0)} > ${maxDist.toFixed(0)}). Ending interaction.`);
                this.endBoarding(); // This will close the inventory menu.
                return;
            }

            const avgVx = (player.vx + target.vx) / 2;
            const avgVy = (player.vy + target.vy) / 2;
            player.vx = player.vx * 0.9 + avgVx * 0.1;
            player.vy = player.vy * 0.9 + avgVy * 0.1;
            target.vx = target.vx * 0.9 + avgVx * 0.1;
            target.vy = target.vy * 0.9 + avgVy * 0.1;
            return;
        }

        // --- NEW: Check for morale surrender first. ---
        // If the target surrendered on its own, handle victory and exit combat logic for this frame.
        if (this.target.aiState === 'surrendered') {
            this._handleVictory(player);
            return; // Exit after handling victory.
        }

        // --- COMBAT LOGIC (runs only if inventory is closed) ---

        // 1. Update NPC AI to decide when to fire back.
        if (this.target instanceof NpcShip) {
            this._updateNpcBoardingAI(deltaTime);
        }

        // 3. Update projectiles: interception, movement, and hit detection.
        for (let i = 0; i < this.crewProjectiles.length; i++) {
            for (let j = i + 1; j < this.crewProjectiles.length; j++) {
                const p1 = this.crewProjectiles[i];
                const p2 = this.crewProjectiles[j];
                if (p1.owner !== p2.owner && !p1.markedForRemoval && !p2.markedForRemoval) {
                    if (distance(p1, p2) < 10) { p1.markedForRemoval = true; p2.markedForRemoval = true; }
                }
            }
        }

        for (let i = this.crewProjectiles.length - 1; i >= 0; i--) {
            const p = this.crewProjectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.markedForRemoval) { this.crewProjectiles.splice(i, 1); continue; }

            const dist = distance(p, p.target);
            if (dist < p.target.shipLength / 3) {
                p.target.crew = Math.max(0, p.target.crew - 1);
                this.crewProjectiles.splice(i, 1);
                if (p.owner.recoveringCrew !== undefined) p.owner.recoveringCrew++;

                if (p.target.crew <= 0) {
                    if (p.target === player) {
                        console.log("[Boarding] Player crew eliminated! Game Over.");
                        this.triggerGameOver('Captured');
                        return;
                    }
                    // --- REFACTOR: Decouple victory from the projectile loop. ---
                    // Instead of calling _handleVictory directly, just set the state.
                    // The check at the top of the next update() call will handle opening the inventory.
                    console.log(`[Boarding] Target ${p.target.shipId} crew eliminated. Setting state to surrendered.`);
                    p.target.aiState = 'surrendered';
                    // Do NOT return here. Let the loop finish for this frame.
                    // The surrender will be handled at the top of the next update() call.
                }
            } else if (distance(p, p.owner) > 1000) {
                this.crewProjectiles.splice(i, 1);
            }
        }
    }

    _updateNpcBoardingAI(deltaTime) {
        const npc = this.target;
        if (npc.crew <= 0) return;

        this.npcTimer -= deltaTime;

        const isNavy = (npc instanceof NavyShip);
        const chargeDuration = isNavy ? 750 : 1000;
        const cooldownMin = isNavy ? 50 : 1500;
        const cooldownVariance = isNavy ? 1000 : 1500;

        if (this.npcState === 'IDLE') {
            if (this.npcTimer <= 0) {
                this.npcState = 'CHARGING';
                this.npcTimer = chargeDuration; 
                
                const player = this.getPlayer();
                const unrotatedPlayer = rotatePoint({x: player.x, y: player.y}, {x: npc.x, y: npc.y}, -npc.angle);
                const localY = unrotatedPlayer.y - npc.y;
                
                const lengthOffset = (Math.random() - 0.5) * npc.shipLength * 0.8;
                const sideOffset = (localY > 0 ? 1 : -1) * (npc.shipWidth / 2 * 0.8);
                
                this.npcChargeStartLocal = { x: lengthOffset, y: sideOffset };
            }
        } else if (this.npcState === 'CHARGING') {
            if (this.npcTimer <= 0) {
                this._fireNpcCrew(npc);
                this.npcState = 'COOLDOWN';
                this.npcTimer = cooldownMin + Math.random() * cooldownVariance;
                this.npcChargeStartLocal = null;
            }
        } else if (this.npcState === 'COOLDOWN') {
            if (this.npcTimer <= 0) {
                this.npcState = 'IDLE';
                this.npcTimer = 200;
            }
        }
    }

    _fireNpcCrew(npc) {
        const player = this.getPlayer();
        if (npc.crew <= 0 || !player) return;

        const ratio = npc.crew / player.crew;
        let mode = 'offense';

        if (ratio < 0.8) mode = 'defense';
        else if (ratio <= 1.2) mode = Math.random() < 0.5 ? 'offense' : 'defense';
        
        let targetPoint = { x: player.x, y: player.y };
        let crewToSend = 1;

        if (mode === 'defense') {
            let closestDistSq = Infinity;
            let bestTarget = null;

            this.crewProjectiles.forEach(p => {
                if (p.owner === player && !p.markedForRemoval) {
                    const dx = npc.x - p.x;
                    const dy = npc.y - p.y;
                    if ((dx * p.vx + dy * p.vy) > 0) {
                        const dSq = dx * dx + dy * dy;
                        if (dSq < closestDistSq) {
                            closestDistSq = dSq;
                            bestTarget = p;
                        }
                    }
                }
            });

            if (bestTarget) {
                targetPoint = { x: bestTarget.x, y: bestTarget.y };
            } else {
                mode = 'offense';
            }
        }

        if (mode === 'offense') {
            const maxVolley = Math.max(1, Math.floor(npc.crew * 0.25));
            crewToSend = maxVolley;
        }

        const startLocal = this.npcChargeStartLocal || { x: 0, y: 0 };
        const startRotated = rotatePoint(startLocal, {x: 0, y: 0}, npc.angle);
        const startWorld = { x: npc.x + startRotated.x, y: npc.y + startRotated.y };

        const angle = Math.atan2(targetPoint.y - startWorld.y, targetPoint.x - startWorld.x);
        const speed = CREW_ATTACK_SPEED;

        crewToSend = Math.min(crewToSend, npc.crew);
        npc.crew -= crewToSend;

        for (let i = 0; i < crewToSend; i++) {
            const spread = (crewToSend > 1) ? (Math.random() - 0.5) * 0.3 : 0;
            this.crewProjectiles.push({
                x: startWorld.x, y: startWorld.y,
                vx: Math.cos(angle + spread) * speed, vy: Math.sin(angle + spread) * speed,
                owner: npc, target: player, color: npc.pennantColor, markedForRemoval: false
            });
        }
    }

    _getCurrentAimStart() {
        const player = this.getPlayer();
        if (!this.aimStartLocal || !player) return this.aimStart;
        const rotated = rotatePoint(this.aimStartLocal, {x: 0, y: 0}, player.angle);
        return { x: player.x + rotated.x, y: player.y + rotated.y };
    }

    _launchCrewAttack() {
        const player = this.getPlayer();
        if (this.isInventoryOpen || !player) return;
        if (!this.aimStartLocal || !this.aimCurrent) return;
        
        const currentStart = this._getCurrentAimStart();
        
        const dx = this.aimCurrent.x - currentStart.x;
        const dy = this.aimCurrent.y - currentStart.y;
        const dragDist = Math.sqrt(dx*dx + dy*dy);
        
        let crewToSend = Math.floor(dragDist / 10);
        crewToSend = Math.min(crewToSend, player.crew);
        if (crewToSend <= 0) return;

        player.crew -= crewToSend;

        const angle = Math.atan2(dy, dx); 
        
        for(let i=0; i<crewToSend; i++) {
            const spread = (Math.random() - 0.5) * 0.5; 
            const speed = CREW_ATTACK_SPEED + (Math.random() * 2);
            
            this.crewProjectiles.push({
                x: currentStart.x,
                y: currentStart.y,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                owner: player,
                target: this.target,
                color: player.pennantColor,
                markedForRemoval: false
            });
        }
    }

    draw(ctx, scale) {
        if (!this.isActive) return;
        const player = this.getPlayer();
        if (!player) return;

        // Grappling Lines
        if (this.target) {
            const target = this.target;
            
            const getClosestBeamPoint = (ship, otherShip) => {
                const halfWidth = ship.shipWidth / 2;
                const p1Rotated = rotatePoint({x: 0, y: -halfWidth}, {x: 0, y: 0}, ship.angle);
                const p1 = { x: ship.x + p1Rotated.x, y: ship.y + p1Rotated.y };
                const p2Rotated = rotatePoint({x: 0, y: halfWidth}, {x: 0, y: 0}, ship.angle);
                const p2 = { x: ship.x + p2Rotated.x, y: ship.y + p2Rotated.y };
                const d1 = (p1.x - otherShip.x)**2 + (p1.y - otherShip.y)**2;
                const d2 = (p2.x - otherShip.x)**2 + (p2.y - otherShip.y)**2;
                return d1 < d2 ? p1 : p2;
            };

            const pBow = player.getBowPointWorldCoords();
            const pStern = player.getSternPointWorldCoords();
            const pMid = getClosestBeamPoint(player, target);
            
            const tBow = target.getBowPointWorldCoords();
            const tStern = target.getSternPointWorldCoords();
            const tMid = getClosestBeamPoint(target, player);

            const tensionRatio = Math.min(1, this.tension / BOARDING_TENSION_BREAK_THRESHOLD);
            const r = 200 + (255 - 200) * tensionRatio;
            const g = 173 + (68 - 173) * tensionRatio;
            const b = 127 + (68 - 127) * tensionRatio;
            const rDash = r * 0.8;
            const gDash = g * 0.8;
            const bDash = b * 0.8;
            
            ctx.save();
            const baseLineWidth = (2 - tensionRatio * 1) / scale;
            ctx.lineWidth = baseLineWidth; 
            ctx.lineCap = 'round';
            
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            const shadowOffset = 2 / scale;
            ctx.beginPath();
            ctx.moveTo(pBow.x + shadowOffset, pBow.y + shadowOffset); ctx.lineTo(tBow.x + shadowOffset, tBow.y + shadowOffset);
            ctx.moveTo(pMid.x + shadowOffset, pMid.y + shadowOffset); ctx.lineTo(tMid.x + shadowOffset, tMid.y + shadowOffset);
            ctx.moveTo(pStern.x + shadowOffset, pStern.y + shadowOffset); ctx.lineTo(tStern.x + shadowOffset, tStern.y + shadowOffset);
            ctx.stroke();

            ctx.strokeStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
            ctx.beginPath();
            ctx.moveTo(pBow.x, pBow.y); ctx.lineTo(tBow.x, tBow.y);
            ctx.moveTo(pMid.x, pMid.y); ctx.lineTo(tMid.x, tMid.y);
            ctx.moveTo(pStern.x, pStern.y); ctx.lineTo(tStern.x, tStern.y);
            ctx.stroke();

            ctx.strokeStyle = `rgb(${Math.round(rDash)}, ${Math.round(gDash)}, ${Math.round(bDash)})`;
            ctx.lineWidth = baseLineWidth * 0.75;
            ctx.setLineDash([5 / scale, 5 / scale]);
            ctx.beginPath();
            ctx.moveTo(pBow.x, pBow.y); ctx.lineTo(tBow.x, tBow.y);
            ctx.moveTo(pMid.x, pMid.y); ctx.lineTo(tMid.x, tMid.y);
            ctx.moveTo(pStern.x, pStern.y); ctx.lineTo(tStern.x, tStern.y);
            ctx.stroke();

            ctx.restore();
        }

        // Tension Meter
        const barW = 100;
        const barH = 10;
        const x = player.x - barW / 2;
        const y = player.y - player.shipLength * 1.5;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, barW, barH);

        if (this.tension > 0) {
            const ratio = Math.min(1, this.tension / BOARDING_TENSION_BREAK_THRESHOLD);
            ctx.fillStyle = ratio > 0.8 ? 'red' : 'orange';
            ctx.fillRect(x, y, barW * ratio, barH);
        }

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / scale;
        ctx.strokeRect(x, y, barW, barH);

        ctx.fillStyle = 'white';
        ctx.font = `bold ${12 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText("BREAK FREE", x + barW / 2, y - (5 / scale));
        ctx.restore();

        // Slingshot Aim
        if (!this.isInventoryOpen && this.isAiming && this.aimStartLocal && this.aimCurrent) {
            const currentStart = this._getCurrentAimStart();

            ctx.beginPath();
            ctx.moveTo(currentStart.x, currentStart.y);
            ctx.lineTo(this.aimCurrent.x, this.aimCurrent.y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(currentStart.x, currentStart.y, 5 / scale, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();

            const dx = this.aimCurrent.x - currentStart.x;
            const dy = this.aimCurrent.y - currentStart.y;
            const dragDist = Math.sqrt(dx*dx + dy*dy);
            let crewToSend = Math.floor(dragDist / 10);
            crewToSend = Math.min(crewToSend, player.crew);

            ctx.save();
            ctx.font = `bold ${16 / scale}px Arial`;
            ctx.textAlign = 'center';
            
            ctx.fillStyle = 'black';
            ctx.fillText(crewToSend, this.aimCurrent.x + (1 / scale), this.aimCurrent.y - (15 / scale) + (1 / scale));
            
            ctx.fillStyle = 'white';
            ctx.fillText(crewToSend, this.aimCurrent.x, this.aimCurrent.y - (15 / scale));
            ctx.restore();
        }

        // NPC Charge Indicator
        if (this.npcState === 'CHARGING' && this.npcChargeStartLocal && this.target) {
            const npc = this.target;
            const startRotated = rotatePoint(this.npcChargeStartLocal, {x: 0, y: 0}, npc.angle);
            const chargeX = npc.x + startRotated.x;
            const chargeY = npc.y + startRotated.y;

            const pulse = (Math.sin(performance.now() / 100) + 1) / 2;
            const radius = (5 + pulse * 5) / scale;

            ctx.save();
            ctx.beginPath();
            ctx.arc(chargeX, chargeY, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();
            ctx.restore();
        }

        // Crew Projectiles
        this.crewProjectiles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 / scale, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
    }

    /**
     * Draws the "ready to board" indicator (pulsing rings) around valid targets.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} scale - The current effective world scale (for line widths).
     * @param {PlayerShip} player - The player ship.
     * @param {SpatialGrid} spatialGrid - The spatial grid for querying nearby ships.
     */
    drawAvailabilityIndicators(ctx, scale, player, spatialGrid) {
        if (this.isActive || !player || !spatialGrid) return;

        // Define search range based on ship size (same as before)
        const searchRange = player.shipLength * 2;
        const queryAABB = {
            minX: player.x - searchRange,
            minY: player.y - searchRange,
            maxX: player.x + searchRange,
            maxY: player.y + searchRange
        };

        // 1. Identify current valid targets
        const potentialTargets = spatialGrid.query(queryAABB);
        const validTargets = new Set();

        for (const npc of potentialTargets) {
            if (npc instanceof NpcShip && player.canInitiateBoarding(npc)) {
                validTargets.add(npc);
            }
        }
        
        // 2. Initialize animation state for new targets
        for (const ship of validTargets) {
            if (!this.indicatorAnimations.has(ship)) {
                this.indicatorAnimations.set(ship, 0.0); // Start at 0 size
            }
        }

        // 3. Update and Draw Animations
        const sprite = this._getBoardingIndicatorSprite();
        const time = performance.now();
        const rotation = time * 0.002; // Slow aggressive spin
        const pulse = (Math.sin(time / 150) + 1) / 2; // Fast pulse 0..1
        const pulseScale = 1.0 + (pulse * 0.15); // Scale factor 1.0 to 1.15

        for (const [ship, currentProgress] of this.indicatorAnimations.entries()) {
            const isTarget = validTargets.has(ship);
            const targetProgress = isTarget ? 1.0 : 0.0;

            // Smoothly interpolate progress (approx 20% closer per frame)
            // This creates a quick but smooth expansion/contraction
            let newProgress = currentProgress + (targetProgress - currentProgress) * 0.2;
            
            // Clamp to avoid endless micro-calculations
            if (Math.abs(newProgress - targetProgress) < 0.01) newProgress = targetProgress;
            
            this.indicatorAnimations.set(ship, newProgress);

            if (newProgress > 0.01) {
                // Multiply the pulse scale by the animation progress to expand/contract
                const combinedScale = pulseScale * newProgress;
                this._drawIndicator(ctx, sprite, ship, rotation, combinedScale);
                this._drawIndicator(ctx, sprite, player, rotation, combinedScale);
            }

            // Cleanup: If fully contracted and no longer a target, stop tracking
            if (newProgress <= 0.01 && !isTarget) {
                this.indicatorAnimations.delete(ship);
            }
        }
    }

    /**
     * Helper to draw the cached sprite on a ship.
     * @private
     */
    _drawIndicator(ctx, sprite, ship, rotation, pulseScale) {
        const targetRadius = ship.shipLength * 0.75; 
        // Sprite visual ring is approx 100px radius (internal).
        // We calculate scale to match the ship's size in world space.
        const s = (targetRadius / 100) * pulseScale;

        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(rotation);
        ctx.scale(s, s);
        // Sprite is 256x256, center is 128,128
        ctx.drawImage(sprite, -128, -128);
        ctx.restore();
    }

    /**
     * Generates (lazy-load) the cached sprite for the boarding ring.
     * @private
     */
    _getBoardingIndicatorSprite() {
        if (!this.boardingIndicatorSprite) {
            const size = 256;
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2;
            const cy = size / 2;
            
            const radius = 80; // Distance from center to triangle base
            const triHeight = 8; // 1/4 size
            const triHalfWidth = 3; // 1/4 size
            const numTriangles = 24; // Reduced count for spacing

            // Shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 3; // Reduced blur to keep small shapes crisp
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Aggressive black with 75% opacity

            for (let i = 0; i < numTriangles; i++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate((i / numTriangles) * Math.PI * 2);
                ctx.translate(radius, 0); 
                
                // Every other triangle is smaller
                const scale = (i % 2 === 0) ? 1.0 : 0.5;
                const h = triHeight * scale;
                const w = triHalfWidth * scale;

                // Draw outward facing triangle
                ctx.beginPath();
                ctx.moveTo(0, -w); // Base top
                ctx.lineTo(h, 0);     // Tip (outward)
                ctx.lineTo(0, w);  // Base bottom
                ctx.closePath();
                ctx.fill();
                
                ctx.restore();
            }
            this.boardingIndicatorSprite = c;
        }
        return this.boardingIndicatorSprite;
    }
}