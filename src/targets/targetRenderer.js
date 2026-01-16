export function renderTarget(target, map, targetLayer) {
    // Створюємо кастомну іконку
    const iconHtml = `
        <div style="
            background: ${target.color};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 15px ${target.color};
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            font-weight: bold;
        ">
            ${target.icon}
            <div style="
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
                border: 1px solid ${target.color};
            ">
                ${target.type}
            </div>
        </div>
    `;
    
    const customIcon = L.divIcon({
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
        className: 'target-marker'
    });
    
    // Створюємо маркер
    const marker = L.marker(target.coordinates, {
        icon: customIcon,
        zIndexOffset: 1000
    }).addTo(targetLayer);
    
    // Додаємо popup з інформацією
    const popupContent = `
        <div style="
            min-width: 250px;
            font-family: 'Segoe UI', sans-serif;
        ">
            <div style="
                background: ${target.color};
                color: white;
                padding: 10px;
                border-radius: 5px 5px 0 0;
                margin: -10px -10px 10px -10px;
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <span style="font-size: 20px;">${target.icon}</span>
                <div>
                    <div style="font-weight: bold; font-size: 16px;">${target.type}</div>
                    <div style="font-size: 12px; opacity: 0.9;">ID: ${target.id.substr(-8)}</div>
                </div>
            </div>
            
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 15px;
            ">
                <div>
                    <div style="color: #666; font-size: 12px;">Швидкість</div>
                    <div style="font-weight: bold;">${target.speed} км/год</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px;">Висота</div>
                    <div style="font-weight: bold;">${target.altitude} м</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px;">Напрямок</div>
                    <div style="font-weight: bold;">${target.getDirectionArrow()}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px;">Регіон</div>
                    <div style="font-weight: bold;">${target.region}</div>
                </div>
            </div>
            
            <div style="
                background: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                font-size: 12px;
                color: #666;
            ">
                <div style="margin-bottom: 5px;">🕒 ${new Date(target.timestamp).toLocaleTimeString('uk-UA')}</div>
                <div>Впевненість: ${Math.round(target.confidence * 100)}%</div>
            </div>
            
            <div style="
                margin-top: 15px;
                padding: 8px;
                background: ${target.status === 'active' ? '#ffebee' : '#e8f5e8'};
                border-radius: 5px;
                text-align: center;
                font-weight: bold;
                color: ${target.status === 'active' ? '#c62828' : '#2e7d32'};
            ">
                ${target.status === 'active' ? '⚡ АКТИВНА ЦІЛЬ' : '✅ НЕАКТИВНА'}
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        closeButton: true
    });
    
    return marker;
}

export function updateTargetMarker(target) {
    if (!target.marker) return;
    
    // Оновлюємо позицію
    target.marker.setLatLng(target.coordinates);
    
    // Оновлюємо popup
    const popup = target.marker.getPopup();
    if (popup && popup.isOpen()) {
        // Закриваємо і відкриваємо знову для оновлення контенту
        popup.setContent(createPopupContent(target));
    }
}

export function removeTargetMarker(target, targetLayer) {
    if (target.marker) {
        targetLayer.removeLayer(target.marker);
        target.marker = null;
    }
}

function createPopupContent(target) {
    // Повертаємо HTML для popup (аналогічно renderTarget)
    return `...`; // Той самий HTML, що й вище
}
