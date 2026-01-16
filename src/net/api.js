// Конфігурація API
const API_CONFIG = {
    // Основне API (з вашого neptun репозиторію)
    PRIMARY: {
        STATES_URL: 'https://alerts.com.ua/api/states',
        HISTORY_URL: 'https://alerts.com.ua/api/history'
    },
    
    // Альтернативне API
    ALTERNATIVE: {
        STATES_URL: 'https://ubilling.net.ua/alerts/?states',
        HISTORY_URL: 'https://ubilling.net.ua/alerts/?history'
    },
    
    // Резервне API
    BACKUP: {
        STATES_URL: 'https://api.ukrainealarm.com/api/v3/alerts',
        HISTORY_URL: 'https://api.ukrainealarm.com/api/v3/alerts/history'
    }
};

// Виберіть активне API
const ACTIVE_API = API_CONFIG.PRIMARY;

// Мок-дані для тестування
export function getMockTargets(count = 3) {
    const targetTypes = [
        { type: 'Shahed-136', speed: 180, altitude: 800, icon: '🛸', color: '#e74c3c' },
        { type: 'Крилата ракета', speed: 900, altitude: 1500, icon: '🚀', color: '#9b59b6' },
        { type: 'БПЛА Орлан', speed: 90, altitude: 500, icon: '📡', color: '#3498db' },
        { type: 'Тактична ракета', speed: 1200, altitude: 3000, icon: '💥', color: '#f39c12' }
    ];
    
    const regions = [
        'Київська область', 'Харківська область', 'Одеська область',
        'Львівська область', 'Дніпропетровська область', 'Запорізька область',
        'Вінницька область', 'Житомирська область', 'Донецька область',
        'Чернігівська область', 'Миколаївська область'
    ];
    
    const targets = [];
    
    for (let i = 0; i < count; i++) {
        const type = targetTypes[Math.floor(Math.random() * targetTypes.length)];
        const region = regions[Math.floor(Math.random() * regions.length)];
        
        // Генеруємо координати в межах України
        const lat = 48.0 + Math.random() * 5.0;
        const lng = 23.0 + Math.random() * 16.0;
        
        targets.push({
            id: `mock_${Date.now()}_${i}`,
            type: type.type,
            name: `${type.type} в ${region}`,
            coordinates: [lat, lng],
            speed: type.speed + Math.random() * 50 - 25,
            altitude: type.altitude + Math.random() * 200 - 100,
            direction: Math.random() * 360,
            region: region,
            distance: Math.floor(Math.random() * 200) + 50,
            timestamp: new Date().toISOString(),
            status: 'active',
            confidence: 0.7 + Math.random() * 0.3,
            icon: type.icon,
            color: type.color,
            vector: {
                dx: (Math.random() - 0.5) * 0.02,
                dy: (Math.random() - 0.5) * 0.02
            },
            isSimulated: true
        });
    }
    
    return targets;
}

// Отримання реальних даних про тривоги
export async function fetchRealAlerts() {
    try {
        console.log(`Fetching alerts from: ${ACTIVE_API.STATES_URL}`);
        
        const response = await fetch(ACTIVE_API.STATES_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'User-Agent': 'AirAlertMap/1.0'
            },
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log(`API response: ${data.states?.length || 0} regions`);
        
        // Додаємо timestamp відповіді
        data.api_timestamp = new Date().toISOString();
        data.api_source = ACTIVE_API.STATES_URL;
        
        return data;
        
    } catch (error) {
        console.error('Failed to fetch real alerts:', error);
        
        // Спроба альтернативного API
        if (ACTIVE_API !== API_CONFIG.ALTERNATIVE) {
            console.log('Trying alternative API...');
            const backupApi = { ...API_CONFIG.ALTERNATIVE, STATES_URL: API_CONFIG.ALTERNATIVE.STATES_URL };
            return fetchFromBackup(backupApi);
        }
        
        throw error;
    }
}

// Резервне завантаження
async function fetchFromBackup(apiConfig) {
    try {
        const response = await fetch(apiConfig.STATES_URL, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            data.api_timestamp = new Date().toISOString();
            data.api_source = apiConfig.STATES_URL;
            data.is_backup = true;
            return data;
        }
    } catch (backupError) {
        console.error('Backup API also failed:', backupError);
        throw backupError;
    }
}

