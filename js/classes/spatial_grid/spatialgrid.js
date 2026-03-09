class SpatialGrid {
    constructor(cellSize, worldWidth, worldHeight) {
        this.cellSize = cellSize;
        this.grid = new Map();
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }

    _toGridCoords(x, y) {
        return {
            cx: Math.floor(x / this.cellSize),
            cy: Math.floor(y / this.cellSize)
        };
    }

    _getCellKey(cx, cy) {
        return `${cx},${cy}`;
    }

    clear() {
        this.grid.clear();
    }

    insert(object) {
        const aabb = object.getAABB();
        if (!aabb) return;

        const { cx: startCx, cy: startCy } = this._toGridCoords(aabb.minX, aabb.minY);
        const { cx: endCx, cy: endCy } = this._toGridCoords(aabb.maxX, aabb.maxY);

        for (let cx = startCx; cx <= endCx; cx++) {
            for (let cy = startCy; cy <= endCy; cy++) {
                const key = this._getCellKey(cx, cy);
                if (!this.grid.has(key)) {
                    this.grid.set(key, new Set());
                }
                this.grid.get(key).add(object);
            }
        }
    }

    query(objectOrAABB) {
        const candidates = new Set();
        // Make the query method flexible: it can accept a game object with a getAABB() method,
        // or a raw AABB object.
        const aabb = (typeof objectOrAABB.getAABB === 'function') ? objectOrAABB.getAABB() : objectOrAABB;

        // Add a robustness check to ensure we have a valid AABB.
        if (!aabb || aabb.minX === undefined) return candidates;

        const { cx: startCx, cy: startCy } = this._toGridCoords(aabb.minX, aabb.minY);
        const { cx: endCx, cy: endCy } = this._toGridCoords(aabb.maxX, aabb.maxY);

        for (let cx = startCx - 1; cx <= endCx + 1; cx++) {
            for (let cy = startCy - 1; cy <= endCy + 1; cy++) {
                const key = this._getCellKey(cx, cy);
                if (this.grid.has(key)) {
                    this.grid.get(key).forEach(otherObject => {
                        // If we queried with a game object, don't include the object itself in the results.
                        if (otherObject !== objectOrAABB) {
                            candidates.add(otherObject);
                        }
                    });
                }
            }
        }
        return candidates;
    }
}
