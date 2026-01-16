// src/map/mapInit.js

/**
 * Ініціалізація Leaflet мапи
 * @returns {L.Map} Ініціалізована мапа
 */
export function initMap() {
    console.log('Initializing map...');
    
    // Створюємо мапу
    const map = L.map('map', {
        center: [49.0, 31.5], // Центр України
        zoom: 6,
        minZoom: 5,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
        maxBounds: [
            [43.0, 22.0], // Південно-західний кут
            [53.0, 41.0]  // Північно-східний кут
        ],
        maxBoundsViscosity: 1.0 // Строго обмежуємо рух
    });

    // Додаємо базовий шар (темна мапа)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Додаємо кастомний контрол збільшення
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Кастомна атрибуція
    L.control.attribution({
        position: 'bottomleft',
        prefix: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Масштабна лінійка
    L.control.scale({
        imperial: false,
        metric: true,
        position: 'bottomright'
    }).addTo(map);

    console.log('Map initialized successfully');
    return map;
}

/**
 * Змінити базовий шар мапи
 * @param {L.Map} map - Мапа
 * @param {string} layerId - ID шару (dark, satellite, terrain)
 */
export function changeBaseLayer(map, layerId) {
    console.log(`Changing base layer to: ${layerId}`);
    
    // Видаляємо всі існуючі шари
    map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    let newLayer;
    
    switch(layerId) {
        case 'satellite':
            newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri, Maxar, Earthstar Geographics',
                maxZoom: 19
            });
            break;
            
        case 'terrain':
            newLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors, SRTM',
                maxZoom: 17
            });
            break;
            
        case 'dark':
        default:
            newLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap, © CartoDB',
                subdomains: 'abcd',
                maxZoom: 19
            });
            break;
    }

    newLayer.addTo(map);
    localStorage.setItem('map-layer', layerId);
    
    return newLayer;
}
