/**
 * Responsible for procedurally generating the layout of deck features like cannons.
 */
class DeckGenerator {
    /**
     * Generates an array of cannon positions and orientations.
     * @param {object} options - The parameters for cannon placement.
     * @param {number} options.gunsPerBattery - The number of cannons on each side.
     * @param {Array<object>} options.bulwarkCutoutPoints - The polygon points for the inner bulwark.
     * @param {number} options.midSectionLength - The length of the ship's mid-section.
     * @param {number} options.foreSectionLength - The length of the ship's fore-section.
     * @param {number} options.totalLength - The total length of the ship.
     * @param {string} options.buildType - The type of ship being built ('guns' or 'cargo').
     * @returns {Array<object>} An array of cannon layout objects, each with {x, y, side, angle}.
     */
    static generate({ buildType, gunsPerBattery, baseGunCount, bulwarkCutoutPoints, midSectionLength, foreSectionLength, totalLength }) {
        const cannons = [];
        if (gunsPerBattery <= 0) return cannons;

        // --- Separate the bulwark points into port and starboard sides ---
        // This prevents the generator from accidentally picking a point on the wrong side.
        // Port side has negative Y values in local coordinates.
        const portPoints = bulwarkCutoutPoints.filter(p => p.y < 0);
        const starboardPoints = bulwarkCutoutPoints.filter(p => p.y > 0);
        portPoints.sort((a, b) => a.x - b.x); // Sort from stern to bow
        starboardPoints.sort((a, b) => a.x - b.x); // Sort from stern to bow

        // The mid-section is where the cannons are placed. Its x-range in local coordinates is:
        const midSectionStartX = -totalLength / 2 + foreSectionLength;
        const midSectionEndX = midSectionStartX + midSectionLength;

        for (let i = 0; i < gunsPerBattery; i++) {
            let cannonX;

            if (buildType === 'cargo') {
                // --- New Cargo Ship Spacing: Evenly distribute cannons across the entire mid-section ---
                // The spacing ('slotWidth') is determined by the full gun count.
                const slotWidth = midSectionLength / baseGunCount;
                // The total width of the cannon block for THIS tier is based on its actual gun count.
                const totalCannonBlockWidth = slotWidth * gunsPerBattery;
                // Center this block within the mid-section. This creates the remainder space at the ends.
                const startingOffset = (midSectionLength - totalCannonBlockWidth) / 2;
                // The first cannon is placed at the start of the centered block.
                cannonX = midSectionStartX + startingOffset + (i * slotWidth) + (slotWidth / 2);
            } else { // buildType === 'guns'
                // --- Gun Ship Spacing: Centered in dedicated artillery slots ---
                const artilleryPositionSize = CANNON_UNIT_SIZE * 3; // 30 units per slot
                const totalCannonSectionLength = artilleryPositionSize * gunsPerBattery;

                // Center the block of cannon slots within the ship's mid-section.
                const startingOffset = (midSectionLength - totalCannonSectionLength) / 2;
                const firstCannonSlotCenterX = midSectionStartX + startingOffset + (artilleryPositionSize / 2);

                // Calculate the center of the current cannon's slot.
                cannonX = firstCannonSlotCenterX + (i * artilleryPositionSize);
            }

            // Find the y-position and angle of the bulwark at this x-position for both sides.
            const portCannon = this._findBulwarkPlacement(cannonX, portPoints, 'port');
            const starboardCannon = this._findBulwarkPlacement(cannonX, starboardPoints, 'starboard');

            if (portCannon) cannons.push(portCannon);
            if (starboardCannon) cannons.push(starboardCannon);
        }

        return cannons;
    }

    /**
     * Finds the Y-position and angle of the bulwark at a given X-coordinate.
     * @param {number} x - The target X-coordinate.
     * @param {Array<object>} points - The polygon points of the inner bulwark.
     * @param {string} side - 'port' or 'starboard'.
     * @returns {object|null} The placement data {x, y, side, angle} or null if not found.
     * @private
     */
    static _findBulwarkPlacement(x, points, side) {
        // Since the points are now pre-sorted and separated by side, we can iterate through them directly.
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Find the segment of the polygon that crosses our target x-coordinate on the correct side.
            if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
                // Interpolate to find the exact y-position on the bulwark line.
                const t = (x - p1.x) / (p2.x - p1.x);
                const y = p1.y + t * (p2.y - p1.y);

                // The cannon's rotation is now fixed to point directly outward from the broadside,
                // regardless of the hull's specific curve at that point.
                // Port side points left (-90 deg), Starboard side points right (+90 deg).
                const rotation = (side === 'starboard') ? Math.PI / 2 : -Math.PI / 2;

                return { x: x, y: y, side: side, angle: rotation };
            }
        }
        return null; // Should not happen on a closed polygon.
    }
}