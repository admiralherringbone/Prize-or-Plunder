/**
 * Draws the wind dial UI element.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {HTMLCanvasElement} canvas - The main game canvas.
 * @param {number} windDirection - The current direction of the wind in radians.
 */
function drawWindDial(ctx, canvas, windDirection) {
    const dialSize = 60;
    const margin = 20;
    const dialX = canvas.width - dialSize - margin;
    const dialY = canvas.height - dialSize - margin;
    const dialRadius = dialSize / 2;
    const dialCenterX = dialX + dialRadius;
    const dialCenterY = dialY + dialRadius;

    ctx.save();
    ctx.translate(dialCenterX, dialCenterY);

    ctx.beginPath();
    ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52, 73, 94, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -dialRadius + 8);
    ctx.fillText('E', dialRadius - 8, 0);
    ctx.fillText('S', 0, dialRadius - 8);
    ctx.fillText('W', -dialRadius + 8, 0);

    ctx.rotate(windDirection + Math.PI);
    ctx.beginPath();
    const arrowTipX = dialRadius * 0.8;
    const arrowBaseWidth = dialRadius * 0.3;
    const arrowBaseOffset = dialRadius * 0.2;
    ctx.moveTo(arrowTipX, 0);
    ctx.lineTo(arrowBaseOffset, arrowBaseWidth / 2);
    ctx.lineTo(arrowBaseOffset, -arrowBaseWidth / 2);
    ctx.closePath();
    ctx.fillStyle = '#ecf0f1';
    ctx.fill();
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, dialRadius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#bdc3c7';
    ctx.fill();

    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('WIND', dialCenterX, dialY - 5);
    ctx.restore();

    }

/**
 * Draws the day/night cycle dial UI element.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {HTMLCanvasElement} canvas - The main game canvas.
 * @param {number} dayNightTimer - The current time in the day/night cycle.
 */
