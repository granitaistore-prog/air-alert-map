export function initLayers(map) {
    // Додаємо шари областей
    const regionsLayer = L.layerGroup().addTo(map);
    
    const regions = {
        "Київська": [50.45, 30.52],
        "Харківська": [49.99, 36.23],
        "Одеська": [46.48, 30.73],
        "Львівська": [49.84, 24.03],
        "Дніпропетровська": [48.45, 35.05]
    };

    Object.entries(regions).forEach(([name, coords]) => {
        L.circleMarker(coords, {
            color: '#3498db',
            fillColor: '#1a5276',
            fillOpacity: 0.7,
            radius: 8
        })
        .addTo(regionsLayer)
        .bindTooltip(name, { permanent: false });
    });

    // Додаємо шар великих міст
    const citiesLayer = L.layerGroup().addTo(map);
    
    const cities = [
        { name: "Київ", coords: [50.45, 30.52], size: 12 },
        { name: "Харків", coords: [49.99, 36.23], size: 10 },
        { name: "Одеса", coords: [46.48, 30.73], size: 10 },
        { name: "Дніпро", coords: [48.45, 35.05], size: 9 },
        { name: "Львів", coords: [49.84, 24.03], size: 9 }
    ];

    cities.forEach(city => {
        L.circleMarker(city.coords, {
            color: '#e74c3c',
            fillColor: '#c0392b',
            fillOpacity: 0.8,
            radius: city.size
        })
        .addTo(citiesLayer)
        .bindTooltip(`<b>${city.name}</b>`, { 
            permanent: false,
            direction: 'top'
        });
    });

    // Зберігаємо шари для подальшого управління
    map._customLayers = {
        regions: regionsLayer,
        cities: citiesLayer
    };

    console.log('Map layers initialized');
}
