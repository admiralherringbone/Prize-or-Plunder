/**
 * Handles procedural generation and caching of inventory icons.
 * This module is being incrementally populated.
 */
window.CargoIconSystem = window.CargoIconSystem || {};

Object.assign(window.CargoIconSystem, {
    drawBarrel(ctx, x, y, w, h) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        // Barrel shape parameters: Top/Bottom are narrower than the middle (bulge)
        const topW = w * 0.8;
        const bottomW = w * 0.8;
        const midW = w; 

        // Define the barrel body path
        ctx.beginPath();
        ctx.moveTo(cx - topW / 2, y); // Top Left
        ctx.quadraticCurveTo(x, cy, cx - bottomW / 2, y + h); // Curve to Bottom Left
        ctx.lineTo(cx + bottomW / 2, y + h); // Bottom Right
        ctx.quadraticCurveTo(x + w, cy, cx + topW / 2, y); // Curve to Top Right
        ctx.closePath();

        // Fill Body
        ctx.fillStyle = '#8B4513'; // SaddleBrown
        ctx.fill();
        
        // Draw Outline (Moved up so hoops draw on top of it)
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Save context for clipping (everything inside the barrel shape)
        ctx.save();
        ctx.clip();

        // Draw Vertical Planks (5 lines)
        ctx.strokeStyle = '#5D2906'; // Darker brown
        ctx.lineWidth = 1;
        
        // Helper to draw curved vertical lines
        const drawPlankLine = (xFactor) => {
            // xFactor: -1 (left) to 1 (right). 0 is center.
            const tx = cx + (topW / 2) * xFactor;
            const mx = cx + (midW / 2) * xFactor;
            const bx = cx + (bottomW / 2) * xFactor;
            
            ctx.beginPath();
            ctx.moveTo(tx, y);
            ctx.quadraticCurveTo(mx, cy, bx, y + h);
            ctx.stroke();
        };

        // Draw 5 lines distributed across the width
        drawPlankLine(0);     // Center (Straight)
        drawPlankLine(-0.35); // Left Inner
        drawPlankLine(0.35);  // Right Inner
        drawPlankLine(-0.7);  // Left Outer
        drawPlankLine(0.7);   // Right Outer

        // Draw Hoops (4 horizontal bands)
        ctx.fillStyle = '#7f8c8d'; // Grey
        const hoopHeight = h * 0.08; // Thin hoops
        
        // Top Hoop
        ctx.fillRect(x, y + h * 0.05, w, hoopHeight);
        // Upper Mid Hoop
        ctx.fillRect(x, y + h * 0.3, w, hoopHeight);
        // Lower Mid Hoop
        ctx.fillRect(x, y + h * 0.6, w, hoopHeight);
        // Bottom Hoop
        ctx.fillRect(x, y + h * 0.87, w, hoopHeight);

        // Restore clipping
        ctx.restore();
    },

    drawCrate(ctx, x, y, w, h) {
        // 1. Square Body
        ctx.fillStyle = '#D2B48C'; // Tan/Light Wood
        ctx.fillRect(x, y, w, h);

        // Save context to clip planks and X inside the box
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        // 2. Vertical Planks (5 lines)
        ctx.strokeStyle = '#8B4513'; // SaddleBrown
        ctx.lineWidth = 1;
        ctx.beginPath();
        const plankCount = 5;
        const step = w / (plankCount + 1);
        for (let i = 1; i <= plankCount; i++) {
            const px = x + i * step;
            ctx.moveTo(px, y);
            ctx.lineTo(px, y + h);
        }
        ctx.stroke();

        // 3. Structural "X" (Diagonal Rectangles)
        // Layered beneath frame, so drawn before frame.
        ctx.strokeStyle = '#A0522D'; // Sienna
        ctx.lineWidth = w * 0.12; // Thick bracing
        ctx.beginPath();
        // Top-Left to Bottom-Right
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        // Top-Right to Bottom-Left
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
        
        ctx.restore(); // End clipping

        // 4. Frame (4 Trapezoids)
        const frameThickness = w * 0.15;
        ctx.fillStyle = '#8B4513'; // Darker Wood for Frame
        ctx.strokeStyle = '#5D2906'; // Very dark outline for frame segments
        ctx.lineWidth = 1;

        // Helper to draw filled and stroked polygon
        const drawPoly = (points) => {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        // Top Trapezoid
        drawPoly([{x: x, y: y}, {x: x + w, y: y}, {x: x + w - frameThickness, y: y + frameThickness}, {x: x + frameThickness, y: y + frameThickness}]);
        // Bottom Trapezoid
        drawPoly([{x: x, y: y + h}, {x: x + w, y: y + h}, {x: x + w - frameThickness, y: y + h - frameThickness}, {x: x + frameThickness, y: y + h - frameThickness}]);
        // Left Trapezoid
        drawPoly([{x: x, y: y}, {x: x, y: y + h}, {x: x + frameThickness, y: y + h - frameThickness}, {x: x + frameThickness, y: y + frameThickness}]);
        // Right Trapezoid
        drawPoly([{x: x + w, y: y}, {x: x + w, y: y + h}, {x: x + w - frameThickness, y: y + h - frameThickness}, {x: x + w - frameThickness, y: y + frameThickness}]);
        
        // Outer Outline
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    },

    drawChest(ctx, x, y, w, h) {
        // Aspect Ratio: Width 2, Total Height 1.5 (Base 1 + Lid 0.5)
        // We scale to fit the available width (w), then center vertically.
        const chestW = w;
        const chestH = w * (1.5 / 2); 
        
        const startX = x;
        const startY = y + (h - chestH) / 2;

        const baseH = chestH * (1 / 1.5); // 2/3 of total height
        const lidH = chestH * (0.5 / 1.5); // 1/3 of total height
        const baseY = startY + lidH;

        const woodColor = '#5D4037'; // Dark grey-ish brown
        const bandColor = '#424242'; // Dark grey iron
        const outlineColor = '#212121';

        // --- LID ---
        ctx.save();
        ctx.beginPath();
        // Draw lid shape with curved top
        ctx.moveTo(startX, baseY);
        ctx.lineTo(startX, startY + lidH * 0.2); // Start curve slightly down from top-left
        // Quadratic curve for the top edge
        ctx.quadraticCurveTo(startX + chestW / 2, startY - lidH * 0.1, startX + chestW, startY + lidH * 0.2);
        ctx.lineTo(startX + chestW, baseY);
        ctx.closePath();
        
        ctx.fillStyle = woodColor;
        ctx.fill();
        
        // Clip for bands to ensure they stay inside the curved lid
        ctx.clip();

        // Lid Bands
        const bandW = chestW * 0.08; // Thin vertical bands
        const hBandH = lidH * 0.2;   // Thin horizontal bands

        ctx.fillStyle = bandColor;
        
        // 4 Vertical Bands: Left, Right, and 2 evenly spaced in middle (approx 1/3 and 2/3)
        const vPositions = [0, 0.33, 0.66, 1];
        vPositions.forEach(p => {
            let bx = startX + (chestW * p);
            if (p === 1) bx -= bandW; // Align right edge
            else if (p > 0) bx -= bandW / 2; // Center middle bands
            ctx.fillRect(bx, startY - lidH, bandW, lidH * 2); // Oversize Y to ensure coverage of curve
        });

        // 2 Horizontal Bands (Lid)
        // Top edge (approximate due to curve)
        ctx.fillRect(startX, startY + lidH * 0.15, chestW, hBandH);
        // Bottom edge
        ctx.fillRect(startX, baseY - hBandH, chestW, hBandH);

        ctx.restore();

        // Lid Outline
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, baseY);
        ctx.lineTo(startX, startY + lidH * 0.2);
        ctx.quadraticCurveTo(startX + chestW / 2, startY - lidH * 0.1, startX + chestW, startY + lidH * 0.2);
        ctx.lineTo(startX + chestW, baseY);
        ctx.closePath();
        ctx.stroke();

        // --- BASE ---
        // Draw Base Background
        ctx.fillStyle = woodColor;
        ctx.fillRect(startX, baseY, chestW, baseH);

        // Base Bands (No clipping needed for rect, just draw on top)
        ctx.fillStyle = bandColor;
        
        // 4 Vertical Bands (align with lid)
        vPositions.forEach(p => {
            let bx = startX + (chestW * p);
            if (p === 1) bx -= bandW;
            else if (p > 0) bx -= bandW / 2;
            ctx.fillRect(bx, baseY, bandW, baseH);
        });

        // 2 Horizontal Bands (Base)
        const baseHBandH = baseH * 0.1;
        ctx.fillRect(startX, baseY, chestW, baseHBandH); // Top inside edge
        ctx.fillRect(startX, baseY + baseH - baseHBandH, chestW, baseHBandH); // Bottom inside edge

        // Base Outline
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, baseY, chestW, baseH);
    },

    drawCoffer(ctx, x, y, w, h) {
        // Aspect Ratio: Width 2, Total Height 1.5 (Base 1 + Lid 0.5)
        const chestW = w;
        const chestH = w * (1.5 / 2); 
        
        const startX = x;
        const startY = y + (h - chestH) / 2;

        const baseH = chestH * (1 / 1.5); // 2/3 of total height
        const lidH = chestH * (0.5 / 1.5); // 1/3 of total height
        const baseY = startY + lidH;

        const woodColor = '#5D4037'; // Dark grey-ish brown
        const bandColor = '#424242'; // Dark grey iron
        const outlineColor = '#212121';

        // --- LID (Same as Chest) ---
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, baseY);
        ctx.lineTo(startX, startY + lidH * 0.2); 
        ctx.quadraticCurveTo(startX + chestW / 2, startY - lidH * 0.1, startX + chestW, startY + lidH * 0.2);
        ctx.lineTo(startX + chestW, baseY);
        ctx.closePath();
        
        ctx.fillStyle = woodColor;
        ctx.fill();
        
        ctx.clip();

        const bandW = chestW * 0.08; 
        const hBandH = lidH * 0.2;   

        ctx.fillStyle = bandColor;
        
        const vPositions = [0, 0.33, 0.66, 1];
        vPositions.forEach(p => {
            let bx = startX + (chestW * p);
            if (p === 1) bx -= bandW; 
            else if (p > 0) bx -= bandW / 2; 
            ctx.fillRect(bx, startY - lidH, bandW, lidH * 2); 
        });

        ctx.fillRect(startX, startY + lidH * 0.15, chestW, hBandH);
        ctx.fillRect(startX, baseY - hBandH, chestW, hBandH);

        ctx.restore();

        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, baseY);
        ctx.lineTo(startX, startY + lidH * 0.2);
        ctx.quadraticCurveTo(startX + chestW / 2, startY - lidH * 0.1, startX + chestW, startY + lidH * 0.2);
        ctx.lineTo(startX + chestW, baseY);
        ctx.closePath();
        ctx.stroke();

        // --- BASE ---
        ctx.fillStyle = woodColor;
        ctx.fillRect(startX, baseY, chestW, baseH);

        ctx.fillStyle = bandColor;
        
        vPositions.forEach(p => {
            let bx = startX + (chestW * p);
            if (p === 1) bx -= bandW;
            else if (p > 0) bx -= bandW / 2;
            ctx.fillRect(bx, baseY, bandW, baseH);
        });

        const baseHBandH = baseH * 0.1;
        ctx.fillRect(startX, baseY, chestW, baseHBandH); // Top inside edge
        ctx.fillRect(startX, baseY + baseH - baseHBandH, chestW, baseHBandH); // Bottom inside edge
        
        // NEW: Middle Horizontal Band
        const midBandY = baseY + (baseH - baseHBandH) / 2;
        ctx.fillRect(startX, midBandY, chestW, baseHBandH);

        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, baseY, chestW, baseH);

        // NEW: Lock Plate (Circle)
        const lockR = baseH * 0.22;
        const lockCx = startX + chestW / 2;
        const lockCy = baseY + baseH / 2;

        ctx.fillStyle = '#95a5a6'; // Steel/Silver
        ctx.beginPath();
        ctx.arc(lockCx, lockCy, lockR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // NEW: Keyhole
        ctx.fillStyle = '#000000';
        const khR = lockR * 0.3;
        const khY = lockCy - khR * 0.5;
        
        ctx.beginPath();
        ctx.arc(lockCx, khY, khR, Math.PI, 0); // Top circle part
        // Trapezoid bottom part
        ctx.lineTo(lockCx + khR * 0.6, khY + khR * 2.5);
        ctx.lineTo(lockCx - khR * 0.6, khY + khR * 2.5);
        ctx.lineTo(lockCx - khR, khY);
        ctx.closePath();
        ctx.fill();
    },

    drawSack(ctx, x, y, w, h) {
        const cx = x + w / 2;
        
        // Dimensions based on 4:3 ratio description
        // We fit it within the icon box (w, h)
        const sackW = w * 0.75;
        const sackH = h * 0.9;
        const startY = y + (h - sackH) / 2;
        
        const bottomY = startY + sackH;
        const neckY = startY + sackH * 0.25; // Neck constriction
        const topY = startY;

        const bodyHalfW = sackW / 2;
        const neckHalfW = sackW * 0.25; // Narrow neck
        const topHalfW = sackW * 0.35;  // Flared top

        const sackColor = '#C5A065'; // Burlap/Canvas
        const outlineColor = '#3e2723'; // Dark Brown
        const ropeColor = '#F1C40F'; // Straw/Rope Yellow

        // --- SACK SHAPE ---
        ctx.beginPath();
        // 1. Top Edge (Flopped over)
        ctx.moveTo(cx - topHalfW, topY + sackH * 0.05);
        ctx.quadraticCurveTo(cx, topY, cx + topHalfW, topY + sackH * 0.05);
        
        // 2. Neck (Right Side) - Curve in
        ctx.quadraticCurveTo(cx + topHalfW, neckY - 5, cx + neckHalfW, neckY);
        
        // 3. Body (Right Side) - Trapezoid taper to bulge
        ctx.bezierCurveTo(cx + bodyHalfW, neckY + sackH * 0.2, cx + bodyHalfW, bottomY - sackH * 0.1, cx + bodyHalfW * 0.8, bottomY);
        
        // 4. Bottom (Bulge)
        ctx.quadraticCurveTo(cx, bottomY + sackH * 0.08, cx - bodyHalfW * 0.8, bottomY);
        
        // 5. Body (Left Side)
        ctx.bezierCurveTo(cx - bodyHalfW, bottomY - sackH * 0.1, cx - bodyHalfW, neckY + sackH * 0.2, cx - neckHalfW, neckY);
        
        // 6. Neck (Left Side)
        ctx.quadraticCurveTo(cx - topHalfW, neckY - 5, cx - topHalfW, topY + sackH * 0.05);
        
        ctx.closePath();
        
        ctx.fillStyle = sackColor;
        ctx.fill();
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- ROPE TIE ---
        ctx.strokeStyle = ropeColor;
        ctx.lineWidth = 2;
        const ropeSpacing = 3;
        
        // 3 Horizontal Lines
        ctx.beginPath();
        ctx.moveTo(cx - neckHalfW, neckY - ropeSpacing); ctx.lineTo(cx + neckHalfW, neckY - ropeSpacing);
        ctx.moveTo(cx - neckHalfW - 1, neckY);           ctx.lineTo(cx + neckHalfW + 1, neckY);
        ctx.moveTo(cx - neckHalfW, neckY + ropeSpacing); ctx.lineTo(cx + neckHalfW, neckY + ropeSpacing);
        ctx.stroke();

        // 2 Rope Ends (Emerging from the tie)
        ctx.beginPath();
        // End 1
        ctx.moveTo(cx + neckHalfW / 2, neckY + ropeSpacing);
        ctx.quadraticCurveTo(cx + neckHalfW + 5, neckY + 10, cx + neckHalfW + 2, neckY + 15);
        // End 2
        ctx.moveTo(cx + neckHalfW / 2, neckY + ropeSpacing);
        ctx.quadraticCurveTo(cx + neckHalfW + 8, neckY + 8, cx + neckHalfW + 6, neckY + 12);
        ctx.stroke();
    },

    drawCannon(ctx, w, h) {
        if (typeof Ship !== 'undefined' && typeof Ship.drawCannonPreview === 'function') {
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.scale(0.7, 0.7);
            ctx.translate(-w / 2, -h / 2);
            Ship.drawCannonPreview(ctx, w, h);
            ctx.restore();
        }
    },

    drawRoundShot(ctx, x, y, w, h) {
        const r = 4; // Radius of a single shot
        const d = r * 2;
        const cx = x + w / 2;
        const bottomY = y + h - 6; // Padding from bottom

        ctx.fillStyle = '#202020'; // Almost black (Iron)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;

        // Draw 5 rows, starting from the bottom (5 circles) up to the top (1 circle)
        for (let row = 0; row < 5; row++) {
            const count = 5 - row; // 5, 4, 3, 2, 1
            // Stack upwards. 0.85 factor accounts for the balls sitting in the grooves of the layer below
            const cy = bottomY - r - (row * (d * 0.85)); 
            
            // Center the row horizontally
            const rowWidth = (count - 1) * d;
            const startX = cx - rowWidth / 2;

            for (let i = 0; i < count; i++) {
                const cX = startX + i * d;
                
                ctx.beginPath();
                ctx.arc(cX, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Add a small shine for 3D effect
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(cX - r*0.3, cy - r*0.3, r*0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    },

    drawStoneBlockPile(ctx, x, y, w, h) {
        const size = 8; // Size of the square block
        const r = 2; // Corner radius
        const cx = x + w / 2;
        const bottomY = y + h - 6;

        ctx.fillStyle = '#95a5a6'; // Concrete/Stone Grey
        ctx.strokeStyle = '#505050'; // Darker Grey Outline
        ctx.lineWidth = 1;

        // Draw 5 rows, starting from the bottom
        for (let row = 0; row < 5; row++) {
            const count = 5 - row;
            const cy = bottomY - size - (row * size); // Stack vertically
            const rowWidth = count * size;
            const startX = cx - rowWidth / 2;

            for (let i = 0; i < count; i++) {
                const bx = startX + i * size;
                ctx.beginPath();
                ctx.roundRect(bx, cy, size, size, r);
                ctx.fill();
                ctx.stroke();
            }
        }
    },

    drawLogBundle(ctx, x, y, w, h) {
        const logCountBack = 5;
        const logCountFront = 4;
        // Calculate log width based on fitting 5 logs with slight overlap/spacing
        const logW = w / (logCountBack - 0.5); 
        const logH = h;

        const woodColor = '#6F4E37'; // Darker Bark Brown
        const outlineColor = '#3E2723'; // Very Dark Brown
        const ropeColor = '#E6C676'; // Rope Yellow

        // Helper to draw a single vertical log
        const drawLog = (lx, ly, lw, lh) => {
            ctx.fillStyle = woodColor;
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 1;

            ctx.beginPath();
            // Top Edge (Bulge Up)
            ctx.moveTo(lx, ly + 3);
            ctx.quadraticCurveTo(lx + lw / 2, ly, lx + lw, ly + 3);
            
            // Right Side (Bumpy)
            ctx.bezierCurveTo(lx + lw + 1, ly + lh * 0.3, lx + lw - 1, ly + lh * 0.7, lx + lw, ly + lh - 3);
            
            // Bottom Edge (Bulge Down)
            ctx.quadraticCurveTo(lx + lw / 2, ly + lh, lx, ly + lh - 3);
            
            // Left Side (Bumpy)
            ctx.bezierCurveTo(lx + 1, ly + lh * 0.7, lx - 1, ly + lh * 0.3, lx, ly + 3);
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Internal Texture (Jagged Lines)
            ctx.strokeStyle = 'rgba(40, 20, 10, 0.3)'; // Darker texture for bark
            ctx.beginPath();
            // Draw 2 texture lines per log
            for (let i = 1; i <= 2; i++) {
                const tx = lx + (lw * i / 3);
                ctx.moveTo(tx, ly + 6);
                // Zig-zag down
                ctx.lineTo(tx + (Math.random() - 0.5) * 2, ly + lh * 0.4);
                ctx.lineTo(tx + (Math.random() - 0.5) * 2, ly + lh * 0.8);
                ctx.lineTo(tx, ly + lh - 6);
            }
            ctx.stroke();
        };

        // 1. Draw Back Layer (5 logs)
        for (let i = 0; i < logCountBack; i++) {
            drawLog(x + i * (logW * 0.9), y, logW, logH);
        }

        // 2. Draw Front Layer (4 logs, nested in gaps)
        for (let i = 0; i < logCountFront; i++) {
            drawLog(x + (logW * 0.45) + i * (logW * 0.9), y + 2, logW, logH - 4);
        }

        // 3. Draw Lashings (3 bands of 3 lines)
        ctx.strokeStyle = ropeColor;
        ctx.lineWidth = 1.5;
        
        const lashingYPositions = [h * 0.25, h * 0.5, h * 0.75];
        
        lashingYPositions.forEach(ly => {
            const bandY = y + ly;
            // Draw 3 lines for the rope band
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(x, bandY + (i * 2));
                ctx.lineTo(x + w, bandY + (i * 2));
                ctx.stroke();
            }
        });
    },

    drawBale(ctx, x, y, w, h) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const bulgeX = w * 0.1;
        const bulgeY = h * 0.1;

        // Off-white body
        ctx.fillStyle = '#F5F5DC'; // Beige
        ctx.strokeStyle = '#D2B48C'; // Tan outline
        ctx.lineWidth = 1;

        // Draw 4 bulging quadrants
        const drawQuadrant = (startX, startY, cX, cY, qX, qY) => {
            ctx.beginPath();
            ctx.moveTo(cX, startY);
            ctx.quadraticCurveTo(startX + (w * qX * 0.25), startY - (bulgeY * qY), startX, startY);
            ctx.quadraticCurveTo(startX - (bulgeX * qX), startY + (h * qY * 0.25), startX, cY);
            ctx.lineTo(cX, cY);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        };

        // Top-Left
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(x + w * 0.25, y - bulgeY, x, y);
        ctx.quadraticCurveTo(x - bulgeX, y + h * 0.25, x, cy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Top-Right
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(x + w * 0.75, y - bulgeY, x + w, y);
        ctx.quadraticCurveTo(x + w + bulgeX, y + h * 0.25, x + w, cy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.quadraticCurveTo(x - bulgeX, y + h * 0.75, x, y + h);
        ctx.quadraticCurveTo(x + w * 0.25, y + h + bulgeY, cx, y + h);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(x + w, cy);
        ctx.quadraticCurveTo(x + w + bulgeX, y + h * 0.75, x + w, y + h);
        ctx.quadraticCurveTo(x + w * 0.75, y + h + bulgeY, cx, y + h);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Draw ropes on top
        ctx.strokeStyle = '#A0522D'; // Sienna/Rope color
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke(); // Horizontal
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke(); // Vertical
    },

    drawBolt(ctx, x, y, w, h, itemId) {
        const cx = x + w * 0.4; // Shift left slightly to make room for tail
        const rollW = w * 0.5;
        const radius = rollW / 2;
        
        const topY = y + radius;
        const bottomY = y + h - radius;

        let fabricColor = '#E0E0E0'; // Default Light Grey/Canvas
        let faceColor = '#D3D3D3';   // Default Face

        if (itemId) {
            if (itemId.includes('cotton')) {
                fabricColor = '#FFFFFF'; // Pure White
                faceColor = '#F0F0F0';
            } else if (itemId.includes('hemp')) {
                fabricColor = '#b5ad88'; // Light Beige
                faceColor = '#a39b7a';   // Slightly darker beige
            } else if (itemId.includes('wool')) {
                fabricColor = '#e3ded4'; // Off-white
                faceColor = '#d1cec6';   // Slightly darker off-white
            }
        }

        const outlineColor = '#5D4037'; // Dark Brown

        // 1. Tail (Behind)
        ctx.save();
        ctx.fillStyle = fabricColor;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Rectangle emerging from the right side
        ctx.rect(cx, y + h * 0.2, w * 0.5, h * 0.8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 2. Body (Vertical Rectangle + Top Curve)
        ctx.fillStyle = fabricColor;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - radius, bottomY); // Bottom Left
        ctx.lineTo(cx - radius, topY);    // Top Left
        ctx.arc(cx, topY, radius, Math.PI, 0); // Top Semi-circle
        ctx.lineTo(cx + radius, bottomY); // Bottom Right
        ctx.fill();
        ctx.stroke();

        // 3. Bottom Circle (Face with Spiral)
        ctx.beginPath();
        ctx.arc(cx, bottomY, radius, 0, Math.PI * 2);
        ctx.fillStyle = faceColor;
        ctx.fill();
        ctx.stroke();

        // Spiral Detail
        ctx.beginPath();
        const spiralLoops = 4.5;
        for (let i = 0; i < spiralLoops * 2 * Math.PI; i += 0.2) {
            const r = (i / (spiralLoops * 2 * Math.PI)) * (radius - 2);
            const px = cx + Math.cos(i) * r;
            const py = bottomY + Math.sin(i) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
    },

    drawCoil(ctx, x, y, w, h) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const layers = 5;
        // Calculate rope thickness based on available space
        const maxR = (Math.min(w, h) / 2) - 4; // Padding
        const thickness = maxR / layers;
        
        const ropeColor = '#E6C676'; // Rope Yellow/Tan
        const outlineColor = '#5D4037'; // Dark Brown

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Helper to trace the spiral path
        const traceSpiral = () => {
            ctx.beginPath();
            const rotations = layers;
            const maxTheta = rotations * 2 * Math.PI;
            const b = thickness / (2 * Math.PI); // Growth factor per radian

            for (let theta = 0; theta <= maxTheta; theta += 0.1) {
                const r = b * theta;
                const px = cx + r * Math.cos(theta);
                const py = cy + r * Math.sin(theta);
                if (theta === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
        };

        // 1. Draw Outline (Thick)
        traceSpiral();
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = thickness; 
        ctx.stroke();

        // 2. Draw Rope Body (Thin)
        traceSpiral();
        ctx.strokeStyle = ropeColor;
        ctx.lineWidth = Math.max(1, thickness - 2); // Leave a border
        ctx.stroke();
    },

    drawStonePile(ctx, x, y, w, h, itemId) {
        const r = 4; // Approx radius of a stone
        const d = r * 2;
        const cx = x + w / 2;
        const bottomY = y + h - 6;

        if (itemId === 'coal') {
            ctx.strokeStyle = '#1a1a1a'; // Almost black outline for coal
        } else {
            ctx.strokeStyle = '#2c3e50'; // Dark grey outline
        }
        ctx.lineWidth = 1;

        // Helper to draw a single irregular stone
        const drawStone = (sx, sy, sr) => {
            if (itemId === 'iron-ore') {
                // Reddish-pinkish hue for Iron Ore (Rust)
                const red = 180 + Math.floor(Math.random() * 50);   // 180-230
                const green = 100 + Math.floor(Math.random() * 40); // 100-140
                const blue = 100 + Math.floor(Math.random() * 40);  // 100-140
                ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            } else if (itemId === 'copper-ore') {
                // Greenish tinge for Copper Ore (Oxidized/Malachite)
                const red = 60 + Math.floor(Math.random() * 40);    // 60-100
                const green = 160 + Math.floor(Math.random() * 50); // 160-210
                const blue = 120 + Math.floor(Math.random() * 40);  // 120-160
                ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            } else if (itemId === 'silver-ore') {
                // Lighter Grey/White-ish for Silver Ore
                const shade = 190 + Math.floor(Math.random() * 40); // 190-230
                // Add slight blue tint for silver feel
                ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 10})`;
            } else if (itemId === 'gold-ore') {
                // Yellowish tinge for Gold Ore
                const red = 210 + Math.floor(Math.random() * 45);   // 210-255
                const green = 180 + Math.floor(Math.random() * 50); // 180-230
                const blue = 40 + Math.floor(Math.random() * 60);   // 40-100
                ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            } else if (itemId === 'coal') {
                // Dusty Black for Coal
                const shade = 40 + Math.floor(Math.random() * 20); // 40-60 range
                ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
            } else {
                // Default Grey for Stone
                const shade = 120 + Math.floor(Math.random() * 60); // 120-180
                ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
            }
            
            ctx.beginPath();
            const sides = 6 + Math.floor(Math.random() * 3); // 6 to 8 sides
            const angleStep = (Math.PI * 2) / sides;
            const angleOffset = Math.random() * Math.PI; // Random rotation
            
            for (let i = 0; i < sides; i++) {
                const angle = i * angleStep + angleOffset;
                // Vary radius by +/- 20% for irregularity
                const rad = sr * (0.8 + Math.random() * 0.4);
                const px = sx + Math.cos(angle) * rad;
                const py = sy + Math.sin(angle) * rad;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        // Draw 5 rows, starting from the bottom
        for (let row = 0; row < 5; row++) {
            const count = 5 - row;
            const cy = bottomY - r - (row * (d * 0.85)); 
            const rowWidth = (count - 1) * d;
            const startX = cx - rowWidth / 2;

            for (let i = 0; i < count; i++) {
                const cX = startX + i * d;
                // Add slight jitter to position for natural "pile" look
                const jitterX = (Math.random() - 0.5) * 2;
                const jitterY = (Math.random() - 0.5) * 2;
                drawStone(cX + jitterX, cy + jitterY, r);
            }
        }
    },

    // --- Core System Logic ---
    cache: new Map(),
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 64; // Render at 2x resolution for crisp 32px display
        this.canvas.height = 64;
        this.ctx = this.canvas.getContext('2d');
    },

    getIconUrl(entry) {
        // Create a unique key based on item ID and container ID (e.g., "rum_barrel")
        const containerId = entry.container ? entry.container.id : 'none';
        const key = `${entry.item.id}_${containerId}`;

        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const url = this.generateIcon(entry);
        this.cache.set(key, url);
        return url;
    },

    generateIcon(entry) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. Clear the shared canvas
        ctx.clearRect(0, 0, w, h);

        const containerId = entry.container ? entry.container.id.toLowerCase() : '';

        if (containerId.includes('barrel')) this.drawBarrel(ctx, 8, 8, 48, 48);
        else if (containerId.includes('crate')) this.drawCrate(ctx, 8, 8, 48, 48);
        else if (containerId.includes('coffer')) this.drawCoffer(ctx, 8, 8, 48, 48);
        else if (containerId.includes('chest')) this.drawChest(ctx, 8, 8, 48, 48);
        else if (containerId.includes('sack') || containerId.includes('bag')) this.drawSack(ctx, 8, 8, 48, 48);
        else if (entry.item.id === 'cannon') this.drawCannon(ctx, w, h);
        else if (entry.item.id.includes('shot') || entry.item.id.includes('ball')) this.drawRoundShot(ctx, 8, 8, 48, 48);
        else if (entry.item.id === 'stone-block' && (containerId.includes('pile') || !entry.container)) this.drawStoneBlockPile(ctx, 8, 8, 48, 48);
        else if (containerId.includes('bundle') || entry.item.id === 'log' || entry.item.id === 'timber' || entry.item.id === 'spars') this.drawLogBundle(ctx, 8, 8, 48, 48);
        else if (containerId.includes('bale')) this.drawBale(ctx, 8, 8, 48, 48);
        else if (containerId.includes('roll') || containerId.includes('bolt')) this.drawBolt(ctx, 8, 8, 48, 48, entry.item.id);
        else if (containerId.includes('coil') || entry.item.id === 'hemp-rope') this.drawCoil(ctx, 8, 8, 48, 48);
        else if (containerId.includes('pile') || entry.item.id === 'stone' || entry.item.id.includes('ore') || entry.item.id === 'coal') this.drawStonePile(ctx, 8, 8, 48, 48, entry.item.id);
        else {
            // Placeholder for Misc items
            const category = entry.item.category || 'Misc';
            ctx.fillStyle = '#bdc3c7'; // Default Grey
            if (category === 'Consumable') ctx.fillStyle = '#e67e22'; // Orange
            if (category === 'Trade') ctx.fillStyle = '#f1c40f'; // Gold
            if (category === 'Munition') ctx.fillStyle = '#2c3e50'; // Dark Blue
            ctx.fillRect(8, 8, w - 16, h - 16);
        }

        return this.canvas.toDataURL();
    }
});

// Initialize the system immediately so it's ready for use
window.CargoIconSystem.init();