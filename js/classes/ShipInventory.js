/**
 * Manages the cargo and inventory of a ship.
 * Handles generating loot based on roles and packing items into appropriate containers.
 */
class ShipInventory {
    constructor(capacity) {
        this.capacity = capacity; // Total capacity in "Units"
        this.usedCapacity = 0;
        this.cargo = []; // Array of { item: ItemData, container: ItemData|null, quantity: number }
        this._cargoMap = new Map(); // Optimization: Fast lookup for existing stacks
        
        // Optimization: Use static cache to avoid repeated Object.values() calls during generation
        if (!ShipInventory._cachedItemList) {
             ShipInventory._cachedItemList = Object.values(window.ITEM_DATABASE || {});
             ShipInventory._containerCache = {};
             ShipInventory._indices = { byCategory: {}, byCatSubcat: {} }; // New: Static Indices

             ShipInventory._cachedItemList.forEach(item => {
                // Container Cache
                if (item.category === window.ITEM_CATEGORIES.CONTAINER) {
                    if (!ShipInventory._containerCache[item.subcategory]) {
                        ShipInventory._containerCache[item.subcategory] = [];
                    }
                    ShipInventory._containerCache[item.subcategory].push(item);
                }

                // Category Index
                if (!ShipInventory._indices.byCategory[item.category]) {
                    ShipInventory._indices.byCategory[item.category] = [];
                }
                ShipInventory._indices.byCategory[item.category].push(item);

                // Subcategory Index
                if (item.subcategory) {
                    const key = `${item.category}|${item.subcategory}`;
                    if (!ShipInventory._indices.byCatSubcat[key]) {
                        ShipInventory._indices.byCatSubcat[key] = [];
                    }
                    ShipInventory._indices.byCatSubcat[key].push(item);
                }
            });
        }
        
        // Assign from static cache
        this._cachedItemList = ShipInventory._cachedItemList;
        this._containerCache = ShipInventory._containerCache;
        this._indices = ShipInventory._indices;
    }

    /**
     * Adds a specific item to the inventory.
     * @param {string} itemId - The ID of the item to add.
     * @param {number} quantity - The quantity to add.
     */
    addItem(itemId, quantity) {
        const item = this._cachedItemList.find(i => i.id === itemId);
        if (item && quantity > 0) {
            this._addItemToCargo(item, quantity);
        }
    }

    /**
     * Generates the ship's inventory based on a specific role.
     * @param {string} roleKey - The key of the role in MERCHANT_ROLES or NAVY_ROLES.
     * @param {string} roleType - 'merchant' or 'navy'.
     * @param {Ship} [ship=null] - The ship instance, required for stat-based generation.
     */
    generateForRole(roleKey, roleType = 'merchant', ship = null) {
        const rolesDB = window.NPC_ROLES[roleType];
        const role = rolesDB ? rolesDB[roleKey] : null;

        if (!role) {
            console.warn(`[ShipInventory] Role ${roleKey} not found.`);
            return;
        }

        // --- NEW: Whitelist Support ---
        if (role.whitelist) {
            this._processWhitelist(role.whitelist, ship);
        }

        // console.log(`[ShipInventory] Generating for role: ${roleKey} (Capacity: ${this.capacity})`);

        // 1. Generate Provisions (Fixed Percentage)
        if (role.cargoPlan && role.cargoPlan.provisions) {
            const provPlan = role.cargoPlan.provisions;
            const targetSpace = this.capacity * provPlan.targetFillPercentage;
            this._fillCategory(targetSpace, provPlan, window.ITEM_CATEGORIES.CONSUMABLE);
        }

        // 2. Generate Trade Goods (Remaining Space)
        if (role.cargoPlan && role.cargoPlan.tradeGoods) {
            let tradePlan = role.cargoPlan.tradeGoods;
            
            // Handle Variants
            if (tradePlan.variants) {
                tradePlan = this._selectVariant(tradePlan.variants);
                // console.log(`[ShipInventory] Selected variant: ${tradePlan.name || 'Unnamed'}`); // Debug
                if (tradePlan.plan) tradePlan = tradePlan.plan; // Unwrap the plan object
            }

            const remainingSpace = this.capacity - this.usedCapacity;
            // Fill the rest, but leave a small buffer (e.g., 10%) for realism/randomness
            const targetSpace = remainingSpace * 0.9; 
            
            if (targetSpace > 0) {
                this._fillGeneric(targetSpace, tradePlan);
            }
        }
    }

