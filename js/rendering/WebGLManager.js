/**
 * Manages the WebGL rendering context, canvas, and basic setup.
 * This class is responsible for creating a dedicated WebGL canvas,
 * initializing the WebGL2 context, handling resizing, and clearing the screen.
 */
class WebGLManager {
    /**
     * @param {HTMLCanvasElement} canvas - The HTML canvas element to use for WebGL rendering.
     */
    constructor(canvas) {
        this.canvas = canvas;
        // Attempt to get a WebGL2 rendering context
        this.gl = canvas.getContext('webgl2', { alpha: true });

        if (!this.gl) {
            console.error('Unable to initialize WebGL2. Your browser may not support it.');
            // Fallback to WebGL1 if WebGL2 is not available
            this.gl = canvas.getContext('webgl', { alpha: true });
            if (!this.gl) {
                console.error('Unable to initialize WebGL. Your browser may not support it.');
                alert('Your browser does not support WebGL, which is required for this game. Please try a different browser or update your current one.');
                return;
            }
            console.warn('WebGL2 not supported, falling back to WebGL1.');
        }

        const gl = this.gl;

        // Set the clear color to a transparent version of your OCEAN_BLUE
        // This allows the 2D canvas to show through if there's no WebGL content.
        gl.clearColor(0.204, 0.596, 0.859, 0.0); // Corresponds to #3498db with 0 alpha

        // Enable alpha blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        console.log('WebGLManager initialized.');
    }

    /**
     * Resizes the WebGL canvas to match the window dimensions and updates the viewport.
     */
    resize() {
        const gl = this.gl;
        if (!gl) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Clears the WebGL canvas.
     */
    clear() {
        const gl = this.gl;
        if (!gl) return;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    /**
     * Returns the WebGL rendering context.
     * @returns {WebGL2RenderingContext | WebGLRenderingContext}
     */
    getGL() {
        return this.gl;
    }
}