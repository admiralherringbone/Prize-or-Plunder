/**
 * Responsible for procedurally generating the layout of masts and sails.
 */
class RiggingGenerator {
    /**
     * Generates positions and types for masts.
     * @param {object} options - The parameters for mast placement.
     * @param {number} options.mastCount - The number of masts to place.
     * @param {number} options.totalLength - The total length of the ship.
     * @returns {Array<object>} An array of mast layout objects, each with {x, y, type}.
     */
    static generate({ mastCount, totalLength }) {
        const masts = [];
        const halfLength = totalLength / 2;

        if (mastCount === 1) {
            // 1-Mast: Mainmast at the center.
            masts.push({ x: 0, y: 0, type: 'main' });
        } else if (mastCount === 2) {
            // --- FIX: A 2-mast ship has a Foremast and a Mainmast. ---
            // Foremast is 1/3 from bow, Mainmast is 1/3 from stern.
            const positionOffset = totalLength / 6;
            masts.push({ x:  positionOffset, y: 0, type: 'fore' }); // Foremast
            masts.push({ x: -positionOffset, y: 0, type: 'main' }); // Mainmast (aft)
        } else if (mastCount >= 3) {
            // --- FIX: A 3-mast ship re-centers the Mainmast and adds a Mizzenmast. ---
            // This places them at +/- 1/3 of the total length from the center, and at the center.
            const positionOffset = totalLength / 3;
            masts.push({ x: positionOffset, y: 0, type: 'fore' });    // Foremast
            masts.push({ x: 0, y: 0, type: 'main' });      // Mainmast
            masts.push({ x: -positionOffset, y: 0, type: 'mizzen' }); // Mizzenmast
        }

        return masts;
    }
}