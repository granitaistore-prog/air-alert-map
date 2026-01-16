export function initMap() {
    const map = L.map('map', {
        center: [49.0, 31.5],
        zoom: 6,
        minZoom: 5,
        maxZoom: 13,
        zoomControl: false,
        attributionControl: false,
        maxBounds: [
            [44.0, 22.0],
            [53.0, 41.0]
        ],
        maxBoundsViscosity: 1.0
    });

    // Додаємо контрол зумі в праву частину
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Базовий шар
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© Карта України',
        subdomains: 'abcd'
    }).addTo(map);

    // Зберігаємо посилання на шари
    map._layers = {
        base: baseLayer,
        satellite: null,
        terrain: null
    };

    // Додаємо контур України
    const ukraineBounds = L.rectangle([
        [44.0, 22.0],
        [53.0, 41.0]
    ], {
        color: '#2ecc71',
        weight: 2,
        fillOpacity: 0.03,
        fillColor: '#2ecc71'
    }).addTo(map);

    ukraineBounds.bindTooltip('Україна', {
        permanent: false,
        direction: 'center',
        className: 'ukraine-tooltip'
    });

    console.log('Map initialized');
    return map;
}

export function changeBaseLayer(map, layerType) {
    // Видаляємо поточний базовий шар
    if (map._layers.base) {
        map.removeLayer(map._layers.base);
    }

    let newLayer;
    
    switch(layerType) {
        case 'satellite':
            newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri, Maxar, Earthstar Geographics'
            });
            break;
            
        case 'terrain':
            newLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap'
            });
            break;
            
        default: // 'dark'
            newLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© Карта України'
            });
    }

    newLayer.addTo(map);
    map._layers.base = newLayer;
}
