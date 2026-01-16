// src/svitlo/regions.js
export const SVITLO_REGIONS = {
    'kharkivska': {
        name: 'Харківська область',
        coordinates: [49.99, 36.23],
        queues: ['queue1', 'queue2', 'queue3']
    },
    'kyivska': {
        name: 'Київська область',
        coordinates: [50.45, 30.52],
        queues: ['queue1', 'queue2']
    },
    // Додайте інші регіони за необхідності
};

export function getRegionConfig(regionKey) {
    return SVITLO_REGIONS[regionKey] || {
        name: regionKey,
        coordinates: [49.0, 31.5],
        queues: ['queue1']
    };
}
