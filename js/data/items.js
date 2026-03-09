/**
 * This file serves as the master database for all items in the game.
 * It defines the properties of each item, such as its name, type, value, and weight.
 *
 * - `id`: A unique, machine-readable identifier for the item.
 * - `name`: The display name of the item shown to the player.
 * - `category`: The primary category (e.g., 'Consumable', 'Resource').
 * - `subcategory`: A more specific grouping within the category.
 * - `baseValue`: The base monetary value of the item. Needs balancing.
 * - `weight`: The space the item occupies in a ship's hold, in "Units".
 * - `description`: A flavor text description for the item.
 */

// A constant for item categories to ensure consistency.
const ITEM_CATEGORIES = {
    CONSUMABLE: 'Consumable',
    RESOURCE: 'Resource',
    EQUIPMENT: 'Equipment',
    CONTAINER: 'Container',
    COIN: 'Coin',
    HUMAN: 'Human'
};

const TRADE_RATINGS = {
    COMMON: 'Common',
    VALUABLE: 'Valuable',
    LUXURY: 'Luxury'
};

const ITEM_DATABASE = {
    // --- CONSUMABLES ---
    // Edibles
    'biscuit': {
        id: 'biscuit',
        name: 'Biscuits',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Edibles',
        baseValue: 0.5,
        weight: 0.1,
        description: "Hardtack, a simple, long-lasting biscuit. A staple for any sea voyage.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack', 'Crate'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'oatmeal': {
        id: 'oatmeal',
        name: 'Oatmeal',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Edibles',
        baseValue: 0.4,
        weight: 0.1,
        description: "Coarsely ground oats, a common and filling meal.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel', 'Sack'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'dried-beef': {
        id: 'dried-beef',
        name: 'Dried Meat',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Edibles',
        baseValue: 2,
        weight: 0.2,
        description: "Salted and dried meat, preserved for long journeys.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel', 'Crate'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'dried-peas': {
        id: 'dried-peas',
        name: 'Dried Peas',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Edibles',
        baseValue: 0.3,
        weight: 0.1,
        description: "A common source of nutrients for sailors.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel', 'Sack'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'cheese': {
        id: 'cheese',
        name: 'Cheese',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Edibles',
        baseValue: 4,
        weight: 0.5,
        description: "A wheel of hard cheese, less prone to spoilage.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel', 'Sack'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    // Raws
    'grain': {
        id: 'grain',
        name: 'Grain',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Raws',
        baseValue: 4,
        weight: 1,
        description: "Raw grain, can be milled into flour or used for brewing.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'coffee-beans': {
        id: 'coffee-beans',
        name: 'Coffee Beans',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Raws',
        baseValue: 40,
        weight: 1,
        description: "Unroasted beans that produce a stimulating beverage.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack', 'Crate'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.VALUABLE
    },
    'cocoa-beans': {
        id: 'cocoa-beans',
        name: 'Cocoa Beans',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Raws',
        baseValue: 30,
        weight: 1,
        description: "The key ingredient for making chocolate, a valuable luxury.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack', 'Crate'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.VALUABLE
    },
    'tea-leaves': {
        id: 'tea-leaves',
        name: 'Tea Leaves',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Raws',
        baseValue: 60,
        weight: 1,
        description: "Dried leaves used to brew a calming, aromatic drink.",
        fixedSize: 'Container Size',
        primaryStorage: ['Crate', 'Chest'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.VALUABLE
    },
    // Seasonings
    'sugar': {
        id: 'sugar',
        name: 'Sugar',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Seasonings',
        baseValue: 30,
        weight: 1,
        description: "Refined sugar, a highly sought-after commodity.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack', 'Barrel'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.VALUABLE
    },
    'salt': {
        id: 'salt',
        name: 'Salt',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Seasonings',
        baseValue: 3,
        weight: 1,
        description: "Essential for preserving food and seasoning meals.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack', 'Barrel'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'herbs': {
        id: 'herbs',
        name: 'Herbs',
        category: ITEM_CATEGORIES.CONSUMABLE,
        subcategory: 'Seasonings',
        baseValue: 10,
        weight: 0.5,
        description: "A mix of dried herbs for adding flavor to bland ship rations.",
        fixedSize: 'Container Size',
        primaryStorage: ['Sack', 'Crate'],
        cannotOccupy: [],
        tradeRating: TRADE_RATINGS.VALUABLE
    },
    // Spices
    'pepper': { 
        id: 'pepper', name: 'Pepper', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Spices', baseValue: 50, weight: 1, description: "Black peppercorns, the 'king of spices'.",
        fixedSize: 'Container Size', primaryStorage: ['Sack', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE 
    },
    'cinnamon': { 
        id: 'cinnamon', name: 'Cinnamon', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Spices', baseValue: 60, weight: 1, description: "Aromatic bark, prized in both cooking and medicine.",
        fixedSize: 'Container Size', primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY 
    },
    'cloves': { 
        id: 'cloves', name: 'Cloves', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Spices', baseValue: 80, weight: 1, description: "Dried flower buds with a strong, pungent flavor.",
        fixedSize: 'Container Size', primaryStorage: ['Sack', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY 
    },
    'nutmeg': { 
        id: 'nutmeg', name: 'Nutmeg', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Spices', baseValue: 80, weight: 1, description: "A rare and valuable spice from distant islands.",
        fixedSize: 'Container Size', primaryStorage: ['Sack', 'Chest'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY 
    },
    'ginger': { 
        id: 'ginger', name: 'Ginger', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Spices', baseValue: 40, weight: 1, description: "A pungent root used to combat seasickness and flavor food.",
        fixedSize: 'Container Size', primaryStorage: ['Sack'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE 
    },
    // Recreational
    'tobacco': { 
        id: 'tobacco', name: 'Tobacco', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Recreational', baseValue: 30, weight: 1, description: "Dried leaves for smoking, a popular vice among sailors.",
        fixedSize: 'Container Size', primaryStorage: ['Sack', 'Barrel'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE 
    },

    // Potables
    'water': { 
        id: 'water', name: 'Water', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Potables', baseValue: 0.5, weight: 1, description: "Fresh water, the most critical supply for any voyage.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel'],
        cannotOccupy: ['Sack', 'Crate', 'Chest', 'Coffer'],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'wine': { 
        id: 'wine', name: 'Wine', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Potables', baseValue: 20, weight: 1, description: "Fine wine, often traded or consumed by officers.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel'],
        cannotOccupy: ['Sack', 'Crate', 'Chest', 'Coffer'],
        tradeRating: TRADE_RATINGS.VALUABLE
    },
    'beer': { 
        id: 'beer', name: 'Beer', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Potables', baseValue: 6, weight: 1, description: "Common ale, safer to drink than water on long trips.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel'],
        cannotOccupy: ['Sack', 'Crate', 'Chest', 'Coffer'],
        tradeRating: TRADE_RATINGS.COMMON
    },
    'rum': { 
        id: 'rum', name: 'Rum', category: ITEM_CATEGORIES.CONSUMABLE, subcategory: 'Potables', baseValue: 40, weight: 1, description: "Distilled sugar spirit, essential for crew morale.",
        fixedSize: 'Container Size',
        primaryStorage: ['Barrel'],
        cannotOccupy: ['Sack', 'Crate', 'Chest', 'Coffer'],
        tradeRating: TRADE_RATINGS.VALUABLE
    },

    // --- RESOURCES ---
    'log': { 
        id: 'log', name: 'Log', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Wood', baseValue: 6, weight: 2, description: "A raw, unprocessed log.",
        fixedSize: 0.75, primaryStorage: ['Bundle'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'timber': { 
        id: 'timber', name: 'Timber', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Wood', baseValue: 10, weight: 2, description: "Rough-sawn timber, ready for construction or repairs.",
        fixedSize: 0.5, primaryStorage: ['Bundle'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'wood-fittings': { 
        id: 'wood-fittings', name: 'Wood Fittings', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Wood', baseValue: 8, weight: 1, description: "Precisely shaped wooden parts for ship maintenance.",
        fixedSize: 0.15, primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.COMMON
    },
    'spars': { 
        id: 'spars', name: 'Spars', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Wood', baseValue: 24, weight: 3, description: "Long, sturdy poles of wood for replacing masts and yards.",
        fixedSize: 0.6, primaryStorage: ['Bundle'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'stone': { 
        id: 'stone', name: 'Stone', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Stone', baseValue: 6, weight: 3, description: "Rough, unworked stone.",
        fixedSize: 0.3, primaryStorage: ['Pile'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'stone-block': { 
        id: 'stone-block', name: 'Stone Block', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Stone', baseValue: 12, weight: 3, description: "A block of cut stone, used for fortifications.",
        fixedSize: 1.0, primaryStorage: ['Pile', 'Crate'], cannotOccupy: ['Barrel', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'iron-ore': { 
        id: 'iron-ore', name: 'Iron Ore', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Iron', baseValue: 8, weight: 2, description: "Raw ore containing iron.",
        fixedSize: 0.2, primaryStorage: ['Sack', 'Pile'], cannotOccupy: ['Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'iron-ingot': { 
        id: 'iron-ingot', name: 'Iron Ingot', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Iron', baseValue: 40, weight: 2, description: "A bar of refined iron.",
        fixedSize: 0.1, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'iron-fittings': { 
        id: 'iron-fittings', name: 'Iron Fittings', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Iron', baseValue: 30, weight: 1, description: "Fittings and nails essential for ship integrity.",
        fixedSize: 0.15, primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'copper-ore': { 
        id: 'copper-ore', name: 'Copper Ore', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Copper', baseValue: 12, weight: 2, description: "Raw ore containing copper.",
        fixedSize: 0.2, primaryStorage: ['Sack', 'Pile'], cannotOccupy: ['Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'copper-ingot': { 
        id: 'copper-ingot', name: 'Copper Ingot', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Copper', baseValue: 60, weight: 2, description: "A bar of refined copper.",
        fixedSize: 0.1, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'copper-fittings': { 
        id: 'copper-fittings', name: 'Copper Fittings', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Copper', baseValue: 40, weight: 1, description: "Copper parts, resistant to corrosion from sea water.",
        fixedSize: 0.15, primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'silver-ore': { 
        id: 'silver-ore', name: 'Silver Ore', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Silver', baseValue: 80, weight: 2, description: "Raw ore containing silver.",
        fixedSize: 0.15, primaryStorage: ['Crate', 'Sack'], cannotOccupy: ['Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'silver-bullion': { 
        id: 'silver-bullion', name: 'Silver Bullion', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Silver', baseValue: 400, weight: 2, description: "A bar of pure silver.",
        fixedSize: 0.08, primaryStorage: ['Chest', 'Coffer'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.LUXURY
    },
    'gold-ore': { 
        id: 'gold-ore', name: 'Gold Ore', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Gold', baseValue: 160, weight: 2, description: "Raw ore containing gold.",
        fixedSize: 0.12, primaryStorage: ['Crate', 'Sack'], cannotOccupy: ['Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'gold-bullion': { 
        id: 'gold-bullion', name: 'Gold Bullion', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Gold', baseValue: 800, weight: 2, description: "A bar of pure gold.",
        fixedSize: 0.05, primaryStorage: ['Chest', 'Coffer'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.LUXURY
    },
    'coal': { 
        id: 'coal', name: 'Coal', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Coal', baseValue: 3, weight: 1, description: "A black rock that burns hot, used in forges.",
        fixedSize: 0.25, primaryStorage: ['Sack', 'Pile'], cannotOccupy: ['Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'hemp-raw': { 
        id: 'hemp-raw', name: 'Hemp Raw', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Hemp', baseValue: 4, weight: 1, description: "Raw hemp fibers.",
        fixedSize: 0.6, primaryStorage: ['Bale'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'hemp-rope': { 
        id: 'hemp-rope', name: 'Hemp Rope', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Hemp', baseValue: 8, weight: 1, description: "Strong rope made from hemp, essential for rigging.",
        fixedSize: 0.2, primaryStorage: ['Coil'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.COMMON
    },
    'hemp-canvas': { 
        id: 'hemp-canvas', name: 'Hemp Canvas', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Hemp', baseValue: 20, weight: 1, description: "Durable canvas woven from hemp, for sail repairs.",
        fixedSize: 0.4, primaryStorage: ['Roll'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'cotton-raw': { 
        id: 'cotton-raw', name: 'Cotton Raw', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Cotton', baseValue: 30, weight: 1, description: "Raw cotton bolls.",
        fixedSize: 0.8, primaryStorage: ['Bale'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'cotton-cloth': { 
        id: 'cotton-cloth', name: 'Cotton Cloth', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Cotton', baseValue: 40, weight: 1, description: "Soft cloth woven from cotton.",
        fixedSize: 0.3, primaryStorage: ['Bolt'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'cotton-canvas': { 
        id: 'cotton-canvas', name: 'Cotton Canvas', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Cotton', baseValue: 40, weight: 1, description: "A lighter, less durable canvas than hemp.",
        fixedSize: 0.4, primaryStorage: ['Roll'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'wool-raw': { 
        id: 'wool-raw', name: 'Wool Raw', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Wool', baseValue: 20, weight: 1, description: "Unprocessed sheep's wool.",
        fixedSize: 0.6, primaryStorage: ['Bale'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'wool-cloth': { 
        id: 'wool-cloth', name: 'Wool Cloth', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Wool', baseValue: 40, weight: 1, description: "Warm cloth woven from wool.",
        fixedSize: 0.3, primaryStorage: ['Bolt'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'leather': { 
        id: 'leather', name: 'Leather', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Leather', baseValue: 40, weight: 1, description: "Tanned animal hide.",
        fixedSize: 0.25, primaryStorage: ['Bale'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'fur-pelt': { 
        id: 'fur-pelt', name: 'Fur Pelt', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Fur Pelt', baseValue: 60, weight: 1, description: "An animal pelt with the fur intact, a luxury good.",
        fixedSize: 0.2, primaryStorage: ['Bale'], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.LUXURY
    },
    'diamond': { 
        id: 'diamond', name: 'Diamond', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Gemstone', baseValue: 1000, weight: 0.1, description: "A flawless, expertly cut diamond.",
        fixedSize: 0.001, primaryStorage: ['Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY
    },
    'ruby': { 
        id: 'ruby', name: 'Ruby', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Gemstone', baseValue: 500, weight: 0.1, description: "A deep red gemstone.",
        fixedSize: 0.001, primaryStorage: ['Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY
    },
    'sapphire': { 
        id: 'sapphire', name: 'Sapphire', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Gemstone', baseValue: 400, weight: 0.1, description: "A brilliant blue gemstone.",
        fixedSize: 0.001, primaryStorage: ['Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY
    },
    'emerald': { 
        id: 'emerald', name: 'Emerald', category: ITEM_CATEGORIES.RESOURCE, subcategory: 'Gemstone', baseValue: 600, weight: 0.1, description: "A vibrant green gemstone.",
        fixedSize: 0.001, primaryStorage: ['Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY
    },

    // --- EQUIPMENT ---
    'sextant': { 
        id: 'sextant', name: 'Sextant', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Tools', baseValue: 100, weight: 0.5, description: "An instrument for celestial navigation.",
        fixedSize: 0.02, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'spyglass': { 
        id: 'spyglass', name: 'Spyglass', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Tools', baseValue: 80, weight: 0.5, description: "A collapsible telescope for viewing distant objects.",
        fixedSize: 0.03, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'compass': { 
        id: 'compass', name: 'Compass', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Tools', baseValue: 20, weight: 0.2, description: "A reliable magnetic compass for navigation.",
        fixedSize: 0.01, primaryStorage: ['Chest'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    // Informational
    'nautical-chart': { 
        id: 'nautical-chart', name: 'Nautical Chart', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Informational', baseValue: 5, weight: 0.1, description: "A map of coastlines, depths, and hazards.",
        fixedSize: 0.005, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'nautical-rutter': { 
        id: 'nautical-rutter', name: 'Nautical Rutter', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Informational', baseValue: 40, weight: 0.2, description: "A mariner's handbook with detailed sailing directions.",
        fixedSize: 0.02, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'sword': { 
        id: 'sword', name: 'Sword', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Weapons', baseValue: 20, weight: 1, description: "A cutlass, the favored sidearm of a pirate.",
        fixedSize: 0.04, primaryStorage: ['Chest', 'Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'pistol': { 
        id: 'pistol', name: 'Pistol', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Weapons', baseValue: 30, weight: 0.5, description: "A flintlock pistol, inaccurate but deadly at close range.",
        fixedSize: 0.02, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'musket': { 
        id: 'musket', name: 'Musket', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Weapons', baseValue: 40, weight: 2, description: "A long-barreled firearm, more accurate than a pistol.",
        fixedSize: 0.06, primaryStorage: ['Chest', 'Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    // Cannons
    'cannon': { 
        id: 'cannon', name: 'Cannon', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Cannons', baseValue: 6000, weight: 3.0, description: "A standard naval gun.",
        fixedSize: 3.0, primaryStorage: [], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer', 'Bundle', 'Bale', 'Coil', 'Roll', 'Bolt', 'Pile'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'round-shot': { 
        id: 'round-shot', name: 'Round Shot', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Ammunition', baseValue: 5, weight: 1, description: "Solid iron cannonballs for smashing hulls.",
        fixedSize: 0.015, primaryStorage: ['Crate', 'Pile'], cannotOccupy: [], tradeRating: TRADE_RATINGS.COMMON
    },
    'chain-shot': { 
        id: 'chain-shot', name: 'Chain Shot', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Ammunition', baseValue: 20, weight: 1, description: "Two smaller balls linked by a chain, for shredding sails and rigging.",
        fixedSize: 0.02, primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.COMMON
    },
    'grape-shot': { 
        id: 'grape-shot', name: 'Grape Shot', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Ammunition', baseValue: 8, weight: 1, description: "A canvas bag filled with small iron balls, deadly against crew.",
        fixedSize: 0.02, primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.COMMON
    },
    'canister-shot': { 
        id: 'canister-shot', name: 'Canister Shot', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Ammunition', baseValue: 8, weight: 1, description: "A tin canister that bursts on firing, scattering musket balls.",
        fixedSize: 0.02, primaryStorage: ['Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    // Explosives
    'gunpowder': { 
        id: 'gunpowder', name: 'Gunpowder', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Explosives', baseValue: 60, weight: 1, description: "A volatile black powder used for firearms and cannons.",
        fixedSize: 'Container Size', primaryStorage: ['Barrel'], cannotOccupy: ['Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'lute': { 
        id: 'lute', name: 'Lute', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Entertainment', baseValue: 20, weight: 0.5, description: "A stringed instrument for playing sea shanties.",
        fixedSize: 0.08, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'flute': { 
        id: 'flute', name: 'Flute', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Entertainment', baseValue: 5, weight: 0.2, description: "A simple wooden flute.",
        fixedSize: 0.08, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'fiddle': { 
        id: 'fiddle', name: 'Fiddle', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Entertainment', baseValue: 20, weight: 0.5, description: "A violin, essential for a lively shanty.",
        fixedSize: 0.08, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'accordion': { 
        id: 'accordion', name: 'Accordion', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Entertainment', baseValue: 30, weight: 1, description: "A portable, bellow-driven instrument.",
        fixedSize: 0.08, primaryStorage: ['Chest', 'Crate'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'table': { 
        id: 'table', name: 'Table', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 8, weight: 4, description: "A sturdy wooden table.",
        fixedSize: 0.8, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.COMMON
    },
    'chair': { 
        id: 'chair', name: 'Chair', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 3, weight: 2, description: "A simple wooden chair.",
        fixedSize: 0.3, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.COMMON
    },
    'sofa': { 
        id: 'sofa', name: 'Sofa', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 40, weight: 5, description: "A plush sofa, a true luxury on a ship.",
        fixedSize: 1.2, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'cabinet': { 
        id: 'cabinet', name: 'Cabinet', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 30, weight: 4, description: "A storage cabinet.",
        fixedSize: 0.7, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'desk': { 
        id: 'desk', name: 'Desk', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 30, weight: 3, description: "A captain's writing desk.",
        fixedSize: 0.7, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'drawers': { 
        id: 'drawers', name: 'Drawers', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 20, weight: 3, description: "A chest of drawers.",
        fixedSize: 0.7, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'book-case': { 
        id: 'book-case', name: 'Book Case', category: ITEM_CATEGORIES.EQUIPMENT, subcategory: 'Furnishings', baseValue: 30, weight: 4, description: "A case for holding books and charts.",
        fixedSize: 0.9, primaryStorage: ['Crate'], cannotOccupy: ['Barrel', 'Sack'], tradeRating: TRADE_RATINGS.VALUABLE
    },

    // --- CONTAINERS ---
    'small-barrel': { id: 'small-barrel', name: 'Small Barrel', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Barrel', baseValue: 5, weight: 0.25, description: "A small, sturdy wooden barrel." },
    'medium-barrel': { id: 'medium-barrel', name: 'Medium Barrel', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Barrel', baseValue: 10, weight: 0.5, description: "A medium-sized wooden barrel." },
    'large-barrel': { id: 'large-barrel', name: 'Large Barrel', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Barrel', baseValue: 20, weight: 1, description: "A large wooden barrel." },
    'small-crate': { id: 'small-crate', name: 'Small Crate', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Crate', baseValue: 4, weight: 0.25, description: "A small wooden crate." },
    'medium-crate': { id: 'medium-crate', name: 'Medium Crate', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Crate', baseValue: 8, weight: 0.5, description: "A medium-sized wooden crate." },
    'large-crate': { id: 'large-crate', name: 'Large Crate', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Crate', baseValue: 16, weight: 1, description: "A large wooden crate." },
    'small-sack': { id: 'small-sack', name: 'Small Sack', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Sack', baseValue: 2, weight: 0.25, description: "A small burlap sack." },
    'medium-sack': { id: 'medium-sack', name: 'Medium Sack', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Sack', baseValue: 4, weight: 0.5, description: "A medium-sized burlap sack." },
    'large-sack': { id: 'large-sack', name: 'Large Sack', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Sack', baseValue: 8, weight: 1, description: "A large burlap sack." },
    'small-chest': { id: 'small-chest', name: 'Small Chest', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Chest', baseValue: 20, weight: 0.25, description: "A small, lockable chest." },
    'medium-chest': { id: 'medium-chest', name: 'Medium Chest', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Chest', baseValue: 40, weight: 0.5, description: "A medium-sized, lockable chest." },
    'large-chest': { id: 'large-chest', name: 'Large Chest', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Chest', baseValue: 80, weight: 1, description: "A large, lockable chest." },
    'small-coffer': { id: 'small-coffer', name: 'Small Coffer', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Coffer', baseValue: 50, weight: 0.25, description: "A small, ornate strongbox." },
    'medium-coffer': { id: 'medium-coffer', name: 'Medium Coffer', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Coffer', baseValue: 100, weight: 0.5, description: "A medium-sized, ornate strongbox." },
    'large-coffer': { id: 'large-coffer', name: 'Large Coffer', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Coffer', baseValue: 200, weight: 1, description: "A large, ornate strongbox." },
    'bundle': { id: 'bundle', name: 'Bundle', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Bundle', baseValue: 1, weight: 0, description: "Items bound together." },
    'bale': { id: 'bale', name: 'Bale', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Bale', baseValue: 1, weight: 0, description: "Compressed material bound together." },
    'coil': { id: 'coil', name: 'Coil', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Coil', baseValue: 1, weight: 0, description: "Rope wound into a coil." },
    'roll': { id: 'roll', name: 'Roll', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Roll', baseValue: 1, weight: 0, description: "Fabric rolled up." },
    'bolt': { id: 'bolt', name: 'Bolt', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Bolt', baseValue: 1, weight: 0, description: "A standard length of fabric." },
    'pile': { id: 'pile', name: 'Pile', category: ITEM_CATEGORIES.CONTAINER, subcategory: 'Pile', baseValue: 0, weight: 0, description: "A loose heap of material." },

    // --- COIN ---
    'copper-coin': { 
        id: 'copper-coin', name: 'Copper Coin', category: ITEM_CATEGORIES.COIN, subcategory: 'Coin', baseValue: 0.1, weight: 0.001, description: "A single copper coin.",
        fixedSize: 'Container Size', primaryStorage: ['Chest', 'Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'silver-coin': { 
        id: 'silver-coin', name: 'Silver Coin', category: ITEM_CATEGORIES.COIN, subcategory: 'Coin', baseValue: 1, weight: 0.001, description: "A single silver coin.",
        fixedSize: 'Container Size', primaryStorage: ['Chest', 'Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.VALUABLE
    },
    'gold-coin': { 
        id: 'gold-coin', name: 'Gold Coin', category: ITEM_CATEGORIES.COIN, subcategory: 'Coin', baseValue: 20, weight: 0.001, description: "A single gold coin.",
        fixedSize: 'Container Size', primaryStorage: ['Chest', 'Coffer'], cannotOccupy: [], tradeRating: TRADE_RATINGS.LUXURY
    },

    // --- HUMANS ---
    'civilian': { 
        id: 'civilian', name: 'Civilian', category: ITEM_CATEGORIES.HUMAN, subcategory: 'Human', baseValue: 0, weight: 2, description: "A civilian passenger.",
        fixedSize: 2, primaryStorage: [], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: null 
    },
    'crew': { 
        id: 'crew', name: 'Crew (Human)', category: ITEM_CATEGORIES.HUMAN, subcategory: 'Human', baseValue: 0, weight: 1, description: "A ship's crew member.",
        fixedSize: 1, primaryStorage: [], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: null 
    },
    'soldier': { 
        id: 'soldier', name: 'Soldier', category: ITEM_CATEGORIES.HUMAN, subcategory: 'Human', baseValue: 0, weight: 2, description: "A soldier or marine.",
        fixedSize: 2, primaryStorage: [], cannotOccupy: ['Barrel', 'Crate', 'Sack', 'Chest', 'Coffer'], tradeRating: null 
    },
};

// Make the database accessible globally, for now.
// In a larger application, you might use a module system (e.g., ES6 modules).
window.ITEM_DATABASE = ITEM_DATABASE;
window.ITEM_CATEGORIES = ITEM_CATEGORIES;
window.TRADE_RATINGS = TRADE_RATINGS;