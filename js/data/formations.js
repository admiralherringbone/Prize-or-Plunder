/**
 * Defines the relative positions for ships in a fleet formation.
 * Offsets are relative to the flagship (Player).
 * x: Forward/Backward (Negative is behind)
 * y: Left/Right (Positive is Starboard/Right)
 */
const FLEET_FORMATIONS = {
    'line_astern': {
        name: "Line Astern",
        description: "Ships follow in a single line behind the flagship.",
        offsets: [
            { x: -2.5, y: 0 }, // 2.5 ship lengths behind
            { x: -5.0, y: 0 },
            { x: -7.5, y: 0 },
            { x: -10.0, y: 0 }
        ]
    },
    'echelon_right': {
        name: "Echelon Right",
        description: "Ships form a diagonal line to the rear-right.",
        offsets: [
            { x: -2.0, y: 2.0 }, // Behind and right
            { x: -4.0, y: 4.0 },
            { x: -6.0, y: 6.0 },
            { x: -8.0, y: 8.0 }
        ]
    },
    'echelon_left': {
        name: "Echelon Left",
        description: "Ships form a diagonal line to the rear-left.",
        offsets: [
            { x: -2.0, y: -2.0 }, // Behind and left
            { x: -4.0, y: -4.0 },
            { x: -6.0, y: -6.0 },
            { x: -8.0, y: -8.0 }
        ]
    },
    'line_abreast': {
        name: "Line Abreast",
        description: "Ships form a horizontal line alongside the flagship.",
        offsets: [
            { x: 0, y: 3.0 }, // Right
            { x: 0, y: -3.0 }, // Left
            { x: 0, y: 6.0 }, // Far Right
            { x: 0, y: -6.0 } // Far Left
        ]
    }
};