    /**
     * Processes a specific whitelist of items and quantities.
     * @param {Array} whitelist - The array of rules.
     * @param {Ship} ship - The ship instance for stat calculations.
     */
    _processWhitelist(whitelist, ship) {
        if (!ship) {
            console.warn("[ShipInventory] Whitelist generation requires a ship instance.");
            return;
        }

        const getStat = (statName) => {
            if (statName === 'totalGuns') return (typeof ship.getTotalGunCount === 'function') ? ship.getTotalGunCount() : 0;
            return ship[statName] || 0;
        };

        for (const rule of whitelist) {
            // Stop if full
            if (this.usedCapacity >= this.capacity) break;

            let qty = 0;
            let itemDef = null;
            let containerDef = null;

            // Determine Container (Specific ID or Subcategory)
            if (rule.container) {
                containerDef = this._cachedItemList.find(i => i.id === rule.container);
                if (!containerDef) {
                    containerDef = this._findBestContainer([rule.container]);
                }
            }

            if (rule.type === 'category_fill') {
                const volume = rule.volumeCalculator(ship);
                const plan = {
                    categoryWeights: { [rule.category]: 100 },
                    itemSubcategoryWeights: { [rule.subcategory]: 100 }
                };
                this._fillGeneric(volume, plan);
            }
            else if (rule.type === 'specific_items_volume') {
                const totalVolume = rule.volumeCalculator(ship);
                rule.items.forEach(itemRule => {
                    const itemVolume = totalVolume * itemRule.weight; // weight is percentage (0.0-1.0)
                    itemDef = this._cachedItemList.find(i => i.id === itemRule.id);
                    if (itemDef) {
                        // --- FIX: Determine container upfront to calculate correct unit size ---
                        let effectiveContainer = containerDef;
                        if (!effectiveContainer && itemDef.primaryStorage && itemDef.primaryStorage.length > 0) {
                            effectiveContainer = this._findBestContainer(itemDef.primaryStorage);
                        }

                        // Use container weight if available, else item weight
                        const unitSize = (effectiveContainer && effectiveContainer.weight > 0) ? effectiveContainer.weight : ((typeof itemDef.fixedSize === 'number') ? itemDef.fixedSize : itemDef.weight);
                        qty = Math.ceil(itemVolume / unitSize);
                        if (qty > 0) this._addItemToCargo(itemDef, qty, effectiveContainer);
                    }
                });
            }
            else if (rule.type === 'item_stat_scaled') {
                const statVal = getStat(rule.stat);
                qty = Math.ceil(statVal * rule.multiplier);
                itemDef = this._cachedItemList.find(i => i.id === rule.id);
                if (itemDef && qty > 0) this._addItemToCargo(itemDef, qty, containerDef);
            }
            else if (rule.type === 'item_fixed') {
                itemDef = this._cachedItemList.find(i => i.id === rule.id);
                if (itemDef) this._addItemToCargo(itemDef, rule.count, containerDef);
            }
        }
    }

    /**
     * Selects a variant from a list based on weights.
     */
    _selectVariant(variants) {
        const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
        let random = Math.random() * totalWeight;
        for (const variant of variants) {
            if (random < variant.weight) return variant;
            random -= variant.weight;
        }
        return variants[0];
    }