function drawDayNightDial(ctx, canvas, dayNightTimer) {
    const dialSize = 60;
    const margin = 20;
    const windDialY = canvas.height - dialSize - margin;
    const dialY = windDialY - dialSize - 25; // Position above wind dial
    const dialX = canvas.width - dialSize - margin;

    const dialRadius = dialSize / 2;
    const dialCenterX = dialX + dialRadius;
    const dialCenterY = dialY + dialRadius;

    ctx.save();
    ctx.translate(dialCenterX, dialCenterY);

    // 1. Draw Dial Background
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52, 73, 94, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. Draw Sun Icon (Top)
    const iconYOffset = dialRadius * 0.55;
    const sunRadius = dialRadius * 0.25;
    ctx.fillStyle = '#f1c40f'; // Yellow

    // Sun body
    ctx.beginPath();
    ctx.arc(0, -iconYOffset, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const startR = sunRadius * 1.3;
        const endR = sunRadius * 1.9;
        ctx.moveTo(Math.cos(angle) * startR, -iconYOffset + Math.sin(angle) * startR);
        ctx.lineTo(Math.cos(angle) * endR, -iconYOffset + Math.sin(angle) * endR);
    }
    ctx.stroke();

    // 3. Draw Moon Icon (Bottom)
    const moonRadius = dialRadius * 0.3;
    ctx.fillStyle = '#ecf0f1'; // White
    ctx.save();
    // Clip to the bottom half of the dial to ensure the moon doesn't overlap the sun part
    ctx.beginPath();
    ctx.rect(-dialRadius, 0, dialRadius * 2, dialRadius);
    ctx.clip();
    
    // Draw full moon
    ctx.beginPath();
    ctx.arc(0, iconYOffset, moonRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Cut out crescent shape
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(moonRadius * 0.5, iconYOffset - moonRadius * 0.1, moonRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore(); // Restore from clipping and composite operation

    // 4. Draw Rotating Arrow
    const cycleProgress = dayNightTimer / DAY_NIGHT_CYCLE_DURATION;
    const arrowAngle = cycleProgress * Math.PI * 2 + Math.PI;
    ctx.rotate(arrowAngle);

    ctx.beginPath();
    const arrowTipX = dialRadius * 0.85;
    const arrowBaseWidth = dialRadius * 0.25;
    const arrowBaseOffset = dialRadius * 0.3;
    ctx.moveTo(arrowTipX, 0);
    ctx.lineTo(arrowBaseOffset, arrowBaseWidth / 2);
    ctx.lineTo(arrowBaseOffset, -arrowBaseWidth / 2);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c'; // Red for contrast
    ctx.fill();
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center pivot
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#c0392b';
    ctx.fill();

    ctx.restore();
}

/**
 * Draws a debug button to toggle day/night.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 */
function drawDayNightDebugButton(ctx, canvas) {
    const dialSize = 60;
    const margin = 20;
    const windDialY = canvas.height - dialSize - margin;
    const dialY = windDialY - dialSize - 25;
    const dialX = canvas.width - dialSize - margin;

    const btnW = 40;
    const btnH = 15;
    const btnX = dialX + (dialSize - btnW) / 2;
    const btnY = dialY - btnH - 5;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TIME', btnX + btnW / 2, btnY + btnH / 2);
    ctx.restore();
}

/**
 * Draws the minimap UI element.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {object} gameState - An object containing the current game state arrays (islands, rocks, etc.).
 */
function drawMiniMap(ctx, { canvas, player, allNpcs, activeNpcs, windDirection, minimapCache, worldManager }) {
    const miniMapSize = 112.5;
    const margin = 20;
    const miniMapX = margin;
    const miniMapY = canvas.height - miniMapSize - margin;

    ctx.save();
    
    // --- NEW: Clip to Mini-map Box ---
    ctx.beginPath();
    ctx.rect(miniMapX, miniMapY, miniMapSize, miniMapSize);
    ctx.clip();

    ctx.translate(miniMapX, miniMapY);

    // --- NEW: Local View Logic ---
    // Define how much of the world is visible in the mini-map.
    // 5000 units is 1/10th of the world, providing a good "local" zoom.
    const MINIMAP_VIEW_EXTENT = 5000; 
    const scale = miniMapSize / MINIMAP_VIEW_EXTENT;

    // Draw Background (Parchment color) to fill gaps at world edges
    ctx.fillStyle = 'rgba(233, 182, 65, 0.75)'; // Increased opacity since cache is now transparent
    ctx.fillRect(0, 0, miniMapSize, miniMapSize);

    // --- NEW: Draw the pre-rendered static map (Cropped) ---
    if (minimapCache) {
        // Calculate the source rectangle from the cache
        const cacheScale = minimapCache.width / WORLD_WIDTH; // 2000 / 50000 = 0.04
        const sx = (player.x - MINIMAP_VIEW_EXTENT / 2) * cacheScale;
        const sy = (player.y - MINIMAP_VIEW_EXTENT / 2) * cacheScale;
        const sSize = MINIMAP_VIEW_EXTENT * cacheScale;

        ctx.drawImage(minimapCache, sx, sy, sSize, sSize, 0, 0, miniMapSize, miniMapSize);
    }

    // --- NEW: Draw 1000-unit Grid ---
    ctx.save();
    ctx.lineWidth = 1;
    
    const GRID_SPACING = 1000;
    const worldLeft = player.x - MINIMAP_VIEW_EXTENT / 2;
    const worldTop = player.y - MINIMAP_VIEW_EXTENT / 2;
    const worldRight = player.x + MINIMAP_VIEW_EXTENT / 2;
    const worldBottom = player.y + MINIMAP_VIEW_EXTENT / 2;

    // Vertical Lines
    const startGridX = Math.floor(worldLeft / GRID_SPACING) * GRID_SPACING;
    for (let wx = startGridX; wx <= worldRight; wx += GRID_SPACING) {
        const sx = (wx - player.x) * scale + miniMapSize / 2;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, miniMapSize);
        ctx.strokeStyle = (wx % 10000 === 0) ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)';
        ctx.stroke();
    }

    // Horizontal Lines
    const startGridY = Math.floor(worldTop / GRID_SPACING) * GRID_SPACING;
    for (let wy = startGridY; wy <= worldBottom; wy += GRID_SPACING) {
        const sy = (wy - player.y) * scale + miniMapSize / 2;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(miniMapSize, sy);
        ctx.strokeStyle = (wy % 10000 === 0) ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)';
        ctx.stroke();
    }
    ctx.restore();

    // --- NEW: Draw Active Sector Boundary ---
    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && player && worldManager) {
        const sectorSize = worldManager.sectorSize;
        const radius = worldManager.activationRadius;

        const sectorX = Math.floor(player.x / sectorSize);
        const sectorY = Math.floor(player.y / sectorSize);

        // Calculate the bounding box relative to the player (center of minimap)
        const worldRectX = (sectorX - radius) * sectorSize;
        const worldRectY = (sectorY - radius) * sectorSize;
        
        const rectX = (worldRectX - player.x) * scale + miniMapSize / 2;
        const rectY = (worldRectY - player.y) * scale + miniMapSize / 2;
        const rectW = (radius * 2 + 1) * sectorSize * scale;
        const rectH = (radius * 2 + 1) * sectorSize * scale;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        ctx.restore();
    }

    // Draw NPCs, colored by their pennant for easy identification.
    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && allNpcs) {
        allNpcs.forEach(npc => {
            // Calculate position relative to player
            const relX = npc.x - player.x;
            const relY = npc.y - player.y;
            
            const npcMiniMapX = (relX * scale) + miniMapSize / 2;
            const npcMiniMapY = (relY * scale) + miniMapSize / 2;
            
            // Skip if out of bounds (optional optimization)
            if (npcMiniMapX < 0 || npcMiniMapX > miniMapSize || npcMiniMapY < 0 || npcMiniMapY > miniMapSize) return;
            
            ctx.beginPath();
            if (npc.isPirateHunter) {
                // Draw Pirate Hunters larger and distinct
                ctx.fillStyle = '#FF0000'; // Red
                ctx.arc(npcMiniMapX, npcMiniMapY, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#000000';
                ctx.stroke();
            } else {
                // Standard NPC
                ctx.fillStyle = npc.pennantColor;
                ctx.arc(npcMiniMapX, npcMiniMapY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // Draw NPC destination lines for debugging
    if (DEBUG.ENABLED && DEBUG.DRAW_NPC_DESTINATIONS && allNpcs) {
        ctx.save();
        ctx.lineWidth = 0.5; // Thin line
        ctx.setLineDash([2, 3]); // Dashed line pattern (2px line, 3px gap)

        const standardPath = new Path2D();
        const hunterPath = new Path2D();
        let hasStandard = false;
        let hasHunter = false;

        allNpcs.forEach(npc => {
            if (npc.pathWaypoints.length > 0) {
                const targetPath = npc.isPirateHunter ? hunterPath : standardPath;
                if (npc.isPirateHunter) hasHunter = true;
                else hasStandard = true;

                // Start the line from the NPC's current position
                const startX = (npc.x - player.x) * scale + miniMapSize / 2;
                const startY = (npc.y - player.y) * scale + miniMapSize / 2;
                targetPath.moveTo(startX, startY);

                // Draw a line to each waypoint in the calculated path, starting from the current one
                for (let i = npc.currentWaypointIndex; i < npc.pathWaypoints.length; i++) {
                    const waypoint = npc.pathWaypoints[i];
                    const wpX = (waypoint.x - player.x) * scale + miniMapSize / 2;
                    const wpY = (waypoint.y - player.y) * scale + miniMapSize / 2;
                    targetPath.lineTo(wpX, wpY);
                }
            }
        });

        if (hasStandard) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke(standardPath);
        }
        if (hasHunter) {
            ctx.strokeStyle = '#FF0000';
            ctx.stroke(hunterPath);
        }

        ctx.restore(); // Restore line dash and style to default
    }

    if (player) {
        ctx.fillStyle = player.pennantColor;
        // Player is always at the center of the local map
        const playerMiniMapX = miniMapSize / 2;
        const playerMiniMapY = miniMapSize / 2;
        ctx.beginPath();
        ctx.arc(playerMiniMapX, playerMiniMapY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Border around the map
        ctx.strokeStyle = '#B98816';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, miniMapSize, miniMapSize);
    }

    ctx.restore();
}

/**
 * Draws the large, centered version of the map when expanded.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {object} gameState - An object containing the current game state arrays.
 * @param {number} progress - The unroll animation progress (0.0 to 1.0).
 */
function drawExpandedMap(ctx, { canvas, player, allStaticObstacles, npcs, windDirection, worldManager, minimapCache }, progress = 1.0) {
    const mapSize = canvas.height * 0.75;
    const mapX = (canvas.width - mapSize) / 2;
    const mapY = (canvas.height - mapSize) / 2;
    const mapScaleX = mapSize / WORLD_WIDTH;
    const mapScaleY = mapSize / WORLD_HEIGHT;

    // Calculate visible width based on unroll progress (Center-Out)
    const currentWidth = mapSize * progress;
    const centerX = mapX + mapSize / 2;
    const visibleLeft = centerX - currentWidth / 2;
    const visibleRight = centerX + currentWidth / 2;

    ctx.save();
    
    // --- NEW: Clip to unrolled area (Center-Out) ---
    ctx.beginPath();
    ctx.rect(visibleLeft, mapY, currentWidth, mapSize);
    ctx.clip();

    ctx.translate(mapX, mapY); // Translate AFTER defining clip rect in screen space

    // Use a more opaque background for the expanded map to improve focus
    ctx.fillStyle = 'rgba(233, 182, 65, 0.85)';
    ctx.fillRect(0, 0, mapSize, mapSize);

    // --- NEW: Draw 1000-unit Grid ---
    ctx.save();
    ctx.lineWidth = 1;
    const GRID_SPACING = 1000;

    // Vertical Lines
    for (let wx = 0; wx <= WORLD_WIDTH; wx += GRID_SPACING) {
        const sx = wx * mapScaleX;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, mapSize);
        ctx.strokeStyle = (wx % 10000 === 0) ? 'rgba(61, 53, 42, 0.4)' : 'rgba(61, 53, 42, 0.15)';
        ctx.stroke();
    }

    // Horizontal Lines
    for (let wy = 0; wy <= WORLD_HEIGHT; wy += GRID_SPACING) {
        const sy = wy * mapScaleY;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(mapSize, sy);
        ctx.strokeStyle = (wy % 10000 === 0) ? 'rgba(61, 53, 42, 0.4)' : 'rgba(61, 53, 42, 0.15)';
        ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#B98816';
    ctx.lineWidth = 4; // Thicker border for emphasis
    ctx.strokeRect(0, 0, mapSize, mapSize);

    // --- Draw Pathfinder No-Go Zones on Expanded Map ---
    // This is drawn first so that the semi-transparent stroke appears *behind* the
    // actual terrain, creating a clean outline effect.
    if (DEBUG.ENABLED && DEBUG.DRAW_ANCHOR_ZONES) { // Repurposing this flag
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)'; // A slightly more opaque stroke for visibility
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const allObstacles = allStaticObstacles || [];
        allObstacles.forEach(obstacle => {
            const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
            const polygonPoints = geometrySource.outerPerimeterPoints;

            if (!polygonPoints) return;

            // The buffer is half the obstacle's max radius, for a total zone of 1.5x.
            const buffer = obstacle.maxDistanceToPerimeter * 0.5;

            // Scale the buffer to map coordinates
            ctx.lineWidth = buffer * 2 * mapScaleX;

            ctx.beginPath();
            polygonPoints.forEach((point, index) => {
                const scaledX = point.x * mapScaleX;
                const scaledY = point.y * mapScaleY;
                if (index === 0) ctx.moveTo(scaledX, scaledY);
                else ctx.lineTo(scaledX, scaledY);
            });
            ctx.closePath();
            ctx.stroke();
        });
        ctx.restore();
    }

    // --- Draw all the map content (obstacles, ships, etc.) ---
    (allStaticObstacles || []).forEach(obstacle => {
        ctx.fillStyle = '#e4c490'; // Map Land Color
        ctx.strokeStyle = '#3d352a'; // Map Ink Color
        ctx.lineWidth = 2;
        ctx.beginPath();
        const points = obstacle.outerPerimeterPoints || obstacle.rockBase.outerPerimeterPoints;
        points.forEach((point, index) => {
            const scaledX = point.x * mapScaleX;
            const scaledY = point.y * mapScaleY;
            if (index === 0) ctx.moveTo(scaledX, scaledY);
            else ctx.lineTo(scaledX, scaledY);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });

    // --- NEW: Draw Active Sector Boundary ---
    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && player && worldManager) {
        const sectorSize = worldManager.sectorSize;
        const radius = worldManager.activationRadius;

        const sectorX = Math.floor(player.x / sectorSize);
        const sectorY = Math.floor(player.y / sectorSize);

        // Calculate the bounding box of the active sectors
        const rectX = (sectorX - radius) * sectorSize * mapScaleX;
        const rectY = (sectorY - radius) * sectorSize * mapScaleY;
        const rectW = (radius * 2 + 1) * sectorSize * mapScaleX;
        const rectH = (radius * 2 + 1) * sectorSize * mapScaleY;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        ctx.restore();
    }

    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && npcs) {
        npcs.forEach(npc => {
            ctx.fillStyle = npc.pennantColor;
            const npcMapX = npc.x * mapScaleX;
            const npcMapY = npc.y * mapScaleY;
            ctx.beginPath();
            ctx.arc(npcMapX, npcMapY, 4, 0, Math.PI * 2); // Larger icon
            ctx.fill();
        });
    }

    // Draw NPC destination lines for debugging
    if (DEBUG.ENABLED && DEBUG.DRAW_NPC_DESTINATIONS && npcs) {
        ctx.save();
        ctx.lineWidth = 1; // Slightly thicker for the larger map
        ctx.setLineDash([5, 5]); // Larger dashes for clarity

        const standardPath = new Path2D();
        const hunterPath = new Path2D();
        let hasStandard = false;
        let hasHunter = false;

        npcs.forEach(npc => {
            if (npc.pathWaypoints.length > 0) {
                const targetPath = npc.isPirateHunter ? hunterPath : standardPath;
                if (npc.isPirateHunter) hasHunter = true;
                else hasStandard = true;

                // Start the line from the NPC's current position
                targetPath.moveTo(npc.x * mapScaleX, npc.y * mapScaleY);

                // Draw a line to each waypoint in the calculated path, starting from the current one
                for (let i = npc.currentWaypointIndex; i < npc.pathWaypoints.length; i++) {
                    const waypoint = npc.pathWaypoints[i];
                    targetPath.lineTo(waypoint.x * mapScaleX, waypoint.y * mapScaleY);
                }
            }
        });

        if (hasStandard) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke(standardPath);
        }
        if (hasHunter) {
            ctx.strokeStyle = '#FF0000';
            ctx.stroke(hunterPath);
        }

        ctx.restore(); // Restore line dash and style to default
    }

    if (player) {
        const playerMapX = player.x * mapScaleX;
        const playerMapY = player.y * mapScaleY;
        ctx.fillStyle = player.pennantColor;
        ctx.beginPath();
        ctx.arc(playerMapX, playerMapY, 5, 0, Math.PI * 2); // Larger icon
        ctx.fill();

        // Draw player direction indicator
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerMapX, playerMapY);
        ctx.lineTo(playerMapX + Math.cos(player.angle) * 15, playerMapY + Math.sin(player.angle) * 15);
        ctx.stroke();
    }

    ctx.restore();

    // --- NEW: Draw "Scroll Rolls" at the side edges ---
    if (progress > 0) {
        const rollWidth = 24;
        const rollExtension = 15; // Vertical extension
        
        const drawScroll = (x) => {
            const rollY = mapY - rollExtension;
            const rollH = mapSize + (rollExtension * 2);
            
            ctx.save();
            // Vertical Gradient for cylinder effect
            const gradient = ctx.createLinearGradient(x, rollY, x + rollWidth, rollY);
            gradient.addColorStop(0, '#5d4037'); // Darkest (Left Edge)
            gradient.addColorStop(0.4, '#e8d0b1'); // Lighter (Highlight)
            gradient.addColorStop(1, '#3e2723'); // Darker (Right Shadow)

            ctx.fillStyle = gradient;
            ctx.fillRect(x, rollY, rollWidth, rollH);
            
            // Knobs (Top and Bottom)
            ctx.fillStyle = '#3e2723'; 
            ctx.fillRect(x + 4, rollY - 5, rollWidth - 8, 5); // Top
            ctx.fillRect(x + 4, rollY + rollH, rollWidth - 8, 5); // Bottom
            
            ctx.restore();
        };

        drawScroll(visibleLeft - (rollWidth / 2));
        drawScroll(visibleRight - (rollWidth / 2));
    }
}

function drawAnchorIndicator(ctx, canvas, player) {
    if (!player || (!player.isAnchored && !player.isInAnchorRange)) return;

    const barHeight = 25;
    const barWidth = canvas.width / 4;
    const barX = (canvas.width - barWidth) / 2;
    const barY = canvas.height - barHeight - 20;
    const diameter = barHeight;
    const indicatorX = barX - diameter - 10;

    ctx.save();
    ctx.translate(indicatorX, barY);

    const radius = diameter / 2;
    const centerX = radius;
    const centerY = radius;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (player.isAnchored) {
        const ringRadius = radius + 5;
        const ringLineWidth = 5;
        const maxLineLength = player.shipLength * MAX_ANCHOR_LINE_LENGTH_MULTIPLIER;
        const currentLineLength = player.anchorLineMaxDistance;
        let fillRatio = maxLineLength > 0 ? Math.min(1, currentLineLength / maxLineLength) : 0;
        const r = Math.round(fillRatio * 255);
        const g = Math.round((1 - fillRatio) * 255);
        ctx.strokeStyle = `rgb(${r},${g},0)`;
        ctx.lineWidth = ringLineWidth;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * fillRatio);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, startAngle, endAngle);
        ctx.stroke();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    const iconWidth = ANCHOR_ICON_DATA.originalWidth;
    const iconHeight = ANCHOR_ICON_DATA.originalHeight;
    const targetSide = diameter * 0.8;
    const scale = targetSide / Math.max(iconWidth, iconHeight);
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ANCHOR_ICON_DATA.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawCannonReloadIndicator(ctx, x, y, diameter, currentReloadTime, maxReloadTime, cannonCount) {
    ctx.save();
    ctx.translate(x, y);
    const radius = diameter / 2;
    const centerX = radius;
    const centerY = radius;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = CANNON_COUNT_BORDER_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = CANNON_COUNT_TEXT_COLOR;
    ctx.font = `bold ${diameter * 0.6}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cannonCount.toString(), centerX, centerY);
    if (currentReloadTime > 0) {
        const ringRadius = radius + 4;
        const ringLineWidth = 4;
        const fillRatio = 1 - (currentReloadTime / maxReloadTime);
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * fillRatio);
        ctx.strokeStyle = CANNON_RING_COLOR;
        ctx.lineWidth = ringLineWidth;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, startAngle, endAngle);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Draws the main player HUD, including HP bar, indicators, and cannon reloads.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {HTMLCanvasElement} canvas - The main game canvas.
 * @param {PlayerShip} player - The player ship object.
 * @param {number} windDirection - The current wind direction.
 * @param {Array} npcs - Active NPCs.
 * @param {object} boardingState - The current boarding state.
 */
function drawHud(ctx, canvas, player, windDirection, npcs = [], boardingState = null, hudMode = 'main', mouseX = 0, mouseY = 0, dayNightTimer = 0) {
    if (!player) return;

    // --- Player Profile Panel (Top Left) ---
    const profileRadius = 30;
    const profileMargin = 20;
    const profileX = profileMargin + profileRadius;
    const profileY = profileMargin + profileRadius;

    ctx.save();
    
    // 1. Profile Circle Container
    ctx.beginPath();
    ctx.arc(profileX, profileY, profileRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Player Name
    const nameX = profileX + profileRadius + 15; // Gap
    const nameY = profileY - 10; // Shift up slightly
    
    ctx.fillStyle = '#ecf0f1';
    ctx.font = "24px 'IM Fell English', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    // Add shadow for readability against the game world
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    
    // --- NEW: Measure Name Width ---
    const nameWidth = ctx.measureText(player.name).width;
    ctx.fillText(player.name, nameX, nameY);

    // Fortune Calculation
    let totalBaseValue = 0;
    if (player.inventory && player.inventory.cargo) {
        for (const entry of player.inventory.cargo) {
            if (entry.item && typeof entry.item.baseValue === 'number') {
                totalBaseValue += entry.item.baseValue * entry.quantity;
            }
        }
    }
    const fortuneGold = Math.floor(totalBaseValue / 20);
    const fortuneText = `Fortune: ${fortuneGold} G`;

    ctx.fillStyle = '#FFD700'; // Gold
    ctx.font = "18px 'IM Fell English', serif";
    
    // --- NEW: Measure Fortune Width ---
    const fortuneWidth = ctx.measureText(fortuneText).width;
    ctx.fillText(fortuneText, nameX, nameY + 24);

    // --- NEW: Ranking Section ---
    // Position to the right side of the HUD (Top Right)
    const rankRadius = 25; // Slightly smaller than profile (30)
    const rankMargin = 20;
    const rankX = canvas.width - rankMargin - rankRadius;
    const rankY = profileY; // Align centers vertically with profile circle

    // Disable shadow for the container so it matches the profile circle's transparency
    ctx.shadowBlur = 0;

    // Rank Circle Container
    ctx.beginPath();
    ctx.arc(rankX, rankY, rankRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- NEW: Draw Rank Icon ---
    const rankData = player.rankData;
    if (rankData && rankData.iconPath) {
        ctx.save();
        ctx.translate(rankX, rankY);
        // Scale icon to fit (Icon is 100x100, target is ~30x30 inside the 50px circle)
        const iconScale = 0.3; 
        ctx.scale(iconScale, iconScale);
        ctx.translate(-50, -50); // Center the 100x100 icon
        
        ctx.fillStyle = rankData.color;
        
        // Optimization: Cache the darkened stroke color to avoid regex parsing every frame
        if (!rankData.cachedStrokeColor) {
            rankData.cachedStrokeColor = (typeof darkenColor === 'function') ? darkenColor(rankData.color, 40) : 'black';
        }
        ctx.strokeStyle = rankData.cachedStrokeColor;
        ctx.lineWidth = 4;
        
        // Optimization: Cache Path2D objects to avoid parsing SVG strings every frame
        if (!rankData.cachedPaths) {
            rankData.cachedPaths = [];
            const paths = Array.isArray(rankData.iconPath) ? rankData.iconPath : [rankData.iconPath];
            paths.forEach(p => rankData.cachedPaths.push(new Path2D(p)));
        }

        // Draw the cached path(s)
        rankData.cachedPaths.forEach(path => {
            ctx.fill(path);
            ctx.stroke(path);
        });
        
        ctx.restore();
    }

    // Rank Text
    const rankTextX = rankX - rankRadius - 10;
    
    // Re-enable shadow for text readability
    ctx.shadowBlur = 4;

    ctx.fillStyle = rankData ? rankData.color : '#ecf0f1';
    ctx.font = "24px 'IM Fell English', serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(rankData ? rankData.name : "Neutral", rankTextX, rankY);

    // --- DEBUG: Rank Switch Button ---
    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
        const rankName = rankData ? rankData.name : "Neutral";
        const rankTextWidth = ctx.measureText(rankName).width;
        const debugBtnX = rankTextX - rankTextWidth - 20;
        const debugBtnY = rankY;
        const debugBtnRadius = 10;

        ctx.beginPath();
        ctx.arc(debugBtnX, debugBtnY, debugBtnRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', debugBtnX, debugBtnY);
    }
    
    ctx.restore();

    // --- Ship Info Panel (Below Profile) ---
    const shipRadius = profileRadius * 0.5; // 15px
    const shipMarginTop = 10;
    const shipX = profileX; // Align centers vertically with profile circle
    const shipY = profileY + profileRadius + shipMarginTop + shipRadius;

    ctx.save();

    // 1. Ship Circle Container
    ctx.beginPath();
    ctx.arc(shipX, shipY, shipRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Ship Image (Clipped)
    ctx.save();
    ctx.beginPath();
    ctx.arc(shipX, shipY, shipRadius, 0, Math.PI * 2);
    ctx.clip(); // Clip drawing to the circle

    // Use the pre-rendered cache canvas if available (supports both Custom and Base ships)
    const cache = player.hullCacheCanvas || player.shipCacheCanvas;
    if (cache) {
        const scale = (shipRadius * 1.6) / Math.max(cache.width, cache.height);
        ctx.translate(shipX, shipY);
        ctx.rotate(-Math.PI / 2); // Rotate to point up
        ctx.scale(scale, scale);
        ctx.drawImage(cache, -cache.width / 2, -cache.height / 2);
    }
    ctx.restore();

    // 3. Ship Name and Type
    const shipTextX = shipX + shipRadius + 10;
    
    ctx.fillStyle = '#ecf0f1';
    ctx.textAlign = "left";
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.font = "16px 'IM Fell English', serif";
    ctx.fillText(player.displayName || "Unnamed Ship", shipTextX, shipY - 2);
    ctx.fillStyle = '#bdc3c7';
    ctx.font = "italic 12px 'IM Fell English', serif";
    ctx.fillText(player.shipType || "Unknown Class", shipTextX, shipY + 12);

    ctx.restore();

    // --- NEW: Draw NPC ID Card during Boarding ---
    if (boardingState && boardingState.isActive && boardingState.target) {
        drawNpcIdCard(ctx, canvas, boardingState.target);
    } else {
        // --- Draw General Combat Deactivation Timer Bar (Debug) ---
        // Only draw if NOT boarding to keep the top center clear.
        
        // Find the closest NPC that is currently disengaging (timer > 0)
        let relevantNpc = null;
        let minDistance = Infinity;

        for (const npc of npcs) {
            // Check if this NPC is in combat and has a running disengage timer
            if (npc.aiState === 'combat' && npc.combatPilot && npc.combatPilot.disengageTimer > 0) {
                const dist = distance(player, npc);
                if (dist < minDistance) {
                    minDistance = dist;
                    relevantNpc = npc;
                }
            }
        }

        if (relevantNpc) {
            const barWidth = canvas.width / 4;
            const barHeight = 15;
            const barX = (canvas.width - barWidth) / 2;
            const barY = 20;
            const borderRadius = 5;
    
            let timerRatio = 0;
            let label = '';
    
            // Display the general out-of-range deactivation timer.
            timerRatio = relevantNpc.combatPilot.disengageTimer / NPC_COMBAT_DEACTIVATION_TIME;
            const remainingTime = (NPC_COMBAT_DEACTIVATION_TIME - relevantNpc.combatPilot.disengageTimer) / 1000;
            label = `Disengaging: ${remainingTime.toFixed(1)}s`;

            ctx.save();
            // Background
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();

            // Fill
            if (timerRatio > 0) {
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth * timerRatio, barHeight, borderRadius);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
            }

            // Border
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius);
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text
            ctx.fillStyle = '#2c3e50';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, barX + barWidth / 2, barY + barHeight / 2);
            ctx.restore();
        }
    }

    // Draw ship's relative degree direction from the wind
    const angleDiff = normalizeAngle(player.angle - windDirection);
    const absAngleOffWindDegrees = Math.round(Math.abs(angleDiff > Math.PI ? angleDiff - 2 * Math.PI : angleDiff) * 180 / Math.PI);
    const dialSize = 60;
    const margin = 20;
    const dialX = canvas.width - dialSize - margin;
    const dialY = canvas.height - dialSize - margin;
    ctx.save();
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '14px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${absAngleOffWindDegrees}°`, dialX - 10, dialY + dialSize / 2);
    ctx.restore();

    // Draw HP bar
    const barWidth = canvas.width / 4;
    const barHeight = 10;
    const hpBarMargin = 20;
    const barX = (canvas.width - barWidth) / 2;
    const barY = canvas.height - barHeight - hpBarMargin;
    const borderRadius = 8;
    const hpRatio = Math.max(0, player.hp / player.maxHp);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    let hpColor = (hpRatio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (hpRatio / 0.5))}, ${Math.round(20 + (255 - 20) * (hpRatio / 0.5))}, ${Math.round(60 + (255 - 60) * (hpRatio / 0.5))})`;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth * hpRatio, barHeight, borderRadius / 2);
    ctx.fillStyle = hpColor;
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius / 2);
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c3e50';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(player.hp)} / ${player.maxHp} HP`, barX + barWidth / 2, barY + barHeight / 2);
    ctx.restore();

    // --- New: Draw Rigging HP Bar ---
    const rigBarHeight = 10; // Fixed height
    const rigBarY = barY - rigBarHeight - 5; // Positioned directly above the hull HP bar
    const rigHpRatio = Math.max(0, player.rigHp / player.maxRigHp);

    ctx.save();
    // Background
    ctx.beginPath();
    ctx.roundRect(barX, rigBarY, barWidth, rigBarHeight, borderRadius / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // --- FIX: Use the same color logic as the hull HP bar for consistency. ---
    // This makes the bar white when healthy, and transition from yellow to red when damaged.
    const rigHpColor = (rigHpRatio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (rigHpRatio / 0.5))}, ${Math.round(20 + (255 - 20) * (rigHpRatio / 0.5))}, ${Math.round(60 + (255 - 60) * (rigHpRatio / 0.5))})`;
    ctx.beginPath();
    ctx.roundRect(barX, rigBarY, barWidth * rigHpRatio, rigBarHeight, borderRadius / 2);
    ctx.fillStyle = rigHpColor;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.roundRect(barX, rigBarY, barWidth, rigBarHeight, borderRadius / 2);
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1; // Thinner border for the smaller bar
    ctx.stroke();

    // Text
    ctx.fillStyle = '#2c3e50';
    ctx.font = '10px Inter'; // Smaller font for the smaller bar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(player.rigHp)} / ${player.maxRigHp} Rig HP`, barX + barWidth / 2, rigBarY + rigBarHeight / 2);
    ctx.restore();

    // --- New: Draw Crew Num Bar ---
    const crewBarHeight = 10;
    const crewBarY = rigBarY - crewBarHeight - 5; // Positioned directly above the rig HP bar
    const crewRatio = Math.max(0, player.crew / player.maxCrew);

    ctx.save();
    // Background
    ctx.beginPath();
    ctx.roundRect(barX, crewBarY, barWidth, crewBarHeight, borderRadius / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // Fill - Use same color logic as HP for consistency (White -> Yellow -> Red)
    const crewColor = (crewRatio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (crewRatio / 0.5))}, ${Math.round(20 + (255 - 20) * (crewRatio / 0.5))}, ${Math.round(60 + (255 - 60) * (crewRatio / 0.5))})`;
    ctx.beginPath();
    ctx.roundRect(barX, crewBarY, barWidth * crewRatio, crewBarHeight, borderRadius / 2);
    ctx.fillStyle = crewColor;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.roundRect(barX, crewBarY, barWidth, crewBarHeight, borderRadius / 2);
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#2c3e50';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(player.crew)} / ${player.maxCrew} Crew`, barX + barWidth / 2, crewBarY + crewBarHeight / 2);
    ctx.restore();

    // --- FIX: Adjust position of elements above the HP bars ---
    const regenerationBarHeight = 5; // Fixed small height
    const regenerationBarY = crewBarY - regenerationBarHeight - 5; // Position above the new crew bar
    const timeSinceLastActivity = performance.now() - player.lastDamageTime;

    // Draw Regeneration Cooldown Bar (if needed)
    if (player.hp < player.maxHp && timeSinceLastActivity < REGENERATION_COOLDOWN_TIME) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(barX, regenerationBarY, barWidth, regenerationBarHeight, borderRadius);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        const regenFillRatio = Math.min(1, timeSinceLastActivity / REGENERATION_COOLDOWN_TIME);
        ctx.beginPath();
        ctx.roundRect(barX, regenerationBarY, barWidth * regenFillRatio, regenerationBarHeight, borderRadius);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(barX, regenerationBarY, barWidth, regenerationBarHeight, borderRadius);
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    // --- New: Draw Reefed Indicator ---
    // This is drawn after the regen bar logic to correctly position it above.
    // --- FIX: Position above the highest HUD element based on mode ---
    if (player.isReefed) {
        const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
        const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter;
        const buttonRadius = reloadBarDiameter / 2;
        const buttonY = reloadBarY + buttonRadius;

        let highestY = reloadBarY; // Default: Top of Main HUD buttons/indicators

        if (hudMode === 'navigation') {
            const combatBackY = buttonY + 5;
            const rowY = combatBackY - 25;
            highestY = rowY - buttonRadius; // Top of sailing buttons
        } else if (hudMode === 'combat') {
            const combatBackY = buttonY + 5;
            const rowY = combatBackY - 25;
            const carouselY = rowY - 60;
            const centerRadius = 22;
            highestY = carouselY - centerRadius; // Top of shot carousel
        }

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText("REEFED", canvas.width / 2, highestY - 15);
        ctx.restore();
    }

    // Draw shoal/coral reef indicators
    // --- FIX: Position indicators below the ship info panel to avoid overlap with profile ---
    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
        let indicatorY = shipY + shipRadius + 20;
        const indicatorX = shipX;

        if (player.isOverShoal) {
            ctx.save();
            ctx.fillStyle = SHOAL_DETECT_INDICATOR_COLOR;
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, SHOAL_DETECT_INDICATOR_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Label
            ctx.fillStyle = '#ecf0f1';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.fillText("SHOAL", indicatorX + 15, indicatorY);
            
            ctx.restore();
            indicatorY += 25;
        }
        if (player.isOverCoralReef) {
            ctx.save();
            ctx.fillStyle = CORAL_REEF_DETECT_INDICATOR_COLOR;
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, CORAL_REEF_DETECT_INDICATOR_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Label
            ctx.fillStyle = '#ecf0f1';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.fillText("REEF", indicatorX + 15, indicatorY);

            ctx.restore();
        }
    }

    // Draw Anchor Indicator
    drawAnchorIndicator(ctx, canvas, player);

    // Draw Cannon Reload Bars
    const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
    const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter; // Position relative to the new crew bar
    
    // --- FIX: Get the actual broadside count for each side ---
    let portCount = 0;
    let starboardCount = 0;

    if (player.blueprint && typeof player.getBroadsideCount === 'function') {
        portCount = player.getBroadsideCount('port');
        starboardCount = player.getBroadsideCount('starboard');
    } else {
        // Fallback for base ship
        const baseCount = Ship.prototype.getBroadsideCount.call(player);
        portCount = baseCount;
        starboardCount = baseCount;
    }

    const portReloadBarX = barX - CANNON_RING_BUFFER_BAR_MARGIN_X - reloadBarDiameter;
    drawCannonReloadIndicator(ctx, portReloadBarX, reloadBarY, reloadBarDiameter, player.portCannonReloadTime, player.reloadTime, portCount);
    const starboardReloadBarX = barX + barWidth + CANNON_RING_BUFFER_BAR_MARGIN_X;
    drawCannonReloadIndicator(ctx, starboardReloadBarX, reloadBarY, reloadBarDiameter, player.starboardCannonReloadTime, player.reloadTime, starboardCount);

    // --- NEW: Draw Day/Night Dial ---
    drawDayNightDial(ctx, canvas, dayNightTimer);

    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
        drawDayNightDebugButton(ctx, canvas);
    }

    // --- NEW: Hover Labels for Broadside Indicators ---
    const radius = reloadBarDiameter / 2;
    const drawLabel = (text, x, y) => {
        ctx.save();
        ctx.fillStyle = '#ecf0f1';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y);
        ctx.restore();
    };

    const portCx = portReloadBarX + radius;
    const portCy = reloadBarY + radius;
    if (Math.hypot(mouseX - portCx, mouseY - portCy) <= radius) {
        drawLabel("Port Broadside", portCx, portCy + radius + 2);
    }

    const stbdCx = starboardReloadBarX + radius;
    const stbdCy = reloadBarY + radius;
    if (Math.hypot(mouseX - stbdCx, mouseY - stbdCy) <= radius) {
        drawLabel("Starboard Broadside", stbdCx, stbdCy + radius + 2);
    }
}

