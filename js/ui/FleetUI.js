/**
 * Handles the UI for the fleet system, including the HUD overlay
 * and the Seize Ship dialog.
 */
class FleetUI {
    constructor() {
        this.dialog = null;
        this.targetShip = null;
        this.player = null;
        this._injectSeizeDialog();
    }

    /**
     * Draws the fleet status on the HUD.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {FleetManager} fleetManager 
     */
    drawFleetStatus(ctx, fleetManager) {
        if (!fleetManager || fleetManager.getCount() === 0) return;

        const startX = 20;
        let currentY = 200; // Below player status area
        const circleRadius = 20;
        const gap = 15;

        ctx.save();
        
        // Header
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px "IM Fell English"';
        ctx.textAlign = 'left';
        ctx.fillText("Fleet", startX, currentY - 10);

        fleetManager.members.forEach((ship) => {
            const centerY = currentY + circleRadius;
            const centerX = startX + circleRadius;

            // 1. Circular Image
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            ctx.strokeStyle = '#4A90E2'; // Allied Blue
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Clip and Draw Ship
            ctx.clip();
            const cache = ship.hullCacheCanvas || ship.shipCacheCanvas;
            if (cache) {
                const scale = (circleRadius * 1.6) / Math.max(cache.width, cache.height);
                ctx.translate(centerX, centerY);
                ctx.rotate(-Math.PI / 2); // Point up
                ctx.scale(scale, scale);
                ctx.drawImage(cache, -cache.width / 2, -cache.height / 2);
            }
            ctx.restore();

            // 2. Text Info
            const textX = startX + (circleRadius * 2) + 10;
            const textTopY = currentY;

            // Name
            ctx.fillStyle = 'white';
            ctx.font = '14px "IM Fell English"';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(ship.displayName, textX, textTopY);

            // State (Right of Name)
            const status = (ship.fleetPilot && ship.fleetPilot.state) ? ship.fleetPilot.state : ship.aiState;
            const nameWidth = ctx.measureText(ship.displayName).width;
            
            ctx.font = '10px Arial';
            ctx.fillStyle = '#cccccc';
            ctx.fillText(`[${status.toUpperCase()}]`, textX + nameWidth + 5, textTopY + 2);

            // Type (Below Name)
            ctx.fillStyle = '#bdc3c7';
            ctx.font = 'italic 11px "IM Fell English"';
            ctx.fillText(ship.shipType || ship.archetypeName || 'Unknown Class', textX, textTopY + 16);

            // 3. HP Bars (Below Type)
            const barWidth = 100;
            const barHeight = 3;
            const barSpacing = 2;
            let barY = textTopY + 30;

            // Helper for bars
            const drawBar = (current, max, color) => {
                const ratio = Math.max(0, Math.min(1, current / max));
                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(textX, barY, barWidth, barHeight);
                // Fill
                ctx.fillStyle = color;
                ctx.fillRect(textX, barY, barWidth * ratio, barHeight);
                
                barY += barHeight + barSpacing;
            };

            drawBar(ship.crew, ship.maxCrew, '#2ecc71'); // Crew (Green)
            drawBar(ship.rigHp, ship.maxRigHp, '#f1c40f'); // Rig (Yellow)
            drawBar(ship.hp, ship.maxHp, '#e74c3c'); // Hull (Red)

            // Advance Y for next ship
            currentY += 55 + gap;
        });

        ctx.restore();
    }

