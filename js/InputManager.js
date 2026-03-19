/**
 * @file Manages all user input from keyboard and mouse.
 * This class abstracts raw DOM events into a queryable state for the game loop.
 */
class InputManager {
    /**
     * @param {HTMLCanvasElement} canvas - The main game canvas to attach listeners to.
     */
    constructor(canvas) {
        this.canvas = canvas;
        // --- OPTIMIZATION: Cache the bounding rect to avoid layout thrashing ---
        this.rect = canvas.getBoundingClientRect();

        // --- State ---
        this.keys = {};
        this.mouse = {
            screenX: 0,
            screenY: 0,
            isDown: false,
            clicks: []
        };

        // --- Bind event handlers to this instance ---
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
        this._handleClick = this._handleClick.bind(this);
        // Bind the rect updater
        this._updateRect = this._updateRect.bind(this);

        this._addEventListeners();
    }

    /**
     * Attaches all necessary event listeners to the window and canvas.
     * @private
     */
    _addEventListeners() {
        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('keyup', this._handleKeyUp);
        window.addEventListener('mousemove', this._handleMouseMove);
        
        this.canvas.addEventListener('mousedown', this._handleMouseDown);
        window.addEventListener('mouseup', this._handleMouseUp); // Listen on window for mouseup outside canvas
        this.canvas.addEventListener('click', this._handleClick);

        // Update the cached rect only when layout might change
        window.addEventListener('resize', this._updateRect);
        window.addEventListener('scroll', this._updateRect);
    }

    /**
     * Removes all event listeners to prevent memory leaks.
     */
    destroy() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
        window.removeEventListener('mousemove', this._handleMouseMove);
        
        this.canvas.removeEventListener('mousedown', this._handleMouseDown);
        window.removeEventListener('mouseup', this._handleMouseUp);
        this.canvas.removeEventListener('click', this._handleClick);
        
        window.removeEventListener('resize', this._updateRect);
        window.removeEventListener('scroll', this._updateRect);
    }

    // --- Event Handlers ---

    // Optimization: Only calculate this expensive operation when necessary
    _updateRect() {
        this.rect = this.canvas.getBoundingClientRect();
    }

    _handleKeyDown(e) {
        // Prevent input if a text field is focused
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        
        this.keys[e.key] = true;
    }

    _handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    _handleMouseMove(e) {
        // Use the cached rect
        // const rect = this.canvas.getBoundingClientRect(); // Removed to prevent thrashing
        this.mouse.screenX = e.clientX - this.rect.left;
        this.mouse.screenY = e.clientY - this.rect.top;
    }

    _handleMouseDown(e) {
        this.mouse.isDown = true;
    }

    _handleMouseUp(e) {
        this.mouse.isDown = false;
    }

    _handleClick(e) {
        // Prevent click processing if a UI dialog is open
        const renameDialog = document.getElementById('rename-dialog');
        if (renameDialog && renameDialog.style.display === 'flex') return;

        // Queue the click event with its screen coordinates and the raw event
        this.mouse.clicks.push({
            x: this.mouse.screenX,
            y: this.mouse.screenY,
            rawEvent: e
        });
    }

    // --- Public API ---

    /**
     * Returns the queued click events and clears the queue.
     * This ensures clicks are processed exactly once per frame.
     * @returns {Array<{x: number, y: number, rawEvent: MouseEvent}>}
     */
    getAndClearClicks() {
        if (this.mouse.clicks.length === 0) return [];
        const clicksToProcess = this.mouse.clicks;
        this.mouse.clicks = [];
        return clicksToProcess;
    }

    /**
     * Returns the cached bounding rectangle of the canvas.
     * @returns {DOMRect}
     */
    getRect() {
        return this.rect;
    }
}
