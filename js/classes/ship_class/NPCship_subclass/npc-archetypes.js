/**
 * Defines the high-level archetypes for procedurally generating NPC ships.
 * The game's spawning logic will use these rules to create a unique blueprint for each NPC.
 */
const NPC_ARCHETYPES = {
    merchant: [
        {
            name: 'Merchant Sloop',
            weight: 3,
            buildType: 'cargo',
            sizeRange: { min: 9, max: 18 },
            gunBias: 'low',
            deckOptions: [{ count: 1, weight: 1 }],
            beamBias: 'wide',
            draughtBias: 'average',
            rigOptions: [
                { type: 'sloop', weight: 1 },
                { type: 'fore-and-aft-sloop', weight: 1 }
            ],
            deckLayoutOptions: [{ type: 'standard', weight: 1 }],
            superstructureLayers: [
                [
                    { parts: [], weight: 1 }, // None
                    { parts: ['aftercastle'], weight: 1 }
                ]
            ]
        },
        {
            name: 'Merchant Brig',
            weight: 5,
            buildType: 'cargo',
            sizeRange: { min: 18, max: 27 },
            gunBias: 'low',
            deckOptions: [{ count: 1, weight: 1 }],
            beamBias: 'wide',
            draughtBias: 'average',
            rigOptions: [
                { type: 'brig', weight: 1 },
                { type: 'brigantine', weight: 1 }
            ],
            deckLayoutOptions: [
                { type: 'standard', weight: 1 },
                { type: 'cargo', weight: 1 }
            ],
            superstructureLayers: [
                [
                    { parts: [], weight: 1 }, // None
                    { parts: ['forecastle', 'aftercastle'], weight: 1 }
                ]
            ]
        },
        {
            name: 'Merchantman',
            weight: 5,
            buildType: 'cargo',
            sizeRange: { min: 30, max: 45 },
            gunBias: 'low',
            deckOptions: [
                { count: 1, weight: 1 },
                { count: 2, deckTypes: { 0: 'cargo' }, weight: 1 }
            ],
            beamBias: 'wide',
            draughtBias: 'average',
            rigOptions: [
                { type: 'full-rigged', weight: 60 },
                { type: 'barque', weight: 30 },
                { type: 'barquentine', weight: 10 }
            ],
            deckLayoutOptions: [
                { type: 'standard', weight: 1 },
                { type: 'cargo', weight: 1 }
            ],
            superstructureLayers: [
                [
                    { parts: ['forecastle', 'aftercastle'], weight: 50 },
                    { parts: ['spardeck'], weight: 50 }
                ],
                [
                    { parts: [], weight: 90 }, // No sterncastle
                    { parts: ['sterncastle'], weight: 10 }
                ]
            ]
        },
        {
            name: 'Grand Merchantman',
            weight: 1,
            buildType: 'cargo',
            sizeRange: { min: 42, max: 54 },
            gunBias: 'low',
            deckOptions: [
                { count: 2, deckTypes: { 0: 'cargo' }, weight: 1 },
                { count: 3, deckTypes: { 0: 'cargo', 1: 'gun' }, weight: 1 },
                { count: 3, deckTypes: { 0: 'cargo', 1: 'cargo' }, weight: 1 }
            ],
            beamBias: 'wide',
            draughtBias: 'average',
            rigOptions: [
                { type: 'full-rigged', weight: 90 },
                { type: 'barque', weight: 8 },
                { type: 'barquentine', weight: 2 }
            ],
            deckLayoutOptions: [
                { type: 'standard', weight: 1 },
                { type: 'cargo', weight: 1 }
            ],
            superstructureLayers: [
                [
                    { parts: ['forecastle', 'aftercastle'], weight: 50 },
                    { parts: ['spardeck'], weight: 50 }
                ],
                [
                    { parts: [], weight: 20 }, // No sterncastle
                    { parts: ['sterncastle'], weight: 80 }
                ]
            ]
        }
    ],
    navy: [
        {
            name: 'Naval Cutter',
            weight: 3,
            buildType: 'guns',
            sizeRange: { min: 3, max: 6 },
            deckOptions: [{ count: 1, weight: 1 }],
            beamBias: 'average',
            draughtBias: 'strong_average',
            rigOptions: [
                { type: 'sloop', weight: 1 },
                { type: 'fore-and-aft-sloop', weight: 1 }
            ],
            deckLayoutOptions: [{ type: 'standard', weight: 1 }],
            superstructureLayers: [
                [{ parts: [], weight: 1 }] // None
            ]
        },
        {
            name: 'Corvette',
            weight: 5,
            buildType: 'guns',
            sizeRange: { min: 6, max: 9 },
            deckOptions: [{ count: 1, weight: 1 }],
            beamBias: 'average',
            draughtBias: 'strong_average',
            rigOptions: [
                { type: 'brig', weight: 1 },
                { type: 'full-rigged', weight: 1 }
            ],
            deckLayoutOptions: [{ type: 'standard', weight: 1 }],
            superstructureLayers: [
                [{ parts: [], weight: 1 }] // None
            ]
        },
        {
            name: 'Frigate',
            weight: 5,
            buildType: 'guns',
            sizeRange: { min: 10, max: 15 },
            deckOptions: [{ count: 1, weight: 1 }],
            beamBias: 'narrow',
            draughtBias: 'strong_average',
            rigOptions: [{ type: 'full-rigged', weight: 1 }],
            deckLayoutOptions: [{ type: 'standard', weight: 1 }],
            superstructureLayers: [
                [
                    { parts: ['forecastle', 'aftercastle'], weight: 50 },
                    { parts: ['spardeck'], weight: 50 }
                ],
                [
                    { parts: [], weight: 90 }, // No sterncastle
                    { parts: ['sterncastle'], weight: 10 }
                ]
            ]
        },
        {
            name: '2-Decker Ship of the Line',
            weight: 1,
            buildType: 'guns',
            sizeRange: { min: 10, max: 15 },
            deckOptions: [{ count: 2, deckTypes: { 0: 'gun' }, weight: 1 }],
            beamBias: 'strong_average',
            draughtBias: 'strong_average',
            rigOptions: [{ type: 'full-rigged', weight: 1 }],
            deckLayoutOptions: [{ type: 'standard', weight: 1 }],
            superstructureLayers: [
                [
                    { parts: ['forecastle', 'aftercastle'], weight: 50 },
                    { parts: ['spardeck'], weight: 50 }
                ],
                [
                    { parts: [], weight: 20 }, // No sterncastle
                    { parts: ['sterncastle'], weight: 80 }
                ]
            ]
        },
        {
            name: '3-Decker Ship of the Line',
            weight: 1,
            buildType: 'guns',
            sizeRange: { min: 14, max: 18 },
            deckOptions: [{ count: 3, deckTypes: { 0: 'gun', 1: 'gun' }, weight: 1 }],
            beamBias: 'strong_average',
            draughtBias: 'strong_average',
            rigOptions: [{ type: 'full-rigged', weight: 1 }],
            deckLayoutOptions: [{ type: 'standard', weight: 1 }],
            superstructureLayers: [
                [
                    { parts: ['forecastle', 'aftercastle'], weight: 50 },
                    { parts: ['spardeck'], weight: 50 }
                ],
                [
                    { parts: [], weight: 20 }, // No sterncastle
                    { parts: ['sterncastle'], weight: 80 }
                ]
            ]
        }
    ]
};