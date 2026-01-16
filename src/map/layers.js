// src/map/layers.js

/**
 * Ініціалізація шарів мапи
 * @param {L.Map} map - Мапа
 */
export function initLayers(map) {
    console.log('Initializing layers...');
    
    // Створюємо об'єкт для зберігання шарів
    const layers = {
        // Радарні дані (приклад)
        radar: L.tileLayer('https://tilecache.rainviewer.com/v2/radar/{time}/{z}/{x}/{y}/6/0_0.png', {
            opacity: 0.6,
            attribution: '© RainViewer'
        }),
        
        // Шар кордонів
        borders: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?borders=1', {
            opacity: 0.2,
            attribution: '© OpenStreetMap'
        })
    };
    
    // Зберігаємо посилання на шари
    map._layers = layers;
    
    // Вмикаємо шари за замовчуванням
    // layers.borders.addTo(map);
    
    console.log('Layers initialized');
    return layers;
}

/**
 * Перемкнути шар
 * @param {L.Map} map - Мапа
 * @param {string} layerName - Назва шару
 * @param {boolean} visible - Видимість
 */
export function toggleLayer(map, layerName, visible = true) {
    if (!map._layers || !map._layers[layerName]) {
        console.warn(`Layer "${layerName}" not found`);
        return false;
    }
    
    const layer = map._layers[layerName];
    
    if (visible && !map.hasLayer(layer)) {
        map.addLayer(layer);
        console.log(`Layer "${layerName}" enabled`);
        return true;
    } 
    
    if (!visible && map.hasLayer(layer)) {
        map.removeLayer(layer);
        console.log(`Layer "${layerName}" disabled`);
        return true;
    }
    
    return false;
}
