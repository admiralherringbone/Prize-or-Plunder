/**
 * This file defines the "roles" for NPC ships, determining their cargo,
 * potential archetypes, and behavior.
 * Consolidated from merchant_roles.js and navy_roles.js.
 */

const NPC_ROLES = {
    default: {
        'essential-equipage': {
            name: 'Essential Equipage',
            description: 'Standard provisioning for a new captain.',
            compatibleArchetypes: [], // Not used for NPC spawning
            whitelist: [
                // 1. Cannons (Must have exact count based on slots)
                { type: 'item_stat_scaled', id: 'cannon', stat: 'totalGuns', multiplier: 1 }, 

                // 2. Equipment (Tools - Fixed count, negligible size)
                { type: 'item_fixed', id: 'spyglass', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'compass', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'nautical-chart', count: 1, container: 'small-chest' },

                // 3. Ammunition (15% of Hold Capacity)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'round-shot', weight: 0.70 }, // 70% of ammo space
                        { id: 'gunpowder', weight: 0.30 }   // 30% of ammo space
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.15 : 0)
                },

                // 4. Provisions (25% of Hold Capacity)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'water', weight: 0.40 },
                        { id: 'biscuit', weight: 0.30 },
                        { id: 'dried-beef', weight: 0.20 },
                        { id: 'rum', weight: 0.10 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.25 : 0)
                },

                // 5. Repair Materials (20% of Hold Capacity)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'timber', weight: 0.30 },
                        { id: 'wood-fittings', weight: 0.10 },
                        { id: 'spars', weight: 0.20 },
                        { id: 'iron-fittings', weight: 0.10 },
                        { id: 'hemp-rope', weight: 0.20 },
                        { id: 'hemp-canvas', weight: 0.10 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.20 : 0)
                }
            ]
        },
        'debug-loadout': {
            name: 'Debug Loadout',
            description: 'Testing loadout with all ammo types and extra resources.',
            compatibleArchetypes: [], // Not used for NPC spawning
            whitelist: [
                // 1. Cannons (Must have exact count based on slots)
                { type: 'item_stat_scaled', id: 'cannon', stat: 'totalGuns', multiplier: 1 },

                // 2. Equipment (Tools - Fixed count, negligible size)
                { type: 'item_fixed', id: 'spyglass', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'compass', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'nautical-chart', count: 1, container: 'small-chest' },

                // 3. Ammunition (25% of Hold Capacity - All types for testing)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'gunpowder', weight: 0.20 },
                        { id: 'round-shot', weight: 0.20 },
                        { id: 'chain-shot', weight: 0.20 },
                        { id: 'grape-shot', weight: 0.20 },
                        { id: 'canister-shot', weight: 0.20 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.25 : 0)
                },

                // 4. Provisions (25% of Hold Capacity)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'water', weight: 0.40 },
                        { id: 'biscuit', weight: 0.30 },
                        { id: 'dried-beef', weight: 0.20 },
                        { id: 'rum', weight: 0.10 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.25 : 0)
                },

                // 5. Repair Materials (40% of Hold Capacity - Generous for testing)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'timber', weight: 0.25 },
                        { id: 'wood-fittings', weight: 0.10 },
                        { id: 'spars', weight: 0.20 },
                        { id: 'iron-fittings', weight: 0.10 },
                        { id: 'hemp-rope', weight: 0.20 },
                        { id: 'hemp-canvas', weight: 0.15 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.40 : 0)
                }
            ]
        }
    },
    merchant: {
        'general-transport': {
            name: 'General Transport',
            description: 'A general-purpose transport ship carrying a variety of items, mostly common, some valuable, and rarely luxury.',
            spawnWeight: 50,
            compatibleArchetypes: ['Grand Merchantman', 'Merchantman', 'Merchant Brig', 'Merchant Sloop'],
            whitelist: [
                { type: 'item_stat_scaled', id: 'round-shot', stat: 'totalGuns', multiplier: 30, container: 'Crate' },
                { type: 'item_stat_scaled', id: 'gunpowder', stat: 'totalGuns', multiplier: 1, container: 'Barrel' }
            ],
            cargoPlan: {
                provisions: {
                    targetFillPercentage: 0.15,
                    itemSubcategoryWeights: { 'Edibles': 60, 'Potables': 40 },
                    tradeRatingFilter: [TRADE_RATINGS.COMMON]
                },
                tradeGoods: {
                    categoryWeights: {
                        [ITEM_CATEGORIES.RESOURCE]: 40,
                        [ITEM_CATEGORIES.CONSUMABLE]: 30,
                        [ITEM_CATEGORIES.EQUIPMENT]: 30,
                    },
                    itemSubcategoryWeights: {
                        'Edibles': 20, 'Potables': 20, 'Raws': 10,
                        'Wood': 10, 'Stone': 5, 'Iron': 5, 'Hemp': 5,
                        'Weapons': 5, 'Ammunition': 5,
                        'Tools': 1, 'Entertainment': 1, 'Furnishings': 1
                    },
                    tradeRatingWeights: {
                        [TRADE_RATINGS.COMMON]: 70,
                        [TRADE_RATINGS.VALUABLE]: 25,
                        [TRADE_RATINGS.LUXURY]: 5,
                    }
                }
            }
        },
        'provision-transport': {
            name: 'Provision Transport',
            description: 'Carries primarily items of food and drink.',
            spawnWeight: 20,
            compatibleArchetypes: ['Merchantman', 'Merchant Brig', 'Merchant Sloop'],
            whitelist: [
                { type: 'item_stat_scaled', id: 'round-shot', stat: 'totalGuns', multiplier: 30, container: 'Crate' },
                { type: 'item_stat_scaled', id: 'gunpowder', stat: 'totalGuns', multiplier: 1, container: 'Barrel' }
            ],
            cargoPlan: {
                provisions: {
                    targetFillPercentage: 0.15,
                    itemSubcategoryWeights: { 'Edibles': 60, 'Potables': 40 },
                    tradeRatingFilter: [TRADE_RATINGS.COMMON]
                },
                tradeGoods: {
                    variants: [
                        {
                            name: "Mixed Provisions",
                            weight: 70,
                            plan: {
                                categoryWeights: { [ITEM_CATEGORIES.CONSUMABLE]: 90, [ITEM_CATEGORIES.RESOURCE]: 5, [ITEM_CATEGORIES.EQUIPMENT]: 5 },
                                itemSubcategoryWeights: { 'Edibles': 45, 'Potables': 45, 'Raws': 10, 'Weapons': 5, 'Tools': 1, 'Entertainment': 1 },
                                tradeRatingWeights: { [TRADE_RATINGS.COMMON]: 80, [TRADE_RATINGS.VALUABLE]: 20, [TRADE_RATINGS.LUXURY]: 0 }
                            }
                        },
                        {
                            name: "Grain Hauler",
                            weight: 30,
                            plan: {
                                categoryWeights: { [ITEM_CATEGORIES.CONSUMABLE]: 90, [ITEM_CATEGORIES.RESOURCE]: 5, [ITEM_CATEGORIES.EQUIPMENT]: 5 },
                                itemSubcategoryWeights: { 'Potables': 45, 'Raws': 55, 'Tools': 1, 'Entertainment': 1 },
                                itemFilter: { 'Raws': ['grain'] },
                                tradeRatingWeights: { [TRADE_RATINGS.COMMON]: 100, [TRADE_RATINGS.VALUABLE]: 0, [TRADE_RATINGS.LUXURY]: 0 }
                            }
                        }
                    ]
                }
            }
        },
        'material-transport': {
            name: 'Material Transport',
            description: 'Carries primarily items of natural resources.',
            spawnWeight: 20,
            compatibleArchetypes: ['Merchantman', 'Merchant Brig', 'Merchant Sloop'],
            whitelist: [
                { type: 'item_stat_scaled', id: 'round-shot', stat: 'totalGuns', multiplier: 30, container: 'Crate' },
                { type: 'item_stat_scaled', id: 'gunpowder', stat: 'totalGuns', multiplier: 1, container: 'Barrel' }
            ],
            cargoPlan: {
                provisions: {
                    targetFillPercentage: 0.15,
                    itemSubcategoryWeights: { 'Edibles': 60, 'Potables': 40 },
                    tradeRatingFilter: [TRADE_RATINGS.COMMON]
                },
                tradeGoods: {
                    variants: [
                        {
                            name: "Mixed Materials",
                            weight: 60,
                            plan: {
                                categoryWeights: { [ITEM_CATEGORIES.RESOURCE]: 90, [ITEM_CATEGORIES.CONSUMABLE]: 5, [ITEM_CATEGORIES.EQUIPMENT]: 5 },
                                itemSubcategoryWeights: { 'Wood': 30, 'Stone': 20, 'Iron': 20, 'Edibles': 10, 'Weapons': 5, 'Tools': 1, 'Entertainment': 1 },
                                tradeRatingWeights: { [TRADE_RATINGS.COMMON]: 60, [TRADE_RATINGS.VALUABLE]: 35, [TRADE_RATINGS.LUXURY]: 5 }
                            }
                        },
                        {
                            name: "Bulk Material",
                            weight: 40,
                            plan: {
                                singleItemOnly: true,
                                categoryWeights: { [ITEM_CATEGORIES.RESOURCE]: 100 },
                                itemSubcategoryWeights: {
                                    'Wood': 20, 'Stone': 15, 'Iron': 15, 'Copper': 10, 'Coal': 15,
                                    'Hemp': 10, 'Cotton': 5, 'Wool': 5, 'Leather': 3, 'Fur Pelt': 2
                                },
                                tradeRatingWeights: { [TRADE_RATINGS.COMMON]: 60, [TRADE_RATINGS.VALUABLE]: 35, [TRADE_RATINGS.LUXURY]: 5 }
                            }
                        }
                    ]
                }
            }
        },
        'treasure-transport': {
            name: 'Treasure Transport',
            description: 'Carries primarily items of valuable and luxury amongst its general cargo.',
            spawnWeight: 5,
            compatibleArchetypes: ['Grand Merchantman'],
            whitelist: [
                { type: 'item_stat_scaled', id: 'round-shot', stat: 'totalGuns', multiplier: 30, container: 'Crate' },
                { type: 'item_stat_scaled', id: 'gunpowder', stat: 'totalGuns', multiplier: 1, container: 'Barrel' }
            ],
            cargoPlan: {
                provisions: {
                    targetFillPercentage: 0.15,
                    itemSubcategoryWeights: { 'Edibles': 60, 'Potables': 40 },
                    tradeRatingFilter: [TRADE_RATINGS.COMMON]
                },
                tradeGoods: {
                    categoryWeights: {
                        [ITEM_CATEGORIES.RESOURCE]: 30,
                        [ITEM_CATEGORIES.CONSUMABLE]: 30,
                        [ITEM_CATEGORIES.EQUIPMENT]: 20,
                        [ITEM_CATEGORIES.COIN]: 20,
                    },
                    itemSubcategoryWeights: {
                        'Spices': 20, 'Gemstone': 15, 'Gold': 10, 'Silver': 10,
                        'Edibles': 10, 'Potables': 10,
                        'Weapons': 10, 'Ammunition': 5,
                        'Tools': 1, 'Entertainment': 1, 'Furnishings': 1
                    },
                    tradeRatingWeights: {
                        [TRADE_RATINGS.COMMON]: 10,
                        [TRADE_RATINGS.VALUABLE]: 50,
                        [TRADE_RATINGS.LUXURY]: 40,
                    }
                }
            }
        }
    },
    navy: {
        'warship': {
            name: 'Warship',
            description: 'Carries a variety of supply from food, repairs, to ammunition including a high number of various cannon shots.',
            compatibleArchetypes: ['Naval Cutter', 'Corvette', 'Frigate', '2-Decker Ship of the Line', '3-Decker Ship of the Line'],
            whitelist: [
                // 1. Cannons
                { type: 'item_stat_scaled', id: 'cannon', stat: 'totalGuns', multiplier: 1 },

                // 2. Equipment (Tools)
                { type: 'item_fixed', id: 'spyglass', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'compass', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'nautical-chart', count: 1, container: 'small-chest' },
                { type: 'item_fixed', id: 'sextant', count: 1, container: 'small-chest' },

                // 3. Ammunition (30% of Hold - Heavy Combat Load)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'round-shot', weight: 0.50 },
                        { id: 'gunpowder', weight: 0.20 },
                        { id: 'chain-shot', weight: 0.20 },
                        { id: 'grape-shot', weight: 0.20 },
                        { id: 'canister-shot', weight: 0.10 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.30 : 0)
                },

                // 4. Provisions (20% of Hold)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'water', weight: 0.40 },
                        { id: 'biscuit', weight: 0.30 },
                        { id: 'dried-beef', weight: 0.15 },
                        { id: 'rum', weight: 0.15 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.20 : 0)
                },

                // 5. Repair Materials (25% of Hold - Self-sufficiency)
                {
                    type: 'specific_items_volume',
                    items: [
                        { id: 'timber', weight: 0.30 },
                        { id: 'wood-fittings', weight: 0.10 },
                        { id: 'spars', weight: 0.20 },
                        { id: 'iron-fittings', weight: 0.10 },
                        { id: 'hemp-rope', weight: 0.15 },
                        { id: 'hemp-canvas', weight: 0.15 }
                    ],
                    volumeCalculator: (ship) => (ship.inventory ? ship.inventory.capacity * 0.25 : 0)
                }
            ]
        }
    }
};

window.NPC_ROLES = NPC_ROLES;