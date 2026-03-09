/**
 * Manages the player's fleet of allied ships.
 * Handles adding/removing members and calculating formation positions.
 */
class FleetManager {
    constructor(playerShip) {
        this.flagship = playerShip;
        this.members = []; // Array of AlliedShip instances
        this.formation = 'line_astern';
    }

    /**
     * Adds a ship to the fleet.
     * @param {AlliedShip} ship 
     */
    addMember(ship) {
        if (!this.members.includes(ship)) {
            this.members.push(ship);
            ship.fleetIndex = this.members.length - 1;
            ship.fleetManager = this;
            console.log(`[Fleet] ${ship.displayName} added to fleet at index ${ship.fleetIndex}.`);
        }
    }

    /**
     * Removes a ship from the fleet.
     * @param {AlliedShip} ship 
     */
    removeMember(ship) {
        const index = this.members.indexOf(ship);
        if (index > -1) {
            this.members.splice(index, 1);
            ship.fleetManager = null;
            ship.fleetIndex = -1;
            // Re-index remaining members to close the gap
            this.members.forEach((m, i) => m.fleetIndex = i);
        }
    }

    /**
     * Sets the current fleet formation.
     * @param {string} formationKey 
     */
    setFormation(formationKey) {
        if (FLEET_FORMATIONS[formationKey]) {
            this.formation = formationKey;
            console.log(`[Fleet] Formation set to ${FLEET_FORMATIONS[formationKey].name}`);
        }
    }

    /**
     * Calculates the target world position for a specific fleet member.
     * @param {number} memberIndex 
     * @returns {{x: number, y: number}|null}
     */
    getFormationPosition(memberIndex) {
        if (!this.flagship) return null;

        const formationDef = FLEET_FORMATIONS[this.formation];
        
        // Get offset or calculate a fallback if the fleet is larger than the defined offsets
        let offset;
        if (formationDef && memberIndex < formationDef.offsets.length) {
            offset = formationDef.offsets[memberIndex];
        } else {
            // Fallback: Just pile them up behind in a line if we run out of defined slots
            const fallbackDist = (memberIndex + 1) * 2.5;
            offset = { x: -fallbackDist, y: 0 };
        }

        return this._transformOffsetToWorld(offset);
    }

    /**
     * Transforms a local formation offset into world coordinates based on the flagship.
     * @param {{x: number, y: number}} offset 
     * @returns {{x: number, y: number}}
     * @private
     */
    _transformOffsetToWorld(offset) {
        // Scale offset by flagship length to maintain relative spacing regardless of ship size
        const spacingUnit = this.flagship.shipLength; 
        
        const localX = offset.x * spacingUnit;
        const localY = offset.y * spacingUnit;

        // Rotate by flagship angle
        // Note: In our coordinate system, 0 degrees is East.
        // Forward is +X (local), Right is +Y (local).
        const cos = Math.cos(this.flagship.angle);
        const sin = Math.sin(this.flagship.angle);

        // Standard 2D rotation matrix
        const worldX = this.flagship.x + (localX * cos - localY * sin);
        const worldY = this.flagship.y + (localX * sin + localY * cos);

        return { x: worldX, y: worldY };
    }
    
    /**
     * Returns the total number of ships in the fleet (excluding flagship).
     */
    getCount() {
        return this.members.length;
    }

    /**
     * Draws debug visuals for fleet formation and status.
     * Shows the target slot and the "Stop Threshold" radius.
     * @param {CanvasRenderingContext2D} ctx 
     */
    drawDebug(ctx) {
        if (!this.flagship) return;

        ctx.save();
        
        this.members.forEach((member) => {
            // Calculate target position (same as FleetPilot)
            const targetPos = this.getFormationPosition(member.fleetIndex);
            
            if (targetPos) {
                // 1. Draw the target formation slot (The "Ideal" position)
                ctx.fillStyle = 'rgba(0, 255, 255, 0.8)'; // Cyan dot
                ctx.beginPath();
                ctx.arc(targetPos.x, targetPos.y, 3, 0, Math.PI * 2);
                ctx.fill();

                // 2. Draw the "Stop Threshold" (Station Keeping Radius)
                // Logic matches FleetPilot.js: const stopThreshold = this.ship.shipLength * 1.0;
                // Inside this radius, the ship closes sails.
                const stopThreshold = member.shipLength * 1.0;
                
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)'; // Green ring
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(targetPos.x, targetPos.y, stopThreshold, 0, Math.PI * 2);
                ctx.stroke();

                // 3. Draw "Slow Down" Threshold
                // Logic matches FleetPilot.js: const slowThreshold = this.ship.shipLength * 3.0;
                const slowThreshold = member.shipLength * 3.0;
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)'; // Yellow ring
                ctx.setLineDash([2, 8]);
                ctx.beginPath();
                ctx.arc(targetPos.x, targetPos.y, slowThreshold, 0, Math.PI * 2);
                ctx.stroke();

                // 4. Draw tether line from ship to its slot
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
                ctx.setLineDash([]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(member.x, member.y);
                ctx.lineTo(targetPos.x, targetPos.y);
                ctx.stroke();
            }
        });

        ctx.restore();
    }
}