    _injectSeizeDialog() {
        const html = `
            <div id="seize-dialog" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:400px; background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 400 300%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M0 25 Q25 25 25 0 L375 0 Q375 25 400 25 L400 275 Q375 275 375 300 L25 300 Q25 275 0 275 Z%22 fill=%22%23ddc09a%22 fill-opacity=%220.98%22 stroke=%22%23948064%22 stroke-width=%224%22/%3E%3C/svg%3E'); background-size:100% 100%; padding:30px; font-family:'IM Fell English', serif; color:#3d352a; z-index:3000; box-shadow:0 0 20px rgba(0,0,0,0.5); box-sizing:border-box;">
                <h2 style="text-align:center; margin-top:0; border-bottom: 2px solid #3d352a; padding-bottom: 10px;">Seize Vessel</h2>
                <div id="seize-ship-info" style="text-align:center; margin-bottom:20px; font-style:italic; font-size: 18px;"></div>
                
                <div style="margin-bottom:20px;">
                    <label style="font-weight:bold;">Transfer Crew:</label>
                    <div style="display:flex; align-items:center; gap:10px; margin-top: 5px;">
                        <span id="seize-player-crew" style="min-width: 60px;">P: 0</span>
                        <input type="range" id="seize-crew-slider" min="0" max="100" value="0" style="flex:1;">
                        <span id="seize-target-crew" style="min-width: 60px; text-align: right;">T: 0</span>
                    </div>
                    <div style="text-align:center; font-size:14px; margin-top:5px; color: #5c543d;">
                        Min Sailing Crew Required: <span id="seize-min-crew" style="font-weight:bold;">0</span>
                    </div>
                </div>

                <div style="margin-bottom:25px; display:flex; align-items:center; justify-content:center; gap:10px;">
                    <input type="checkbox" id="seize-flagship-check" style="transform: scale(1.5);">
                    <label for="seize-flagship-check" style="font-size: 18px;">Make Flagship</label>
                </div>

                <div style="display:flex; justify-content:space-between; gap: 20px;">
                    <button id="btn-cancel-seize" class="inventory-btn">Cancel</button>
                    <button id="btn-confirm-seize" class="inventory-btn">Seize</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        this.dialog = document.getElementById('seize-dialog');
        this.crewSlider = document.getElementById('seize-crew-slider');
        this.playerCrewLabel = document.getElementById('seize-player-crew');
        this.targetCrewLabel = document.getElementById('seize-target-crew');
        this.minCrewLabel = document.getElementById('seize-min-crew');
        this.flagshipCheck = document.getElementById('seize-flagship-check');
        
        document.getElementById('btn-cancel-seize').addEventListener('click', () => this.closeSeizeDialog());
        document.getElementById('btn-confirm-seize').addEventListener('click', () => this._confirmSeize());
        
        this.crewSlider.addEventListener('input', () => this._updateCrewLabels());
    }

    openSeizeDialog(targetShip, player) {
        this.targetShip = targetShip;
        this.player = player;
        
        document.getElementById('seize-ship-info').textContent = targetShip.displayName || targetShip.archetypeName;
        
        const maxTransfer = Math.max(0, player.crew - 1); // Keep at least 1 crew for player
        const minNeeded = targetShip.minSailingCrew || 5;
        
        this.crewSlider.min = 0;
        this.crewSlider.max = maxTransfer;
        this.crewSlider.value = Math.min(maxTransfer, minNeeded); // Default to min needed or max available
        
        this.minCrewLabel.textContent = minNeeded;
        
        this._updateCrewLabels();
        this.dialog.style.display = 'block';
    }

    closeSeizeDialog() {
        this.dialog.style.display = 'none';
        this.targetShip = null;
        this.player = null;
    }

    _updateCrewLabels() {
        const transferAmount = parseInt(this.crewSlider.value);
        if (!this.player) return;
        
        this.playerCrewLabel.textContent = `P: ${this.player.crew - transferAmount}`;
        this.targetCrewLabel.textContent = `T: ${transferAmount}`;
        
        const minNeeded = this.targetShip.minSailingCrew || 5;
        const confirmBtn = document.getElementById('btn-confirm-seize');
        
        if (transferAmount < minNeeded) {
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = 0.5;
            this.targetCrewLabel.style.color = '#8b0000';
        } else {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = 1;
            this.targetCrewLabel.style.color = 'inherit';
        }
    }

    _confirmSeize() {
        const transferAmount = parseInt(this.crewSlider.value);
        const makeFlagship = this.flagshipCheck.checked;
        
        // Callback to game logic to perform the swap
        if (window.PlunderGame && window.PlunderGame.handleShipSeizure) {
            window.PlunderGame.handleShipSeizure(this.targetShip, transferAmount, makeFlagship);
        }
        
        this.closeSeizeDialog();
        // Also close inventory if open
        if (window.PlunderGame && window.PlunderGame.closeInventory) {
            window.PlunderGame.closeInventory();
        }
    }
}

// Create global instance
window.fleetUI = new FleetUI();