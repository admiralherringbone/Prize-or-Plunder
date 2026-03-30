/**
 * @file Manages the loading screen UI, including the animated spinner and progress bar.
 * This is a singleton pattern.
 */
const LoadingScreenManager = (function() {
    // DOM Elements
    let loadingScreenEl = null;
    let spinnerCanvas = null;
    let spinnerCtx = null;
    let progressBarFillEl = null;
    let statusTextEl = null; // New

    // Animation State
    let animationFrameId = null;
    let currentAngle = 0;
    let targetAngle = 0;
    let hasBeenSized = false; // --- NEW: Flag to ensure sizing happens only once ---
    const rotationSpeed = 0.05; // Easing factor for smooth rotation

    // Cached Path2D objects for performance
    let compassPath = null;
    let compassDiagonalPath = null;
    let smallerRingRadius = 0; // --- NEW: Radius for the inner ring ---

    // Hardcode SVG path data to avoid dependency on asset loading
    // --- MODIFIED: Star points are now narrower for a sharper look ---
    const COMPASS_SVG_DATA = "M50 5 L56.5 43.5 L95 50 L56.5 56.5 L50 95 L43.5 56.5 L5 50 L43.5 43.5 Z";
    const COMPASS_DIAGONAL_SVG_DATA = "M75.5 24.5 L57.35 50 L75.5 75.5 L50 57.35 L24.5 75.5 L42.65 50 L24.5 24.5 L50 42.65 Z";

    /**
     * Initializes the manager by getting DOM elements and creating Path2D objects.
     * @private
     */
    function _init() {
        spinnerCanvas = document.getElementById('loading-spinner-canvas');
        progressBarFillEl = document.getElementById('loading-bar-fill');
        statusTextEl = document.getElementById('loading-status-text');

        if (!spinnerCanvas || !progressBarFillEl) {
            console.error("Loading screen child elements not found. Loading screen will not function.");
            return;
        }

        spinnerCtx = spinnerCanvas.getContext('2d');

        // Create Path2D objects from the hardcoded SVG data.
        if (typeof parseSvgPathToLocalCoordinates === 'function') {
            const compassIconData = parseSvgPathToLocalCoordinates(COMPASS_SVG_DATA);
            const compassDiagonalIconData = parseSvgPathToLocalCoordinates(COMPASS_DIAGONAL_SVG_DATA);

            // --- NEW: Calculate smaller ring radius based on the diagonal star's size ---
            let maxRadiusSq = 0;
            compassDiagonalIconData.points.forEach(p => {
                const rSq = p.x * p.x + p.y * p.y;
                if (rSq > maxRadiusSq) {
                    maxRadiusSq = rSq;
                }
            });
            const smallerStarRadius = Math.sqrt(maxRadiusSq);
            // Per user request, the smaller ring's radius is 72% of the smaller star's radius.
            smallerRingRadius = smallerStarRadius * 0.72;

            const buildPathString = (commands) => commands.map(cmd => `${cmd.type} ${cmd.values.join(' ')}`).join(' ');

            compassPath = new Path2D(buildPathString(compassIconData.commands));
            compassDiagonalPath = new Path2D(buildPathString(compassDiagonalIconData.commands));
        } else {
            console.error("`parseSvgPathToLocalCoordinates` is not defined. Loading screen spinner cannot be created.");
        }
    }

    /**
     * The animation loop for the compass spinner.
     * @private
     */
    function _animateSpinner() {
        // --- FIX: One-time canvas sizing on the first animation frame ---
        // This ensures getBoundingClientRect() runs after the browser has calculated the layout.
        if (!hasBeenSized) {
            const dpr = window.devicePixelRatio || 1;
            const rect = spinnerCanvas.getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) {
                // Layout not ready, try again on the next frame.
                animationFrameId = requestAnimationFrame(_animateSpinner);
                return;
            }
            spinnerCanvas.width = rect.width * dpr;
            spinnerCanvas.height = rect.height * dpr;
            spinnerCtx.scale(dpr, dpr);
            hasBeenSized = true;
        }

        if (Math.abs(targetAngle - currentAngle) < 0.01) {
            const randomTurn = (Math.random() * 1.5 + 1.0) * Math.PI * (Math.random() > 0.5 ? 1 : -1);
            targetAngle += randomTurn;
        }

        currentAngle = lerpAngle(currentAngle, targetAngle, rotationSpeed);

        const width = spinnerCanvas.width / (window.devicePixelRatio || 1);
        const height = spinnerCanvas.height / (window.devicePixelRatio || 1);
        spinnerCtx.clearRect(0, 0, width, height);

        spinnerCtx.save();
        spinnerCtx.translate(width / 2, height / 2);
        spinnerCtx.rotate(currentAngle);

        const iconWidth = 100; // Raw SVG viewBox is 100x100
        const scale = Math.min(width, height) / iconWidth * 0.8;
        spinnerCtx.scale(scale, scale);

        spinnerCtx.fillStyle = 'white';

        // --- NEW: Draw the spinner components in the correct order to match the HUD icon ---
        // 1. Draw Diagonal Star (Background)
        if (compassDiagonalPath) {
            spinnerCtx.fill(compassDiagonalPath);
        }

        // 2. Draw Rings (without shadow for a cleaner look)
        spinnerCtx.save();
        spinnerCtx.shadowColor = 'transparent';
        spinnerCtx.strokeStyle = 'white';
        spinnerCtx.lineWidth = UI_COMPASS_RING_THICKNESS;
        spinnerCtx.beginPath();
        spinnerCtx.arc(0, 0, UI_COMPASS_RING_RADIUS, 0, Math.PI * 2); // Larger ring
        spinnerCtx.arc(0, 0, smallerRingRadius, 0, Math.PI * 2);      // Smaller ring
        spinnerCtx.stroke();
        spinnerCtx.restore();

        // 3. Draw Main Star (Foreground)
        if (compassPath) spinnerCtx.fill(compassPath);

        spinnerCtx.restore();
        animationFrameId = requestAnimationFrame(_animateSpinner);
    }

    function show(showProgressBar = true) {
        // Get the element if we don't have it yet.
        if (!loadingScreenEl) {
            loadingScreenEl = document.getElementById('loading-screen');
        }
        if (!loadingScreenEl) return;

        // Make the loading screen visible *before* initializing the canvas.
        loadingScreenEl.style.display = 'flex';

        // Initialize if it's the first time (spinnerCtx will be null).
        if (!spinnerCtx) {
            _init();
        }
        if (!spinnerCtx) return;

        // Reset the sizing flag each time the screen is shown.
        hasBeenSized = false;

        progressBarFillEl.parentElement.style.display = showProgressBar ? 'block' : 'none';
        if (!animationFrameId) animationFrameId = requestAnimationFrame(_animateSpinner);
    }

    function hide() {
        if (!loadingScreenEl) return;
        loadingScreenEl.style.display = 'none';
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    /**
     * Updates the loading bar's fill percentage.
     * @param {number} percentage - A value between 0 and 100.
     */
    function updateProgress(percentage) {
        if (!progressBarFillEl) return;
        // Clamp the value to ensure it's within the valid range.
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        progressBarFillEl.style.width = `${clampedPercentage}%`;
    }

    /**
     * Updates the loading status text.
     * @param {string} text - The text to display.
     */
    function updateStatus(text) {
        if (statusTextEl && text) statusTextEl.textContent = text;
    }

    return { show, hide, updateProgress, updateStatus };
})();

window.LoadingScreenManager = LoadingScreenManager;