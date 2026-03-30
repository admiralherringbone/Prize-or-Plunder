/**
 * BufferManager.js
 * 
 * Manages GPU memory (Vertex Buffer Objects).
 * It converts island perimeters into high-performance buffers that live on the GPU.
 */
class BufferManager {
    /**
     * @param {WebGL2RenderingContext} gl 
     */
    constructor(gl) {
        this.gl = gl;
        // islandId -> Map<layerName, { vbo, ibo, count, indexCount }>
        this.islandLayers = new Map();
    }

    /**
     * Takes raw island data and uploads it to the GPU.
     * Each vertex stores: [x, y, normalX, normalY, perimeterDistance]
     * @param {number|string} islandId
     * @param {string} layerName - e.g., 'wet', 'dry', 'grass'
     * @param {Array<object>} perimeter - Array of {x, y} points.
     * @param {Float32Array|null} normals - Inward-facing normals.
     * @param {Float32Array|null} dists - Cumulative distance along perimeter.
     * @param {Array<number>|null} indices - Optional triangulation indices.
     */
    bakeLayer(islandId, layerName, perimeter, normals = null, dists = null, indices = null) {
        const gl = this.gl;
        const vertexCount = perimeter.length;
        
        // If normals/dists aren't provided (inner layers), use zeros.
        const safeNormals = normals || new Float32Array(vertexCount * 2);
        const safeDists = dists || new Float32Array(vertexCount);

        const data = new Float32Array(vertexCount * 5);
        for (let i = 0; i < vertexCount; i++) {
            const base = i * 5;
            const p = perimeter[i];
            
            data[base]     = p.x;     // Position X
            data[base + 1] = p.y;     // Position Y
            data[base + 2] = safeNormals[i * 2];     // Normal X
            data[base + 3] = safeNormals[i * 2 + 1]; // Normal Y
            data[base + 4] = safeDists[i];           // Distance
        }

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

        let ibo = null;
        if (indices) {
            ibo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        }

        if (!this.islandLayers.has(islandId)) this.islandLayers.set(islandId, new Map());
        
        this.islandLayers.get(islandId).set(layerName, {
            vbo: vbo,
            ibo: ibo,
            count: vertexCount,
            indexCount: indices ? indices.length : 0
        });
    }

    /**
     * Deletes all buffers from GPU memory to prevent leaks on reset.
     */
    clear() {
        for (const layerMap of this.islandLayers.values()) {
            for (const data of layerMap.values()) {
                this.gl.deleteBuffer(data.vbo);
                if (data.ibo) this.gl.deleteBuffer(data.ibo);
            }
        }
        this.islandLayers.clear();
    }
}