    /**
     * Fills a specific amount of space using a generic plan (categories, ratings, etc.).
     */
    _fillGeneric(targetSpace, plan) {
        let spaceFilled = 0;
        let attempts = 0;

        // If singleItemOnly is set, pick ONE item and fill the space with it.
        if (plan.singleItemOnly) {
            const item = this._pickRandomItem(plan);
            if (item) {
                // Optimization: Calculate max quantity and add all at once
                const container = (item.primaryStorage && item.primaryStorage.length > 0) 
                    ? this._findBestContainer(item.primaryStorage) 
                    : null;
                
                // If in a container with weight, use it. If container weight is 0 (e.g. Bundle), use item fixedSize or weight.
                const unitSize = (container && container.weight > 0) ? container.weight : ((typeof item.fixedSize === 'number') ? item.fixedSize : item.weight);
                if (unitSize > 0) {
                    const remainingSpace = this.capacity - this.usedCapacity;
                    // Fill up to targetSpace, but bounded by actual capacity
                    const spaceToFill = Math.min(targetSpace, remainingSpace);
                    const quantity = Math.floor(spaceToFill / unitSize);
                    
                    if (quantity > 0) {
                        this._addItemToCargo(item, quantity, container);
                        spaceFilled += quantity * unitSize;
                    }
                }
            }
            return;
        }

        // Standard mixed filling
        // Optimization: Reduced max attempts from 100 to 20 to prevent tail-end thrashing
        while (spaceFilled < targetSpace && this.usedCapacity < this.capacity && attempts < 20) {
            const item = this._pickRandomItem(plan);
            // Optimization: If remaining space is tiny, stop trying to fill it to save cycles
            if ((this.capacity - this.usedCapacity) < 0.1) break;

            if (item) {
                // Optimization: Batch addition
                // Determine container once
                const container = (item.primaryStorage && item.primaryStorage.length > 0) 
                    ? this._findBestContainer(item.primaryStorage) 
                    : null;
                // If in a container with weight, use it. If container weight is 0 (e.g. Bundle), use item fixedSize or weight.
                const unitSize = (container && container.weight > 0) ? container.weight : ((typeof item.fixedSize === 'number') ? item.fixedSize : item.weight);
                
                // Determine batch size: Try to fill ~5% of capacity or 10 units at a time, whichever is smaller
                // This prevents adding 1 biscuit at a time (slow) while keeping variety.
                let quantity = 1;
                if (unitSize > 0) {
                    // Optimization: Scale batch size with capacity. Use Max to ensure large ships get large batches.
                    // Was previously Math.min which capped at 10 units, causing 200+ iterations for large ships.
                    const batchSpace = Math.max(this.capacity * 0.05, 10); 
                    const maxQtyBySpace = Math.floor((this.capacity - this.usedCapacity) / unitSize);
                    const desiredQty = Math.ceil(batchSpace / unitSize);
                    
                    // Randomize slightly so it's not always the max batch
                    quantity = Math.floor(Math.random() * desiredQty) + 1;
                    
                    // Clamp to available space and target space
                    const remainingTarget = targetSpace - spaceFilled;
                    const maxQtyByTarget = Math.floor(remainingTarget / unitSize);
                    
                    // Allow slightly overfilling the "target" (soft limit) to ensure progress, but never capacity
                    quantity = Math.min(quantity, Math.max(1, maxQtyByTarget + 1)); 
                    quantity = Math.min(quantity, maxQtyBySpace);
                }

                if (quantity > 0) {
                    const addedSize = this._addItemToCargo(item, quantity, container);
                    if (addedSize > 0) {
                        spaceFilled += addedSize;
                        attempts = 0; // Reset attempts on success
                    } else {
                        attempts++;
                    }
                } else {
                    attempts++;
                }
            } else {
                attempts++;
            }
        }
    }

    /**
     * Helper to fill a specific category (mostly for provisions).
     */
    _fillCategory(targetSpace, plan, forcedCategory) {
        // Create a temporary plan that forces the category
        const catPlan = { ...plan, categoryWeights: { [forcedCategory]: 100 } };
        this._fillGeneric(targetSpace, catPlan);
    }

    /**
     * Picks a random item from the database matching the plan's constraints.
     */
    _pickRandomItem(plan) {
        // 1. Pick Category
        const category = this._pickWeighted(plan.categoryWeights);
        if (!category) return null;

        // 2. Pick Subcategory (Optional)
        let candidates = this._indices.byCategory[category] || [];
        let subcategory = null;

        if (plan.itemSubcategoryWeights) {
            subcategory = this._pickWeighted(plan.itemSubcategoryWeights);
            if (subcategory) {
                // Optimization: Use the specific index if available
                const key = `${category}|${subcategory}`;
                if (this._indices.byCatSubcat[key]) {
                    candidates = this._indices.byCatSubcat[key];
                }
            }
        }

        // 3. Pick Trade Rating (Optional)
        let rating = null;
        if (plan.tradeRatingWeights) {
            rating = this._pickWeighted(plan.tradeRatingWeights);
        } else if (plan.tradeRatingFilter) {
            // If a strict filter is provided (like for provisions)
            rating = plan.tradeRatingFilter[Math.floor(Math.random() * plan.tradeRatingFilter.length)];
        }

        // 4. Filter Candidates (Reduced set)
        const finalCandidates = candidates.filter(item => {
            if (rating && item.tradeRating !== rating) return false;
            
            // Handle specific item filters (e.g., 'Raws': ['grain'])
            if (plan.itemFilter && subcategory && plan.itemFilter[subcategory]) {
                if (!plan.itemFilter[subcategory].includes(item.id)) return false;
            }

            return true;
        });

        if (finalCandidates.length === 0) return null;
        return finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    }

    _pickWeighted(weights) {
        if (!weights) return null;
        // Optimization: Avoid Object.values/entries to reduce GC pressure
        let total = 0;
        for (const key in weights) {
            total += weights[key];
        }
        
        let random = Math.random() * total;
        for (const key in weights) {
            if (random < weights[key]) return key;
            random -= weights[key];
        }
        return null;
    }

