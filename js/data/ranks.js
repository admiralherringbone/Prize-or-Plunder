/**
 * Defines the player ranking system.
 * Icons are defined as SVG path strings on a 100x100 grid.
 */
window.RANKS = [
    {
        index: 0,
        id: 'neutral',
        name: "Neutral",
        color: "#ecf0f1", // White
        // Simple Person Icon
        iconPath: [
            "M 50 12 A 18 18 0 1 1 50 48 A 18 18 0 1 1 50 12 Z",
            "M 18 92 Q 18 55 50 55 Q 82 55 82 92 L 82 98 L 18 98 Z"
        ],
        requirements: null
    },
    {
        index: 1,
        id: 'suspected',
        name: "Suspected Pirate",
        color: "#ecf0f1",
        // Simple Skull
        iconPath: [
            "M 50 15 C 30 15 15 30 15 50 C 15 65 25 75 35 75 Q 38.75 82 42.5 75 Q 46.25 82 50 75 Q 53.75 82 57.5 75 Q 61.25 82 65 75 C 75 75 85 65 85 50 C 85 30 70 15 50 15 Z M 35 45 A 8 8 0 1 1 35 61 A 8 8 0 1 1 35 45 Z M 65 45 A 8 8 0 1 1 65 61 A 8 8 0 1 1 65 45 Z M 49 55 L 49 63 L 47 63 Z M 51 55 L 53 63 L 51 63 Z",
            "M 35 82 Q 50 97 65 82 Q 61.25 75 57.5 82 Q 53.75 75 50 82 Q 46.25 75 42.5 82 Q 38.75 75 35 82"
        ],
        requirements: {
            combat: true // Any combat engagement
        }
    },
    {
        index: 2,
        id: 'petty',
        name: "Petty Pirate",
        color: "#ecf0f1",
        // Skull with single, thicker knobby bone beneath
        iconPath: [
            "M 30 87 L 70 87 C 75 87 75 82 80 82 C 86 82 86 90 82 92 C 86 94 86 102 80 102 C 75 102 75 97 70 97 L 30 97 C 25 97 25 102 20 102 C 14 102 14 94 18 92 C 14 90 14 82 20 82 C 25 82 25 87 30 87 Z",
            "M 50 10 C 30 10 15 25 15 45 C 15 60 25 70 35 75 Q 38.75 82 42.5 75 Q 46.25 82 50 75 Q 53.75 82 57.5 75 Q 61.25 82 65 75 C 75 70 85 60 85 45 C 85 25 70 10 50 10 Z M 35 40 A 8 8 0 1 1 35 56 A 8 8 0 1 1 35 40 Z M 65 40 A 8 8 0 1 1 65 56 A 8 8 0 1 1 65 40 Z M 49 50 L 49 58 L 47 58 Z M 51 50 L 53 58 L 51 58 Z",
            "M 35 82 Q 50 97 65 82 Q 61.25 75 57.5 82 Q 53.75 75 50 82 Q 46.25 75 42.5 82 Q 38.75 75 35 82"
        ],
        requirements: {
            sunk: 1,
            boarded: 1
        }
    },
    {
        index: 3,
        id: 'known',
        name: "Known Pirate",
        color: "#ecf0f1",
        // Skull with thicker knobby crossed bones
        iconPath: [
            "M 24 16 L 84 76 C 89 71 96 71 98 76 C 100 80 96 84 92 86 C 96 88 100 92 98 96 C 96 100 89 100 76 84 L 16 24 C 11 29 4 29 2 24 C 0 20 4 16 8 14 C 4 12 0 8 2 4 C 4 0 11 0 24 16 Z M 76 16 L 16 76 C 11 71 4 71 2 76 C 0 80 4 84 8 86 C 4 88 0 92 2 96 C 4 100 11 100 24 84 L 84 24 C 89 29 96 29 98 24 C 100 20 96 16 92 14 C 96 12 100 8 98 4 C 96 0 89 0 76 16 Z",
            "M 50 10 C 30 10 15 25 15 45 C 15 60 25 70 35 75 Q 38.75 82 42.5 75 Q 46.25 82 50 75 Q 53.75 82 57.5 75 Q 61.25 82 65 75 C 75 70 85 60 85 45 C 85 25 70 10 50 10 Z M 35 40 A 8 8 0 1 1 35 56 A 8 8 0 1 1 35 40 Z M 65 40 A 8 8 0 1 1 65 56 A 8 8 0 1 1 65 40 Z M 47 50 Q 42 55 47 60 Q 46 55 47 50 Z M 53 50 Q 58 55 53 60 Q 54 55 53 50 Z",
            "M 35 82 Q 50 97 65 82 Q 61.25 75 57.5 82 Q 53.75 75 50 82 Q 46.25 75 42.5 82 Q 38.75 75 35 82"
        ],
        requirements: {
            sunk: 10,
            boarded: 10
        }
    },
    {
        index: 4,
        id: 'notorious',
        name: "Notorious Pirate",
        color: "#ecf0f1",
        // Hooded Skull (Grim Reaper)
        iconPath: [
            "M 50 0 C 70 10 95 40 95 70 L 95 98 L 5 98 L 5 70 C 5 40 30 10 50 0 Z M 50 15 C 32 15 22 40 22 65 C 22 85 35 92 50 92 C 65 92 78 85 78 65 C 78 40 68 15 50 15 Z",
            "M 50 25 C 63 25 66 38 66 52 C 66 62 62 68 58 72 L 58 82 Q 50 88 42 82 L 42 72 C 38 68 34 62 34 52 C 34 38 37 25 50 25 Z M 43 48 A 4 4 0 1 0 43 56 A 4 4 0 1 0 43 48 Z M 57 48 A 4 4 0 1 0 57 56 A 4 4 0 1 0 57 48 Z M 50 60 L 47 66 L 53 66 Z"
        ],
        requirements: {
            sunk: 100,
            boarded: 100
        }
    },
    {
        index: 5,
        id: 'enemy',
        name: "Enemy of All Mankind",
        color: "#e74c3c", // Crimson
        // Horned Devil Skull
        iconPath: [
            "M 50 25 L 30 25 Q 15 20 5 5 Q 0 25 25 45 C 15 55 25 75 35 75 Q 38.75 82 42.5 75 Q 46.25 82 50 75 Q 53.75 82 57.5 75 Q 61.25 82 65 75 C 75 75 85 55 75 45 Q 100 25 95 5 Q 85 20 70 25 L 50 25 Z M 30 52 L 40 58 A 6 6 0 1 1 30 52 Z M 60 58 L 70 52 A 6 6 0 1 1 60 58 Z M 49 60 L 49 68 L 47 68 Z M 51 60 L 53 68 L 51 68 Z",
            "M 35 82 Q 50 97 65 82 Q 61.25 75 57.5 82 Q 53.75 75 50 82 Q 46.25 75 42.5 82 Q 38.75 75 35 82"
        ],
        requirements: {
            sunk: 1000,
            boarded: 1000
        }
    }
];