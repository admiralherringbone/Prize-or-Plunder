class Obstacle {
    constructor(irregularPoints, color, baseRadiusX, baseRadiusY, type = 'island', isSmall = false) {
        this.originalIrregularPoints = irregularPoints;
        this.color = color;
        this.strokeColor = (typeof darkenColor === 'function') ? darkenColor(color, 10) : color;
        this.type = type;
        this.isSmall = isSmall;
        this.baseRadiusX = baseRadiusX;
        this.baseRadiusY = baseRadiusY;
        this.convexParts = triangulatePolygon(irregularPoints);
        this.outerPerimeterPoints = getOuterPerimeter(irregularPoints);

        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;
        let centerXSum = 0;
        let centerYSum = 0;
        let numPoints = 0;

        for (const part of this.convexParts) {
            for (const p of part) {
                this.minX = Math.min(this.minX, p.x);
                this.minY = Math.min(this.minY, p.y);
                this.maxX = Math.max(this.maxX, p.x);
                this.maxY = Math.max(this.maxY, p.y);
                centerXSum += p.x;
                centerYSum += p.y;
                numPoints++;
            }
        }
        this.x = centerXSum / numPoints;
        this.y = centerYSum / numPoints;

        this.maxDistanceToPerimeter = 0;
        for (const p of this.outerPerimeterPoints) {
            this.maxDistanceToPerimeter = Math.max(this.maxDistanceToPerimeter, distance({ x: this.x, y: this.y }, p));
        }

        this.proximityRadius = 0; // This should be set by the world generation logic based on obstacle type.
        
        this.visualCache = null;
        this.visualCacheOffset = { x: 0, y: 0 };
    }

    getAABB() {
        return {
            minX: this.minX,
            minY: this.minY,
            maxX: this.maxX,
            maxY: this.maxY
        };
    }

    /**
     * Pre-renders the static visual elements of the obstacle to an off-screen canvas.
     */
    cacheVisuals() {
        const padding = 4; // Padding to prevent stroke clipping
        const width = (this.maxX - this.minX) + padding * 2;
        const height = (this.maxY - this.minY) + padding * 2;

        if (width <= 0 || height <= 0) return;

        this.visualCache = document.createElement('canvas');
        this.visualCache.width = width;
        this.visualCache.height = height;
        const ctx = this.visualCache.getContext('2d');

        this.visualCacheOffset = { x: this.minX - padding, y: this.minY - padding };

        // Translate context so (minX, minY) is at (padding, padding)
        ctx.translate(-this.visualCacheOffset.x, -this.visualCacheOffset.y);
        
        this.renderStaticVisuals(ctx);
    }

    renderStaticVisuals(ctx) {
        if (this.outerPerimeterPoints.length > 0) {
            ctx.beginPath();
            this.outerPerimeterPoints.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        ctx.save();
        if (this.visualCache) {
            ctx.drawImage(this.visualCache, this.visualCacheOffset.x, this.visualCacheOffset.y);
        } else {
            this.renderStaticVisuals(ctx);
        }

        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && DEBUG.DRAW_TRIANGULATION) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
            ctx.lineWidth = 1;
            this.convexParts.forEach(triangle => {
                ctx.beginPath();
                ctx.moveTo(triangle[0].x, triangle[0].y);
                ctx.lineTo(triangle[1].x, triangle[1].y);
                ctx.lineTo(triangle[2].x, triangle[2].y);
                ctx.closePath();
                ctx.stroke();
            });
        }
        ctx.restore();
    }
}