/**
 * Draws the NPC Ship ID Card at the top center of the HUD during boarding.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {HTMLCanvasElement} canvas - The main game canvas.
 * @param {NpcShip} npc - The NPC ship being boarded.
 */
function drawNpcIdCard(ctx, canvas, npc) {
    const barWidth = canvas.width / 4;
    const barHeight = 10;
    const borderRadius = 8;
    const cardX = (canvas.width - barWidth) / 2;
    let currentY = 20; // Start from top margin

    // 1. Name Tag
    ctx.save();
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 16px "IM Fell English"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // --- OPTIMIZATION: Use hard shadow instead of expensive blur ---
    ctx.fillStyle = 'black';
    ctx.fillText(npc.displayName, canvas.width / 2 + 1, currentY + 1);
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText(npc.displayName, canvas.width / 2, currentY);
    ctx.restore();

    currentY += 25; // Space for name

    // Helper to draw a bar
    const drawBar = (current, max, label, isHull = false) => {
        const ratio = Math.max(0, current / max);
        
        ctx.save();
        // Background
        ctx.beginPath();
        ctx.roundRect(cardX, currentY, barWidth, barHeight, borderRadius / 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // Fill & Border
        ctx.beginPath();
        ctx.roundRect(cardX, currentY, barWidth * ratio, barHeight, borderRadius / 2);
        ctx.fillStyle = (ratio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (ratio / 0.5))}, ${Math.round(20 + (255 - 20) * (ratio / 0.5))}, ${Math.round(60 + (255 - 60) * (ratio / 0.5))})`;
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(cardX, currentY, barWidth, barHeight, borderRadius / 2);
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = isHull ? 2 : 1;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#2c3e50';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(current)} / ${max} ${label}`, cardX + barWidth / 2, currentY + barHeight / 2);
        ctx.restore();

        currentY += barHeight + 5;
    };

    // Draw bars in order: Crew, Rig, Hull (matching player visual stack top-to-bottom)
    drawBar(npc.crew, npc.maxCrew, "Crew");
    drawBar(npc.rigHp, npc.maxRigHp, "Rig HP");
    drawBar(npc.hp, npc.maxHp, "HP", true);
}

