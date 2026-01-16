export function initRadar(map) {
    // Створюємо радіолокаційний ефект
    const radarLayer = L.layerGroup().addTo(map);
    
    // Центр радару
    const radarCenter = [49.0, 31.5];
    
    // Створюємо анімоване коло радару
    const radarCircle = L.circle(radarCenter, {
        color: '#2ecc71',
        fillColor: '#2ecc71',
        fillOpacity: 0.05,
        radius: 500000 // 500 км
    }).addTo(radarLayer);
    
    // Лінія сканування
    const scanLine = L.polyline([], {
        color: '#2ecc71',
        weight: 2,
        dashArray: '10, 10',
        opacity: 0.7
    }).addTo(radarLayer);
    
    // Анімація радару
    let angle = 0;
    const radarAnimation = () => {
        // Оновлюємо лінію сканування
        const endLat = radarCenter[0] + Math.cos(angle) * 0.5;
        const endLng = radarCenter[1] + Math.sin(angle) * 0.8;
        
        scanLine.setLatLngs([
            radarCenter,
            [endLat, endLng]
        ]);
        
        // Пульсація кола
        const pulseOpacity = 0.05 + Math.sin(Date.now() / 1000) * 0.02;
        radarCircle.setStyle({ fillOpacity: pulseOpacity });
        
        angle += 0.05;
        if (angle > Math.PI * 2) angle = 0;
    };
    
    // Запускаємо анімацію
    const animationInterval = setInterval(radarAnimation, 50);
    
    // Зберігаємо для можливості зупинки
    map._radar = {
        layer: radarLayer,
        animationInterval: animationInterval
    };
    
    console.log('Radar overlay initialized');
}

export function stopRadar(map) {
    if (map._radar && map._radar.animationInterval) {
        clearInterval(map._radar.animationInterval);
        map.removeLayer(map._radar.layer);
        console.log('Radar stopped');
    }
}
