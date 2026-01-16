// src/map/radarOverlay.js

/**
 * Ініціалізація радарних накладань
 * @param {L.Map} map - Мапа
 */
export function initRadar(map) {
    console.log('Initializing radar overlay...');
    
    // Порожня реалізація - можна розширити пізніше
    const radar = {
        // Можна додати радарні шари тут
    };
    
    map._radar = radar;
    console.log('Radar overlay initialized');
    return radar;
}