/**
 * New: Explicitly hides the shipyard tooltip.
 * This function should be called whenever the shipyard screen is hidden
 * to prevent the tooltip from getting "stuck" on screen.
 */
function hideShipyardTooltip() {
    const tooltip = document.getElementById('shipyard-tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

/**
 * New: Initializes event listeners for UI elements to fix bugs like stuck tooltips.
 * This should be called once when the application loads.
 */
function initializeUIEventListeners() {
    // Find the "Back to Main Menu" button from the Shipyard screen.
    const backButton = document.getElementById('back-to-main-menu-btn');

    if (backButton) {
        // Add a click event listener to the button.
        backButton.addEventListener('click', () => {
            // When the button is clicked, explicitly hide the shipyard tooltip.
            // This prevents it from getting stuck on the screen when navigating away.
            hideShipyardTooltip();
        });
    } else {
        console.warn("Could not find the 'Back to Main Menu' button to attach tooltip fix.");
    }
}

/**
 * Helper function to draw a parsed SVG path.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {object|Array} pathData - The path data, either an array of commands or an object with a .points property.
 * @param {string} fillStyle 
 * @param {string} [strokeStyle] - Optional stroke color.
 * @param {number} [lineWidth] - Optional stroke width.
 */
function drawSvgPath(ctx, pathData, fillStyle, strokeStyle, lineWidth) {
    if (!pathData) return;
    // FIX: Prioritize 'commands' if available, otherwise fall back to 'points'
    const items = Array.isArray(pathData) ? pathData : (pathData.commands || pathData.points || []);

    if (!Array.isArray(items) || items.length === 0) return;

    ctx.beginPath();
    
    // Check if it's a list of points (polyline) or commands
    if (items[0].x !== undefined) {
        // It's a list of points
        ctx.moveTo(items[0].x, items[0].y);
        for (let i = 1; i < items.length; i++) {
            ctx.lineTo(items[i].x, items[i].y);
        }
        ctx.closePath();
    } else {
        // It's a list of commands
        for (const cmd of items) {
            switch (cmd.type) {
                case 'M':
                    ctx.moveTo(cmd.values[0], cmd.values[1]);
                    break;
                case 'L':
                    ctx.lineTo(cmd.values[0], cmd.values[1]);
                    break;
                case 'C':
                    ctx.bezierCurveTo(cmd.values[0], cmd.values[1], cmd.values[2], cmd.values[3], cmd.values[4], cmd.values[5]);
                    break;
                case 'Q':
                    ctx.quadraticCurveTo(cmd.values[0], cmd.values[1], cmd.values[2], cmd.values[3]);
                    break;
                case 'Z':
                    ctx.closePath();
                    break;
            }
        }
    }
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill('evenodd'); // FIX: Use 'evenodd' rule for compound SVG paths
    }
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth || 1;
        ctx.stroke();
    }
}