    /**
     * Adds an item to the cargo, wrapping it in a container if necessary.
     * Returns the total space used.
     */
    _addItemToCargo(item, quantity = 1, preSelectedContainer = null) {
        // 1. Determine Container (if not provided)
        let container = preSelectedContainer;
        if (container === null && item.primaryStorage && item.primaryStorage.length > 0) {
            container = this._findBestContainer(item.primaryStorage);
        }

        // 2. Calculate Size
        // If in a container with weight, use it. If container weight is 0 (e.g. Bundle), use item fixedSize or weight.
        const unitSize = (container && container.weight > 0) ? container.weight : ((typeof item.fixedSize === 'number') ? item.fixedSize : item.weight);
        const totalSize = unitSize * quantity;

        // 3. Check Capacity
        if (this.usedCapacity + totalSize > this.capacity) {
            return 0;
        }

        // 4. Add to Cargo
        // Check if an identical item configuration already exists
        const key = `${item.id}_${container ? container.id : 'null'}`;
        const existingEntry = this._cargoMap.get(key);

        if (existingEntry) {
            existingEntry.quantity += quantity;
            existingEntry.totalWeight += totalSize; // Update cached weight
            existingEntry.lastUpdated = performance.now(); // Track update time
        } else {
            const newEntry = {
                item: item,
                container: container,
                quantity: quantity,
                unitWeight: unitSize, // Cache for UI
                totalWeight: totalSize, // Cache for UI
                lastUpdated: performance.now() // Track update time
            };
            this.cargo.push(newEntry);
            this._cargoMap.set(key, newEntry);
        }

        this.usedCapacity += totalSize;

        return totalSize;
    }

    /**
     * Removes a specific quantity from a cargo entry.
     * @param {object} entry - The cargo entry object to modify.
     * @param {number} quantity - The amount to remove.
     * @returns {object|null} The removed item data (item, container, quantity) or null if failed.
     */
    removeEntry(entry, quantity) {
        if (!entry || quantity <= 0 || entry.quantity < quantity) return null;

        // Calculate size to free up
        const unitSize = entry.unitWeight || 0;
        const totalSizeToRemove = unitSize * quantity;

        // Update Entry
        entry.quantity -= quantity;
        entry.totalWeight -= totalSizeToRemove;
        entry.lastUpdated = performance.now(); // Track update time
        
        // Update Inventory Totals
        this.usedCapacity = Math.max(0, this.usedCapacity - totalSizeToRemove);

        // Remove entry if empty
        if (entry.quantity <= 0) {
            const index = this.cargo.indexOf(entry);
            if (index > -1) this.cargo.splice(index, 1);
            
            // Remove from map
            const key = `${entry.item.id}_${entry.container ? entry.container.id : 'null'}`;
            this._cargoMap.delete(key);
        }

        return { item: entry.item, container: entry.container, quantity: quantity };
    }

    /**
     * Transfers a quantity of an entry to another inventory.
     * @param {ShipInventory} targetInventory - The inventory to receive the item.
     * @param {object} entry - The cargo entry to transfer.
     * @param {number} quantity - The amount to transfer.
     * @returns {boolean} True if successful.
     */
    transferEntry(targetInventory, entry, quantity) {
        // 1. Check if target can accept (simulate addition)
        // We use _addItemToCargo logic check without adding yet? 
        // Actually _addItemToCargo returns 0 if it fails capacity.
        
        // 2. Remove from self
        const removed = this.removeEntry(entry, quantity);
        if (!removed) return false;

        // 3. Add to target
        const addedSize = targetInventory._addItemToCargo(removed.item, removed.quantity, removed.container);
        
        // Rollback if add failed (shouldn't happen if we checked capacity, but good for safety)
        if (addedSize === 0 && removed.quantity > 0) {
            // Put it back!
            this._addItemToCargo(removed.item, removed.quantity, removed.container);
            return false;
        }
        return true;
    }

    /**
     * Finds a suitable container item from the database based on preference list.
     */
    _findBestContainer(preferences) {
        // Preferences is array of strings, e.g., ['Barrel', 'Sack']
        // We want to find items in ITEM_DATABASE where category='Container' and subcategory is in preferences.
        
        // 1. Filter valid containers
        const validContainers = [];
        for (const pref of preferences) {
            if (this._containerCache[pref]) {
                validContainers.push(...this._containerCache[pref]);
            }
        }

        if (validContainers.length === 0) return null;

        // 2. Pick one. 
        // Logic: Prefer larger containers for efficiency? Or random?
        // Let's go with random for variety for now.
        return validContainers[Math.floor(Math.random() * validContainers.length)];
    }
}

// Expose globally
window.ShipInventory = ShipInventory;