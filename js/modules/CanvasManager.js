/**
 * @file Manages a pool of reusable canvas elements to prevent graphics resource exhaustion.
 * This is a singleton pattern, ensuring only one manager exists.
 */
const CanvasManager = (function() {
    const canvasPool = [];
    const MAX_POOL_SIZE = 100; // Prevent the pool from growing indefinitely.

    // For debugging and tracking
    let createdCount = 0;
    let releasedCount = 0;
    let requestedCount = 0;
    let poolHighWaterMark = 0;

    /**
     * Retrieves a canvas from the pool or creates a new one.
     * @param {number} width - The desired width of the canvas.
     * @param {number} height - The desired height of the canvas.
     * @returns {HTMLCanvasElement} A canvas element.
     */
    function getCanvas(width, height) {
        requestedCount++;
        let canvas;

        if (canvasPool.length > 0) {
            canvas = canvasPool.pop();
        } else {
            canvas = document.createElement('canvas');
            createdCount++;
        }

        // It's crucial to set the dimensions every time, as they might differ.
        canvas.width = width;
        canvas.height = height;

        return canvas;
    }

    /**
     * Returns a canvas to the pool for reuse.
     * @param {HTMLCanvasElement} canvas - The canvas element to release.
     */
    function releaseCanvas(canvas) {
        if (!canvas) return;

        // Clear the canvas to prevent old drawings from appearing.
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (canvasPool.length < MAX_POOL_SIZE) {
            canvasPool.push(canvas);
            releasedCount++;
            poolHighWaterMark = Math.max(poolHighWaterMark, canvasPool.length);
        }
        // If pool is full, let the canvas be garbage collected.
    }

    /**
     * Logs the current status of the canvas pool to the console.
     */
    function logStatus() {
        console.log(`[CanvasManager] Status:
        - Canvases Created: ${createdCount}
        - Canvases Requested: ${requestedCount}
        - Canvases Released: ${releasedCount}
        - Current Pool Size: ${canvasPool.length}
        - Pool High Water Mark: ${poolHighWaterMark}`);
    }

    // Public interface
    return {
        getCanvas,
        releaseCanvas,
        logStatus
    };
})();

// Expose to the global window object
window.CanvasManager = CanvasManager;