// Отримання історії тривог
export async function fetchRegionsHistory(regionId = null, hours = 24) {
    try {
        let url = ACTIVE_API.HISTORY_URL;
        if (regionId) {
            url += `?region=${regionId}&hours=${hours}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Failed to fetch history:', error);
        return { error: error.message, history: [] };
    }
}

// Конвертація даних API у формат цілей
export function convertAlertsToTargets(alertsData) {
    if (!alertsData || !alertsData.states) {
        return [];
    }
    
    const targets = [];
    const regionCoordinates = getRegionCoordinatesMap();
    
    alertsData.states.forEach(region => {
        if (region.alert === true || region.alert === 1) {
            const coords = regionCoordinates[region.name] || [49.0, 31.5];
            
            targets.push({
                id: `alert_${region.id || region.name.replace(/\s+/g, '_')}`,
                type: 'air_alert',
                name: `Повітряна тривога: ${region.name}`,
                coordinates: coords,
                region: region.name,
                status: 'active',
                timestamp: region.changed || new Date().toISOString(),
                confidence: 0.95,
                icon: '⚠️',
                color: '#e74c3c',
                isRegionAlert: true,
                alertStart: region.changed,
                apiSource: alertsData.api_source
            });
        }
    });
    
    return targets;
}

// Мапа координат областей
function getRegionCoordinatesMap() {
    return {
        'Вінницька область': [49.23, 28.48],
        'Волинська область': [50.75, 25.34],
        'Дніпропетровська область': [48.45, 35.05],
        'Донецька область': [48.02, 37.80],
        'Житомирська область': [50.25, 28.66],
        'Закарпатська область': [48.62, 22.29],
        'Запорізька область': [47.84, 35.14],
        'Івано-Франківська область': [48.92, 24.71],
        'Київська область': [50.45, 30.52],
        'Кіровоградська область': [48.51, 32.26],
        'Луганська область': [48.57, 39.30],
        'Львівська область': [49.84, 24.03],
        'Миколаївська область': [46.98, 31.99],
        'Одеська область': [46.48, 30.73],
        'Полтавська область': [49.59, 34.55],
        'Рівненська область': [50.62, 26.25],
        'Сумська область': [50.91, 34.80],
        'Тернопільська область': [49.55, 25.59],
        'Харківська область': [49.99, 36.23],
        'Херсонська область': [46.64, 32.62],
        'Хмельницька область': [49.42, 26.99],
        'Черкаська область': [49.44, 32.06],
        'Чернівецька область': [48.29, 25.94],
        'Чернігівська область': [51.50, 31.30],
        'м.Київ': [50.45, 30.52],
        'АР Крим': [45.04, 34.00],
        'Автономна Республіка Крим': [45.04, 34.00]
    };
}

// Функція для запуску регулярних оновлень
export function startRealDataUpdates(callback, interval = 30000) {
    console.log(`Starting real data updates every ${interval/1000} seconds`);
    
    let isRunning = true;
    let errorCount = 0;
    const maxErrors = 3;
    
    const updateData = async () => {
        if (!isRunning) return;
        
        try {
            const alertsData = await fetchRealAlerts();
            callback(alertsData);
            errorCount = 0; // Скидаємо лічильник помилок при успіху
            
        } catch (error) {
            errorCount++;
            console.error(`Update error ${errorCount}/${maxErrors}:`, error);
            
            if (errorCount >= maxErrors) {
                console.error('Too many errors, stopping updates');
                stopUpdates();
                callback({ 
                    error: 'Update stopped due to consecutive errors',
                    states: [] 
                });
            }
        }
    };
    
    // Перше оновлення
    updateData();
    
    // Запускаємо інтервал
    const intervalId = setInterval(updateData, interval);
    
    const stopUpdates = () => {
        isRunning = false;
        clearInterval(intervalId);
        console.log('Real data updates stopped');
    };
    
    return stopUpdates;
}

// Імітація WebSocket з'єднання (для тестування)
export function simulateWebSocket(callback) {
    console.log('WebSocket simulation started');
    
    let isConnected = true;
    let messageCount = 0;
    
    const interval = setInterval(() => {
        if (!isConnected) {
            clearInterval(interval);
            return;
        }
        
        messageCount++;
        
        // Випадково генеруємо оновлення
        if (Math.random() > 0.3) {
            const targetCount = Math.floor(Math.random() * 3) + 1;
            const targets = getMockTargets(targetCount);
            
            callback({
                type: 'target_update',
                timestamp: new Date().toISOString(),
                targets: targets,
                messageId: messageCount
            });
        }
        
        // Імітація зміни статусу
        if (Math.random() > 0.95) {
            isConnected = false;
            callback({
                type: 'connection_status',
                status: 'disconnected',
                timestamp: new Date().toISOString()
            });
            
            setTimeout(() => {
                isConnected = true;
                callback({
                    type: 'connection_status',
                    status: 'connected',
                    timestamp: new Date().toISOString()
                });
            }, 5000);
        }
        
    }, 3000 + Math.random() * 4000);
    
    return () => {
        clearInterval(interval);
        console.log('WebSocket simulation stopped');
    };
}

// Статистика API
export function getApiStats() {
    return {
        active_api: ACTIVE_API.STATES_URL,
        available_apis: Object.keys(API_CONFIG),
        config: API_CONFIG
    };
}