/**
 * Helper function to calculate the bounding box of SVG path data.
 * @param {Array} pathData 
 * @returns {object} {minX, minY, maxX, maxY, width, height}
 */
function getPathBounds(pathData) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // FIX: Prioritize 'commands' if available
    const items = Array.isArray(pathData) ? pathData : (pathData.commands || pathData.points || []);

    if (items.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

    for (const item of items) {
        if (item.values) {
            // Command style
            const values = item.values;
            for (let i = 0; i < values.length; i += 2) {
                const x = values[i];
                const y = values[i+1];
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        } else if (item.x !== undefined) {
            // Point style
            const x = item.x;
            const y = item.y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Draws the new HUD control buttons (Navigation, etc.).
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {PlayerShip} player - The player ship object.
 * @param {string} hudMode - The current HUD mode ('main' or 'combat').
 * @param {Array} clickTimes - Array of timestamps for button clicks.
 * @param {number} mouseX - The current screen-space mouse X.
 * @param {number} mouseY - The current screen-space mouse Y.
 */
function drawHudControls(ctx, canvas, player, hudMode = 'main', clickTimes = [], mouseX = 0, mouseY = 0) {
    // Ensure the icon data exists before attempting to draw
    if (!NAVIGATION_ICON_DATA) return;

    // --- FIX: Only draw controls if the player exists (game is active) ---
    if (!player) return;

    // --- Reconstruct HUD layout to align with broadside indicators ---
    const hpBarHeight = 10;
    const hpBarMargin = 20;
    const hullBarY = canvas.height - hpBarHeight - hpBarMargin;
    
    const rigBarHeight = 10;
    const rigBarY = hullBarY - rigBarHeight - 5;
    
    const crewBarHeight = 10;
    const crewBarY = rigBarY - crewBarHeight - 5;
    
    const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
    // reloadBarY is the top-left Y of the reload indicator box
    const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter;

    // Calculate position for the buttons
    // They should be centered horizontally, aligned vertically with the reload indicators.
    const buttonDiameter = reloadBarDiameter; 
    const buttonRadius = buttonDiameter / 2;
    const buttonY = reloadBarY + buttonRadius;
    
    const gap = 15; // Spacing between buttons
    const centerX = canvas.width / 2;
    
    // Navigation Button (Left)
    const navButtonX = centerX - buttonDiameter - gap;
    
    // Combat Button (Center)
    const combatButtonX = centerX;

    // Inventory Button (Right)
    const inventoryButtonX = centerX + buttonDiameter + gap;

    // --- Helper to draw a button background ---
    const drawButtonBackground = (x, y, isPressed = false) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, buttonRadius, 0, Math.PI * 2);
        ctx.fillStyle = isPressed ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)'; // Darker when pressed
        ctx.fill();
        ctx.strokeStyle = isPressed ? '#bbbbbb' : 'white'; // Slightly dimmer border
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    };

    // --- Helper to draw a cannon barrel (Hoisted for reuse) ---
    const drawBarrel = () => {
        const L = buttonRadius * 1.4; // Length of barrel
        const W = L * 0.25; // Width at breech
        
        const knobR = W * 0.25;
        const neckL = knobR;
        const breechL = L * 0.25;
        const chaseL = L * 0.55;
        const swellL = L * 0.08;
        const faceL = L * 0.02;
        
        // Center the barrel horizontally
        const totalLen = knobR + neckL + breechL + chaseL + swellL + faceL;
        const startX = -totalLen / 2;
        
        ctx.fillStyle = 'white';
        
        // 3. Cascabel Knob
        const knobX = startX + knobR;
        ctx.beginPath();
        ctx.arc(knobX, 0, knobR, 0, Math.PI * 2);
        ctx.fill();
        
        // 4. Cascabel Neck
        const neckX = knobX;
        ctx.beginPath();
        ctx.rect(neckX, -knobR, neckL, knobR * 2);
        ctx.fill();
        
        // 5. Breech
        const breechX = neckX + neckL;
        ctx.beginPath();
        ctx.moveTo(breechX, -W/2);
        ctx.lineTo(breechX + breechL, -W/2);
        ctx.lineTo(breechX + breechL, W/2);
        ctx.lineTo(breechX, W/2);
        ctx.quadraticCurveTo(breechX - breechL * 0.2, 0, breechX, -W/2);
        ctx.fill();
        
        // 6. Chase
        const chaseX = breechX + breechL;
        const chaseEndW = W * 0.7;
        ctx.beginPath();
        ctx.moveTo(chaseX, -W/2);
        ctx.lineTo(chaseX + chaseL, -chaseEndW/2);
        ctx.lineTo(chaseX + chaseL, chaseEndW/2);
        ctx.lineTo(chaseX, W/2);
        ctx.fill();
        
        // 7. Vent Field (Simplified)
        ctx.beginPath();
        ctx.arc(chaseX + chaseL * 0.1, 0, W * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // 8. Muzzle Swell
        const swellX = chaseX + chaseL;
        const swellW = W * 0.9;
        ctx.beginPath();
        ctx.moveTo(swellX, -chaseEndW/2);
        ctx.lineTo(swellX + swellL, -swellW/2);
        ctx.lineTo(swellX + swellL, swellW/2);
        ctx.lineTo(swellX, chaseEndW/2);
        ctx.fill();
        
        // 9. Muzzle Face
        const faceX = swellX + swellL;
        const faceW = W * 0.8;
        ctx.beginPath();
        ctx.rect(faceX, -faceW/2, faceL, faceW);
        ctx.fill();
    };

    // --- Helper to draw a directional arrow ---
    const drawArrow = (x, y, size, angle) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -size/2);
        ctx.lineTo(size/2, size/2);
        ctx.lineTo(-size/2, size/2);
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.restore();
    };

    // --- Helper to draw a hover label ---
    const drawLabel = (text, x, y) => {
        ctx.save();
        ctx.fillStyle = '#ecf0f1';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y);
        ctx.restore();
    };

    if (hudMode === 'main') {

    // 1. Draw Navigation Button
    drawButtonBackground(navButtonX, buttonY);
    
    ctx.save();
    ctx.translate(navButtonX, buttonY);

    // Draw Icon
    // --- DIRECT VECTOR DRAWING ---
    // Draw the SVG paths directly to ensure perfect sharpness at any scale.
    // The geometry is simple enough that caching is not required for performance.
    
    // Use the Main Star's dimensions to determine the scale for both components.
    // We use the pre-calculated original dimensions from the parser if available.
    const width = NAVIGATION_ICON_DATA.originalWidth || 100;
    const height = NAVIGATION_ICON_DATA.originalHeight || 100;

    if (width > 0 && height > 0) {
        const targetSize = buttonDiameter * 0.6; // 60% of button size
        const maxDim = Math.max(width, height);
        const scale = targetSize / maxDim;

        ctx.save();
        ctx.scale(scale, scale);
        
        // 1. Draw Diagonal Star (Background)
        if (NAVIGATION_ICON_DIAGONAL_DATA) {
            drawSvgPath(ctx, NAVIGATION_ICON_DIAGONAL_DATA, 'white');

            // 2. Draw Ring
            ctx.beginPath();
            ctx.arc(0, 0, UI_COMPASS_RING_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();
        }
        
        // 3. Draw Main Star (Foreground)
        drawSvgPath(ctx, NAVIGATION_ICON_DATA, 'white');
        
        ctx.restore();
    }
    ctx.restore();

    if (Math.hypot(mouseX - navButtonX, mouseY - buttonY) <= buttonRadius) {
        drawLabel("Navigation", navButtonX, buttonY + buttonRadius + 2);
    }

    // 2. Draw Combat Button
    drawButtonBackground(combatButtonX, buttonY);

    ctx.save();
    ctx.translate(combatButtonX, buttonY);
    
    // Draw Combat Icon (Crossed Cannons)
    // Draw two crossed barrels
    ctx.save();
    ctx.rotate(-Math.PI / 4); // Pointing Top-Right
    drawBarrel();
    ctx.restore();

    ctx.save();
    ctx.rotate(-Math.PI * 0.75); // Pointing Top-Left
    drawBarrel();
    ctx.restore();
    
    // Draw Pyramidal Circles (Cannonballs) in the top space
    ctx.save();
    ctx.translate(0, -buttonRadius * 0.5); 
    const pyramidScale = 0.5;
    ctx.scale(pyramidScale, pyramidScale);

    const iconRadius = buttonRadius * 0.6; 
    const circleRadius = iconRadius * 0.35;
    const offsetY = circleRadius * 0.8;
    const offsetX = circleRadius * 1.1;

    ctx.fillStyle = 'white';
    
    // Top Circle
    ctx.beginPath();
    ctx.arc(0, -offsetY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Bottom Left
    ctx.beginPath();
    ctx.arc(-offsetX, offsetY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Bottom Right
    ctx.beginPath();
    ctx.arc(offsetX, offsetY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    
    ctx.restore();

    if (Math.hypot(mouseX - combatButtonX, mouseY - buttonY) <= buttonRadius) {
        drawLabel("Combat", combatButtonX, buttonY + buttonRadius + 2);
    }

    // 3. Draw Inventory Button
    drawButtonBackground(inventoryButtonX, buttonY);

    ctx.save();
    ctx.translate(inventoryButtonX, buttonY);
    
    // Draw Inventory Icon (Square Lattice)
    const iconSize = buttonRadius * 0.55; // Half-width of the square
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1; 
    
    // Hollow Square
    ctx.strokeRect(-iconSize, -iconSize, iconSize * 2, iconSize * 2);
    
    // Lattice (5 bars)
    ctx.beginPath();
    const numBars = 5;
    const totalWidth = iconSize * 2;
    const step = totalWidth / (numBars + 1);
    
    // Vertical & Horizontal bars
    for (let i = 1; i <= numBars; i++) {
        const offset = -iconSize + i * step;
        ctx.moveTo(offset, -iconSize); ctx.lineTo(offset, iconSize); // Vertical
        ctx.moveTo(-iconSize, offset); ctx.lineTo(iconSize, offset); // Horizontal
    }
    ctx.stroke();
    
    ctx.restore();

    if (Math.hypot(mouseX - inventoryButtonX, mouseY - buttonY) <= buttonRadius) {
        drawLabel("Inventory", inventoryButtonX, buttonY + buttonRadius + 2);
    }

    } else if (hudMode === 'combat') {
        // Shift down to reduce gap to HP bars by half (Margin is 10, so shift down by 5)
        const combatBackY = buttonY + 5;

        // Draw 6 Combat Buttons + Back Button
        const rowY = combatBackY - 25; // Single row above back button
        const spacing = buttonDiameter + gap; // 25 + 15 = 40
        // Offsets for 6 buttons centered: -2.5, -1.5, -0.5, 0.5, 1.5, 2.5 * spacing
        const xOffsets = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(factor => factor * spacing);

        const combatLabels = ["Fire All", "Port Broadside", "Starboard Broadside", "Bow Chasers", "Stern Chasers", ""]; // 6th button unused in loop logic below?
        // Actually the loop logic defines 5 specific buttons (indices 0-4). The 6th offset is generated but the loop logic only has if/else if for 0-4.
        // Wait, the loop iterates xOffsets which has 6 elements.

        // Draw the 6 circular buttons
        xOffsets.forEach((xOffset, index) => {
            const isPressed = clickTimes[index] && (performance.now() - clickTimes[index] < 150);
            drawButtonBackground(centerX + xOffset, rowY, isPressed);
            
            if (index === 0) { // Button 1: Fire All Cannons
                ctx.save();
                ctx.translate(centerX + xOffset, rowY);
                const scale = 0.4; // Slightly smaller to fit the ring
                ctx.scale(scale, scale);
                
                const L = buttonRadius * 1.4;
                const ringRadius = L * 0.6; // Distance from center to breech

                // Angles: 0, 180, 60, 120, -60, -120 (in degrees)
                // Converted to radians: 0, PI, PI/3, 2PI/3, -PI/3, -2PI/3
                const angles = [0, Math.PI, Math.PI / 3, (2 * Math.PI) / 3, -Math.PI / 3, -(2 * Math.PI) / 3];

                angles.forEach(angle => {
                    ctx.save();
                    ctx.rotate(angle);
                    ctx.translate(ringRadius, 0); // Move out to ring radius
                    drawBarrel();
                    ctx.restore();
                });
                ctx.restore();
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Fire All", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            else if (index === 1) { // Button 2: Fire Port Broadside
                ctx.save();
                ctx.translate(centerX + xOffset, rowY);
                const scale = 0.55;
                ctx.scale(scale, scale);
                
                const L = buttonRadius * 1.4;
                const W = L * 0.25;
                const spacing = W * 1.2;
                // Center the group horizontally
                const xShift = 0; 

                // Left facing only
                for (let i = -1; i <= 1; i++) {
                    ctx.save();
                    ctx.translate(xShift, i * spacing);
                    ctx.rotate(-Math.PI * 0.75); // 135 degrees up-left
                    drawBarrel();
                    ctx.restore();
                }
                ctx.restore();
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Port Fire", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            else if (index === 2) { // Button 3: Fire Starboard Broadside
                ctx.save();
                ctx.translate(centerX + xOffset, rowY);
                const scale = 0.55;
                ctx.scale(scale, scale);
                
                const L = buttonRadius * 1.4;
                const W = L * 0.25;
                const spacing = W * 1.2;
                const xShift = 0;

                // Right facing only
                for (let i = -1; i <= 1; i++) {
                    ctx.save();
                    ctx.translate(xShift, i * spacing);
                    ctx.rotate(-Math.PI / 4); // 45 degrees up-right
                    drawBarrel();
                    ctx.restore();
                }
                ctx.restore();
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Starboard Fire", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            else if (index === 3) { // Button 4: Fire Bow Chasers
                ctx.save();
                ctx.translate(centerX + xOffset, rowY);
                const scale = 0.55;
                ctx.scale(scale, scale);
                
                const L = buttonRadius * 1.4;
                const W = L * 0.25;
                const spacing = W * 1.2;
                
                // Draw Arrow (Pointing Up)
                drawArrow(0, -L * 0.8, 10, 0);

                // Point Up
                ctx.rotate(-Math.PI / 2);

                // Two barrels side-by-side
                [-0.5, 0.5].forEach(offset => {
                    ctx.save();
                    ctx.translate(0, offset * spacing);
                    drawBarrel();
                    ctx.restore();
                });
                ctx.restore();
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Bow Fire", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            else if (index === 4) { // Button 5: Fire Stern Chasers
                ctx.save();
                ctx.translate(centerX + xOffset, rowY);
                const scale = 0.55;
                ctx.scale(scale, scale);
                
                const L = buttonRadius * 1.4;
                const W = L * 0.25;
                const spacing = W * 1.2;

                // Draw Arrow (Pointing Down)
                drawArrow(0, L * 0.8, 10, Math.PI);

                // Point Down
                ctx.rotate(Math.PI / 2);

                // Two barrels side-by-side
                [-0.5, 0.5].forEach(offset => {
                    ctx.save();
                    ctx.translate(0, offset * spacing);
                    drawBarrel();
                    ctx.restore();
                });
                ctx.restore();
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Stern Fire", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
        });

        // --- NEW: Shot Type Carousel (Rotational) ---
        const carouselY = rowY - 60; // Position above the combat buttons
        const shotTypes = ['round-shot', 'chain-shot', 'grape-shot', 'canister-shot'];
        const currentIndex = shotTypes.indexOf(player.selectedShotType);
        
        // Calculate indices for display (infinite loop)
        const prevIndex = (currentIndex - 1 + shotTypes.length) % shotTypes.length;
        const nextIndex = (currentIndex + 1) % shotTypes.length;
        
        const centerRadius = 22;
        const sideRadius = 16;
        const sideOffset = 50;
        const arrowOffset = 85;

        // Helper to draw a shot item
        const drawCarouselItem = (type, x, y, radius, isSelected) => {
            ctx.save();
            ctx.translate(x, y);
            
            const alpha = isSelected ? 1.0 : 0.5;
            const scale = isSelected ? 1.2 : 0.8;
            
            ctx.scale(scale, scale);

            // Draw Background
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)'; // Gold highlight if selected
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#FFD700' : `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();

            // Draw Icon
            if (type === 'round-shot') {
                // Draw single round shot (mimicking CargoIconSystem style)
                const r = radius * 0.4;
                ctx.fillStyle = '#202020'; // Iron color
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Shine
                ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * alpha})`;
                ctx.beginPath();
                ctx.arc(-r*0.3, -r*0.3, r*0.4, 0, Math.PI * 2);
                ctx.fill();
            } else if (type === 'chain-shot') {
                const r = radius * 0.28; // Size of shot halves
                const dist = radius * 0.25; // Distance from center (closer together)

                // Draw Chain (Line of overlapping rings)
                ctx.strokeStyle = `rgba(105, 105, 105, ${alpha})`; // Dark grey chain
                ctx.lineWidth = 1.2;
                
                // Draw links in a small loop/curve between the shots
                const linkR = r * 0.4;
                const chainY = r * 0.6;
                
                // Draw overlapping rings to simulate a chain loop
                ctx.beginPath(); ctx.arc(-dist * 0.6, chainY * 0.5, linkR, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(-dist * 0.2, chainY, linkR, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(dist * 0.2, chainY, linkR, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(dist * 0.6, chainY * 0.5, linkR, 0, Math.PI*2); ctx.stroke();

                // Draw Halves
                ctx.fillStyle = '#202020';
                ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
                ctx.lineWidth = 1;

                // Left Half (Flat side facing right)
                ctx.beginPath();
                ctx.arc(-dist, 0, r, Math.PI * 0.5, Math.PI * 1.5);
                ctx.lineTo(-dist, -r);
                ctx.fill();
                ctx.stroke();

                // Right Half (Flat side facing left)
                ctx.beginPath();
                ctx.arc(dist, 0, r, Math.PI * 1.5, Math.PI * 0.5);
                ctx.lineTo(dist, r);
                ctx.fill();
                ctx.stroke();
                
                // Shine
                ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * alpha})`;
                ctx.beginPath(); ctx.arc(-dist - r*0.4, -r*0.4, r*0.3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(dist + r*0.4, -r*0.4, r*0.3, 0, Math.PI * 2); ctx.fill();
            } else if (type === 'grape-shot') {
                const r = radius * 0.12; // Small ball radius (approx 1/3 of normal)
                const dy = r * 1.6; // Vertical spacing
                
                // Calculate total height to center it
                // 5 rows of balls (centers at 0, dy, 2dy, 3dy, 4dy)
                // Base below row 5.
                const baseH = r * 0.6;
                const totalH = (4 * dy) + (2 * r) + baseH;
                const startY = -totalH / 2 + r;

                // Draw Balls
                ctx.fillStyle = '#202020';
                ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
                ctx.lineWidth = 1;

                const drawBall = (bx, by) => {
                    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    // Shine
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * alpha})`;
                    ctx.beginPath(); ctx.arc(bx - r*0.3, by - r*0.3, r*0.4, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#202020'; // Reset
                };

                // Row 1 (Top)
                drawBall(-r * 0.9, startY); drawBall(r * 0.9, startY);
                // Row 2
                drawBall(0, startY + dy);
                // Row 3
                drawBall(-r * 0.9, startY + 2*dy); drawBall(r * 0.9, startY + 2*dy);
                // Row 4
                drawBall(0, startY + 3*dy);
                // Row 5 (Bottom)
                drawBall(-r * 0.9, startY + 4*dy); drawBall(r * 0.9, startY + 4*dy);

                // Draw Rope (Atop balls)
                ctx.strokeStyle = `rgba(160, 130, 90, ${alpha})`; // Rope color
                ctx.lineWidth = 1.5;
                
                // Helper to draw S-curve between two points
                const drawRopeSegment = (x1, y1, x2, y2) => {
                    // Inverted S-curve (Horizontal bias instead of Vertical)
                    const midX = (x1 + x2) / 2;
                    const cp1x = midX;
                    const cp1y = y1;
                    const cp2x = midX;
                    const cp2y = y2;
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
                };

                // Diagonal lashings (snaking)
                ctx.beginPath();
                ctx.moveTo(-0.9 * r, startY - r); // Rope 1: Top-Left Top
                drawRopeSegment(-0.9 * r, startY - r, 1.5 * r, startY + dy); // To Row 2 Right Side
                drawRopeSegment(1.5 * r, startY + dy, -1.5 * r, startY + 3 * dy); // To Row 4 Left Side
                drawRopeSegment(-1.5 * r, startY + 3 * dy, 0.9 * r, startY + 4 * dy + r); // To Row 5 Bottom Right
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(0.9 * r, startY - r); // Rope 2: Top-Right Top
                drawRopeSegment(0.9 * r, startY - r, -1.5 * r, startY + dy); // To Row 2 Left Side
                drawRopeSegment(-1.5 * r, startY + dy, 1.5 * r, startY + 3 * dy); // To Row 4 Right Side
                drawRopeSegment(1.5 * r, startY + 3 * dy, -0.9 * r, startY + 4 * dy + r); // To Row 5 Bottom Left
                ctx.stroke();

                // Draw Base (Atop everything)
                const baseY = startY + 4 * dy + r; // Base top adjacent to bottom of lowest balls
                const baseW = r * 3.8; // Width of two balls side-by-side (1.9r * 2)
                ctx.fillStyle = `rgba(100, 60, 20, ${alpha})`; // Dark Wood
                ctx.beginPath();
                // Simple rounded rect path
                const bx = -baseW / 2;
                const by = baseY;
                const br = 2;
                ctx.moveTo(bx + br, by);
                ctx.lineTo(bx + baseW - br, by);
                ctx.quadraticCurveTo(bx + baseW, by, bx + baseW, by + br);
                ctx.lineTo(bx + baseW, by + baseH - br);
                ctx.quadraticCurveTo(bx + baseW, by + baseH, bx + baseW - br, by + baseH);
                ctx.lineTo(bx + br, by + baseH);
                ctx.quadraticCurveTo(bx, by + baseH, bx, by + baseH - br);
                ctx.lineTo(bx, by + br);
                ctx.quadraticCurveTo(bx, by, bx + br, by);
                ctx.closePath();
                ctx.fill();
            } else if (type === 'canister-shot') {
                const bodyH = radius * 1.2;
                const bodyW = bodyH / 2;
                const thinRectH = bodyW * 0.15;
                const totalIconHeight = bodyH + (4 * thinRectH);
                const startY = -totalIconHeight / 2;

                const bodyColor = `rgba(189, 195, 199, ${alpha})`; // Grey ('#bdc3c7')
                const bodyOutlineColor = `rgba(160, 165, 170, ${alpha})`; // Slightly darker grey
                const detailColor = `rgba(127, 140, 141, ${alpha})`; // Darker Grey ('#7f8c8d')
                const darkestDetailColor = `rgba(85, 95, 95, ${alpha})`; // Even Darker Grey

                // Body
                ctx.fillStyle = bodyColor;
                ctx.fillRect(-bodyW / 2, startY + thinRectH, bodyW, bodyH);
                ctx.strokeStyle = bodyOutlineColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(-bodyW / 2, startY + thinRectH, bodyW, bodyH);

                // Lid
                ctx.fillStyle = detailColor;
                ctx.fillRect(-bodyW / 2, startY, bodyW, thinRectH);

                // Base
                const baseY = startY + thinRectH + bodyH;
                ctx.fillRect(-bodyW / 2, baseY, bodyW, thinRectH); // Top base rect
                
                ctx.fillStyle = darkestDetailColor;
                ctx.fillRect(-(bodyW * 0.9) / 2, baseY + thinRectH, bodyW * 0.9, thinRectH); // Middle base rect
                
                ctx.fillStyle = detailColor;
                ctx.fillRect(-bodyW / 2, baseY + (2 * thinRectH), bodyW, thinRectH); // Bottom base rect
            } else {
                // Placeholder text for others
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(type.charAt(0).toUpperCase(), 0, 0);
            }

            ctx.restore();
        };

        // Draw Side Items (Previous and Next)
        drawCarouselItem(shotTypes[prevIndex], centerX - sideOffset, carouselY, sideRadius, false);
        drawCarouselItem(shotTypes[nextIndex], centerX + sideOffset, carouselY, sideRadius, false);

        // Draw Center Item (Selected)
        drawCarouselItem(shotTypes[currentIndex], centerX, carouselY, centerRadius, true);

        // Draw Label for Selected (Dynamic: Name -> Quantity)
        const selectedShotId = shotTypes[currentIndex];
        let labelText = selectedShotId.replace('-', ' ').toUpperCase();
        
        // Calculate Quantity
        let shotCount = 0;
        if (player.inventory && player.inventory.cargo) {
             const itemDef = window.ITEM_DATABASE?.[selectedShotId];
             if (itemDef) {
                 const itemUnitSize = (typeof itemDef.fixedSize === 'number') ? itemDef.fixedSize : itemDef.weight;
                 let totalMass = 0;
                 for (const entry of player.inventory.cargo) {
                     if (entry.item.id === selectedShotId) {
                         const entryUnitWeight = (entry.container && entry.container.weight > 0) ? entry.container.weight : itemUnitSize;
                         totalMass += entry.quantity * entryUnitWeight;
                     }
                 }
                 shotCount = Math.floor(totalMass / itemUnitSize);
             }
        }

        // Switch to quantity after 2 seconds
        if (player.lastShotTypeSelectionTime && (performance.now() - player.lastShotTypeSelectionTime > 2000)) {
            labelText = `${shotCount}`;
        }

        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.font = '12px "IM Fell English"';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, centerX, carouselY + centerRadius + 15);
        ctx.restore();

        // Draw Arrows
        const drawCarouselArrow = (x, dir) => {
            ctx.save();
            ctx.translate(x, carouselY);
            ctx.beginPath();
            if (dir === 'left') {
                ctx.moveTo(5, -8); ctx.lineTo(-5, 0); ctx.lineTo(5, 8);
            } else {
                ctx.moveTo(-5, -8); ctx.lineTo(5, 0); ctx.lineTo(-5, 8);
            }
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        };

        drawCarouselArrow(centerX - arrowOffset, 'left');
        drawCarouselArrow(centerX + arrowOffset, 'right');

        // Draw Back Button (Flat Triangle pointing down)
        ctx.save();
        ctx.translate(centerX, combatBackY);
        
        ctx.beginPath();
        const triW = 12;
        const triH = 6;
        // Draw inverted triangle
        ctx.moveTo(-triW/2, -triH/2);
        ctx.lineTo(triW/2, -triH/2);
        ctx.lineTo(0, triH/2);
        ctx.closePath();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        if (Math.hypot(mouseX - centerX, mouseY - combatBackY) <= buttonRadius) {
            drawLabel("Back", centerX, combatBackY + buttonRadius + 2);
        }
    } else if (hudMode === 'navigation') {
        const combatBackY = buttonY + 5;
        const rowY = combatBackY - 25;
        const spacing = buttonDiameter + gap;

        // 6 Buttons: Open, Close, Reef, Crow's Nest, Anchor, Lights
        const xOffsets = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(factor => factor * spacing);

        xOffsets.forEach((xOffset, index) => {
            const isPressed = clickTimes[index] && (performance.now() - clickTimes[index] < 150);
            drawButtonBackground(centerX + xOffset, rowY, isPressed);
            
            ctx.save();
            ctx.translate(centerX + xOffset, rowY);
            
            // Common Icon Styles
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (index === 0) { // Open Sails
                ctx.save();
                ctx.scale(0.5, 0.5);
                // Mast
                ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                // Yard
                ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); ctx.stroke();
                // Sail (Full)
                ctx.beginPath();
                ctx.moveTo(-13, -10);
                ctx.quadraticCurveTo(-15, 0, -13, 10); // Left edge curves out
                ctx.quadraticCurveTo(0, 15, 13, 10);   // Bottom edge curves down
                ctx.quadraticCurveTo(15, 0, 13, -10);  // Right edge curves out
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // --- NEW: Active state indicator for "Full Sail" ---
                if (player.isSailOpen && !player.isReefed) {
                    ctx.strokeStyle = '#FFD700'; // Gold
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2);
                    ctx.stroke();
                }

                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Open Sails", centerX + xOffset, rowY + buttonRadius + 2);
                }
            } 
            else if (index === 1) { // Close Sails
                ctx.save();
                ctx.scale(0.5, 0.5);
                // Mast
                ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                // Yard
                ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); ctx.stroke();
                // Furled Canvas (Lumpy shape on yard)
                ctx.beginPath();
                ctx.moveTo(-13, -10);
                ctx.bezierCurveTo(-7, -4, 7, -4, 13, -10);
                ctx.fill();
                ctx.restore();

                // --- NEW: Active state indicator for "Closed/Furled" ---
                if (!player.isSailOpen) {
                    ctx.strokeStyle = '#FFD700'; // Gold
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2);
                    ctx.stroke();
                }

                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Close Sails", centerX + xOffset, rowY + buttonRadius + 2);
                }
            } 
            else if (index === 2) { // Reef Sails
                ctx.save();
                ctx.scale(0.5, 0.5);
                // Mast
                ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                // Yard
                ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); ctx.stroke();
                // Reefed Sail (Half height)
                ctx.beginPath();
                ctx.moveTo(-13, -10);
                ctx.lineTo(-12, 2); // Straighter sides
                ctx.quadraticCurveTo(0, 6, 12, 2); // Bottom
                ctx.lineTo(13, -10);
                ctx.closePath();
                ctx.fill();
                
                // Reef Points (Ties hanging down)
                ctx.strokeStyle = '#333'; // Dark contrast
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-6, 2); ctx.lineTo(-6, 6);
                ctx.moveTo(0, 4); ctx.lineTo(0, 8);
                ctx.moveTo(6, 2); ctx.lineTo(6, 6);
                ctx.stroke();
                ctx.restore();

                // --- MODIFIED: Active Indicator for "Reefed" state ---
                // This is now mutually exclusive with the other sail state indicators.
                if (player.isSailOpen && player.isReefed) {
                    ctx.strokeStyle = '#FFD700'; // Gold
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Reef Sails", centerX + xOffset, rowY + buttonRadius + 2);
                }
            } 
            else if (index === 3) { // Crow's Nest
                ctx.save();
                ctx.scale(0.5, 0.5);
                // Mast
                ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                // Crow's Nest (Upside down trapezoid / Basket) - Made larger and moved down
                ctx.beginPath();
                const topW = 9;    // 1.5x original 6
                const bottomW = 6; // 1.5x original 4
                const topY = -12;  // Moved down from -14 to show mast tip
                const bottomY = 0; // 1.5x original height of 8 = 12. -12 + 12 = 0.
                ctx.moveTo(-topW, topY);     // Top Left
                ctx.lineTo(topW, topY);      // Top Right
                ctx.lineTo(bottomW, bottomY);    // Bottom Right
                ctx.lineTo(-bottomW, bottomY);   // Bottom Left
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Crow's Nest", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            else if (index === 4) { // Anchor
                // Draw Icon
                if (ANCHOR_ICON_DATA) {
                    ctx.save();
                    const scale = (buttonRadius * 1.2) / Math.max(ANCHOR_ICON_DATA.originalWidth, ANCHOR_ICON_DATA.originalHeight);
                    ctx.scale(scale, scale);
                    ctx.beginPath();
                    ANCHOR_ICON_DATA.points.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                // Active Indicator (Yellow Ring)
                if (player.isAnchored) {
                    ctx.strokeStyle = '#FFD700'; // Gold
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Anchor", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            else if (index === 5) { // Lights Toggle
                ctx.save();
                ctx.scale(0.5, 0.5);
                // Draw a lightbulb icon
                // Base
                ctx.beginPath();
                ctx.rect(-6, 8, 12, 4);
                ctx.fill();
                // Bulb
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                // Filament
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-3, 0); ctx.lineTo(-3, 6);
                ctx.moveTo(3, 0); ctx.lineTo(3, 6);
                ctx.moveTo(-3, 3); ctx.lineTo(3, 3);
                ctx.stroke();

                // "Off" slash if lights are off
                if (player && !player.lightsOn) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(-12, -12);
                    ctx.lineTo(12, 12);
                    ctx.stroke();
                }
                ctx.restore();

                // Active indicator
                if (player && player.lightsOn) {
                    ctx.strokeStyle = '#FFD700'; // Gold
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
                if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                    drawLabel("Toggle Lights", centerX + xOffset, rowY + buttonRadius + 2);
                }
            }
            
            ctx.restore();
        });

        // --- NEW: Add a visual divider between button groups ---
        // This visually separates the sailing controls from the utility controls.
        const dividerX = centerX; // Positioned in the gap between Reef and Crow's Nest
        const dividerTopY = rowY - buttonRadius * 0.8; // Slightly shorter than button height
        const dividerBottomY = rowY + buttonRadius * 0.8;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dividerX, dividerTopY);
        ctx.lineTo(dividerX, dividerBottomY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Faint white line
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Draw Back Button (Same as combat)
        ctx.save();
        ctx.translate(centerX, combatBackY);
        ctx.beginPath();
        const triW = 12;
        const triH = 6;
        ctx.moveTo(-triW/2, -triH/2);
        ctx.lineTo(triW/2, -triH/2);
        ctx.lineTo(0, triH/2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        if (Math.hypot(mouseX - centerX, mouseY - combatBackY) <= buttonRadius) {
            drawLabel("Back", centerX, combatBackY + buttonRadius + 2);
        }
    }
}