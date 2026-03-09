/**
 * Represents a ship that has been seized by the player and added to their fleet.
 * It follows the player's flagship and engages in combat on command.
 */
class AlliedShip extends NpcShip {
    static nextId = 1;

    constructor(x, y, blueprint, options = {}) {
        // Force specific colors for allies if not provided
        if (!options.pennantColor) options.pennantColor = '#4A90E2'; // Allied Blue
        
        super(x, y, blueprint, options);

        this.shipId = `AlliedShip ${AlliedShip.nextId++}`;
        this.isAllied = true; 
        
        // Fleet specific properties
        this.fleetManager = null;
        this.fleetIndex = -1;

        // The FleetPilot handles the specific AI logic for following/combat
        // We assume FleetPilot is loaded before this file.
        this.fleetPilot = new FleetPilot(this);

        // Use the specialized AlliedCombatPilot for better fleet behavior
        this.combatPilot = new AlliedCombatPilot(this);
        
        // Initial state
        this.aiState = 'formation'; 
    }

    /**
     * Overrides NpcShip's AI state update to prevent default NPC behaviors.
     * Allied ships rely on the FleetPilot for state transitions.
     */
    updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid) {
        // We delegate all state logic to the FleetPilot.
        // We do NOT call super.updateAIState() because we don't want standard NPC aggression/fleeing logic.
        if (this.fleetPilot) {
            this.fleetPilot.updateState(player, distToPlayer, deltaTime, cannonballs, npcs, spatialGrid);
        }
    }

    /**
     * Overrides the update loop to inject FleetPilot logic.
     */
    update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder, spatialGrid) {
        // 1. Run Fleet Pilot Logic to determine steering (targetAngle, throttle)
        if (this.fleetPilot && !this.isBeingInteractedWith) {
            this.fleetPilot.update(deltaTime, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid);
        }

        // 2. Call NpcShip update. 
        // Since aiState is likely 'formation' (unknown to NpcShip), it will skip standard AI behaviors
        // but still handle physics, movement calculation, and rendering.
        super.update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder, spatialGrid);
    }
    
    /**
     * Override to draw a distinct debug overlay or UI elements if needed.
     */
    drawDebugOverlay(ctx, worldToScreenScale) {
        super.drawDebugOverlay(ctx, worldToScreenScale);
        
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            // Draw a blue ring to indicate ally status
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.arc(0, 0, this.shipLength * 0.75, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
            ctx.lineWidth = 2 / worldToScreenScale;
            ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * Overrides NpcShip's combat deactivation to return to formation state.
     */
    _deactivateCombat(pathfinder, windDirection) {
        this.aiState = 'formation';
        this.targetShip = null;
        this.pausedPathfindingDestination = null;
        this.hasBeenAttackedByPlayer = false;
        
        // Clear combat debug visuals
        if (this.combatPilot) {
            this.combatPilot.debugFireZone = null;
            this.combatPilot.debugBroadsideBoxes = [];
            this.combatPilot.debugTargetBox = null;
            this.combatPilot.debugChaseTarget = null;
        }
    }
}