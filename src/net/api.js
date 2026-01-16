// Конфігурація всіх API з neptun репозиторію
const ALL_APIS = {
    // API з репозиторію and3rson/raid (офіційне та локальне)
    ALERTS_COM_UA_OFFICIAL: {
        name: 'Alerts.com.ua (Official API)',
        states: 'https://alerts.com.ua/api/states',
        history: 'https://alerts.com.ua/api/history',
        regions: 'https://alerts.com.ua/api/regions',
        active: true,
        priority: 1, // Найвищий пріоритет
        headers: {
            'X-API-Key': 'demo_key' // 👈 Замініть на ваш ключ
        }
    },
    
    // Локальна версія API (для тестування)
    ALERTS_COM_UA_LOCAL: {
        name: 'Alerts.com.ua (Local)',
        states: 'http://127.0.0.1:10101/api/states',
        history: 'http://127.0.0.1:10101/api/history',
        regions: 'http://127.0.0.1:10101/api/regions',
        active: false, // Увімкніть для локального тесту
        priority: 7,
        headers: {
            'X-API-Key': 'foo' // Тестовий ключ для локального сервера
        }
    },
    
    // Основне API (з neptun/server/neptun.py)
    ALERTS_COM_UA: {
        name: 'Alerts.com.ua',
        states: 'https://alerts.com.ua/api/states',
        history: 'https://alerts.com.ua/api/history',
        regions: 'https://alerts.com.ua/api/regions',
        active: true,
        priority: 2
    },
    
    // Альтернативне API (з neptun/server/data.py)
    UBILLING: {
        name: 'Ubilling.net.ua',
        states: 'https://ubilling.net.ua/alerts/?states',
        history: 'https://ubilling.net.ua/alerts/?history',
        active: true,
        priority: 3
    },
    
    // Резервне API 1
    UKRAINE_ALARM: {
        name: 'UkraineAlarm.com',
        states: 'https://api.ukrainealarm.com/api/v3/alerts',
        history: 'https://api.ukrainealarm.com/api/v3/alerts/history',
        active: true,
        priority: 4,
        headers: {
            'Authorization': 'Bearer public'
        }
    },
    
    // Резервне API 2
    ALERTS_IN_UA: {
        name: 'Alerts.in.ua',
        states: 'https://alerts.in.ua/api/v1/alerts/active',
        history: 'https://alerts.in.ua/api/v1/alerts/history',
        active: true,
        priority: 5
    },
    
    // Резервне API 3 (з neptun)
    SIREN: {
        name: 'Siren API',
        states: 'https://siren.org.ua/api/alerts',
        regions: 'https://siren.org.ua/api/regions',
        active: true,
        priority: 6
    },
    
    // Локалізоване API
    LOCAL_ALERTS: {
        name: 'Локальне API',
        states: 'http://localhost:8000/api/alerts',
        active: false, // Для локального тестування
        priority: 8
    }
};

// API для метеорологічних даних (додатково)
const WEATHER_APIS = {
    OPENWEATHER: {
        name: 'OpenWeatherMap',
        current: 'https://api.openweathermap.org/data/2.5/weather',
        forecast: 'https://api.openweathermap.org/data/2.5/forecast',
        apiKey: 'ваш_ключ_тут' // Потрібно отримати на openweathermap.org
    },
    
    WEATHER_API: {
        name: 'WeatherAPI.com',
        current: 'https://api.weatherapi.com/v1/current.json',
        forecast: 'https://api.weatherapi.com/v1/forecast.json',
        apiKey: 'ваш_ключ_тут' // Потрібно отримати на weatherapi.com
    }
};

// API для інформації про польоти (додатково)
const FLIGHT_APIS = {
    ADS_B: {
        name: 'ADS-B Exchange',
        flights: 'https://opensky-network.org/api/states/all',
        apiKey: 'ваш_ключ_тут'
    },
    
    FLIGHTRADAR: {
        name: 'Flightradar24',
        flights: 'https://api.flightradar24.com/common/v1/flight/list.json',
        requiresKey: true
    }
};

// Менеджер API
class APIManager {
    constructor() {
        this.activeAPIs = [];
        this.fallbackOrder = [];
        this.currentAPI = null;
        this.apiStats = {};
        this.init();
    }
    
    init() {
        // Відбираємо активні API та сортуємо за пріоритетом
        this.activeAPIs = Object.values(ALL_APIS)
            .filter(api => api.active)
            .sort((a, b) => a.priority - b.priority);
        
        this.fallbackOrder = [...this.activeAPIs];
        this.currentAPI = this.activeAPIs[0];
        
        // Ініціалізація статистики
        this.activeAPIs.forEach(api => {
            this.apiStats[api.name] = {
                requests: 0,
                successes: 0,
                errors: 0,
                lastResponseTime: 0,
                lastSuccess: null,
                lastError: null
            };
        });
        
        console.log(`API Manager initialized with ${this.activeAPIs.length} APIs`);
        console.log(`Current API: ${this.currentAPI?.name}`);
    }
    
    // Отримати поточні тривоги
    async getCurrentAlerts() {
        return this.tryAPIs('states');
    }
    
    // Отримати історію тривог
    async getAlertHistory(regionId = null, hours = 24) {
        return this.tryAPIs('history', { regionId, hours });
    }
    
    // Отримати список регіонів
    async getRegions() {
        return this.tryAPIs('regions');
    }
    
    // Спробувати всі API поки один не спрацює
    async tryAPIs(endpoint, params = {}) {
        let lastError = null;
        
        for (const api of this.fallbackOrder) {
            if (!api[endpoint]) continue;
            
            try {
                console.log(`Trying ${api.name} API for ${endpoint}...`);
                const startTime = Date.now();
                
                const data = await this.callAPI(api, endpoint, params);
                const responseTime = Date.now() - startTime;
                
                // Оновлення статистики
                this.updateStats(api.name, true, responseTime);
                
                // Збереження інформації про джерело
                data._source = {
                    api: api.name,
                    url: api[endpoint],
                    responseTime: responseTime,
                    timestamp: new Date().toISOString()
                };
                
                // Переключення на успішне API
                if (this.currentAPI !== api) {
                    console.log(`Switching to ${api.name} API`);
                    this.currentAPI = api;
                }
                
                return data;
                
            } catch (error) {
                lastError = error;
                this.updateStats(api.name, false, 0, error.message);
                console.warn(`${api.name} API failed:`, error.message);
                
                // Продовжуємо спробувати наступне API
                continue;
            }
        }
        
        // Якщо всі API не спрацювали
        throw new Error(`All APIs failed. Last error: ${lastError?.message}`);
    }
    
    // Виклик конкретного API
    async callAPI(api, endpoint, params = {}) {
        const url = this.buildURL(api[endpoint], params);
        const options = this.buildOptions(api);
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Конвертація різних форматів API у стандартний формат
        return this.normalizeData(data, api.name, endpoint);
    }
    
    // Побудова URL з параметрами
    buildURL(baseURL, params) {
        if (!params || Object.keys(params).length === 0) {
            return baseURL;
        }
        
        const url = new URL(baseURL);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, value);
            }
        });
        
        return url.toString();
    }
    
    // Побудова параметрів запиту
    buildOptions(api) {
        const options = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'AirAlertMap/2.0',
                'Cache-Control': 'no-cache'
            },
            mode: 'cors',
            credentials: 'omit'
        };
        
        // Додавання спеціальних заголовків API
        if (api.headers) {
            Object.assign(options.headers, api.headers);
        }
        
        return options;
    }
    
    // Нормалізація даних з різних API
    normalizeData(data, apiName, endpoint) {
        switch(apiName) {
            // API з and3rson/raid
            case 'Alerts.com.ua (Official API)':
            case 'Alerts.com.ua (Local)':
                return this.normalizeAlertsComUaOfficial(data, endpoint);
                
            // Інші API
            case 'Alerts.com.ua':
                return this.normalizeAlertsComUa(data, endpoint);
                
            case 'Ubilling.net.ua':
                return this.normalizeUbilling(data, endpoint);
                
            case 'UkraineAlarm.com':
                return this.normalizeUkraineAlarm(data, endpoint);
                
            case 'Alerts.in.ua':
                return this.normalizeAlertsInUa(data, endpoint);
                
            case 'Siren API':
                return this.normalizeSiren(data, endpoint);
                
            default:
                return data;
        }
    }
    
    // Нормалізація для офіційного API alerts.com.ua (з and3rson/raid)
    normalizeAlertsComUaOfficial(data, endpoint) {
        // Це API вже повертає стандартизований формат
        if (endpoint === 'states') {
            return {
                states: data.states || data,
                timestamp: new Date().toISOString(),
                count: data.states?.length || 0
            };
        }
        return data;
    }
    
    // Нормалізація для alerts.com.ua (стара версія)
    normalizeAlertsComUa(data, endpoint) {
        if (endpoint === 'states') {
            return {
                states: data.states || data,
                timestamp: new Date().toISOString(),
                count: data.states?.length || 0
            };
        }
        return data;
    }
    
    // Нормалізація для ubilling.net.ua
    normalizeUbilling(data, endpoint) {
        if (endpoint === 'states') {
            // ubilling повертає масив без обгортки
            const states = Array.isArray(data) ? data : data.states || [];
            return {
                states: states.map(item => ({
                    id: item.id || item.region_id,
                    name: item.name || item.region_name,
                    alert: item.alert || item.status === 'alert',
                    changed: item.changed || item.last_update
                })),
                timestamp: new Date().toISOString(),
                count: states.length
            };
        }
        return data;
    }
    
    // Нормалізація для ukrainealarm.com
    normalizeUkraineAlarm(data, endpoint) {
        if (endpoint === 'states') {
            return {
                states: data.alerts?.map(alert => ({
                    id: alert.location.id,
                    name: alert.location.name,
                    alert: true,
                    changed: alert.alertChanged,
                    type: alert.type,
                    region: alert.location.region
                })) || [],
                timestamp: new Date().toISOString(),
                count: data.alerts?.length || 0
            };
        }
        return data;
    }
    
    // Нормалізація для alerts.in.ua
    normalizeAlertsInUa(data, endpoint) {
        if (endpoint === 'states') {
            return {
                states: data.alerts?.map(alert => ({
                    id: alert.region.id,
                    name: alert.region.name,
                    alert: alert.active,
                    changed: alert.started_at,
                    ended: alert.ended_at,
                    type: alert.type
                })) || [],
                timestamp: new Date().toISOString(),
                count: data.alerts?.length || 0
            };
        }
        return data;
    }
    
    // Нормалізація для siren.org.ua
    normalizeSiren(data, endpoint) {
        if (endpoint === 'states') {
            return {
                states: data.alerts || data,
                timestamp: new Date().toISOString(),
                count: data.alerts?.length || data.length || 0
            };
        }
        return data;
    }
    
    // Оновлення статистики
    updateStats(apiName, success, responseTime, error = null) {
        if (!this.apiStats[apiName]) {
            this.apiStats[apiName] = {
                requests: 0,
                successes: 0,
                errors: 0,
                lastResponseTime: 0,
                lastSuccess: null,
                lastError: null
            };
        }
        
        const stats = this.apiStats[apiName];
        stats.requests++;
        
        if (success) {
            stats.successes++;
            stats.lastResponseTime = responseTime;
            stats.lastSuccess = new Date().toISOString();
        } else {
            stats.errors++;
            stats.lastError = {
                message: error,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // Отримати статистику
    getStats() {
        return {
            currentAPI: this.currentAPI?.name,
            availableAPIs: this.activeAPIs.map(api => api.name),
            stats: this.apiStats,
            totalRequests: Object.values(this.apiStats).reduce((sum, stat) => sum + stat.requests, 0),
            successRate: this.calculateSuccessRate()
        };
    }
    
    calculateSuccessRate() {
        let totalRequests = 0;
        let totalSuccesses = 0;
        
        Object.values(this.apiStats).forEach(stat => {
            totalRequests += stat.requests;
            totalSuccesses += stat.successes;
        });
        
        return totalRequests > 0 ? (totalSuccesses / totalRequests * 100).toFixed(1) : 0;
    }
    
    // Переключити на конкретне API
    switchToAPI(apiName) {
        const api = this.activeAPIs.find(a => a.name === apiName);
        if (api) {
            this.currentAPI = api;
            // Переміщуємо вибране API на перше місце в fallback порядку
            this.fallbackOrder = [
                api,
                ...this.fallbackOrder.filter(a => a.name !== apiName)
            ];
            return true;
        }
        return false;
    }
    
    // Тестування всіх API
    async testAllAPIs() {
        const results = [];
        
        for (const api of this.activeAPIs) {
            try {
                const startTime = Date.now();
                const response = await fetch(api.states, this.buildOptions(api));
                const responseTime = Date.now() - startTime;
                
                results.push({
                    api: api.name,
                    url: api.states,
                    status: response.status,
                    ok: response.ok,
                    responseTime: responseTime,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                results.push({
                    api: api.name,
                    url: api.states,
                    status: 'ERROR',
                    ok: false,
                    error: error.message,
                    responseTime: 0,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Затримка між тестами
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return results;
    }
    
    // Додатково: метод для отримання API-ключів
    getAPIKeys() {
        return {
            'Alerts.com.ua (Official API)': 'demo_key', // Замініть на реальний ключ
            'Alerts.com.ua (Local)': 'foo',
            'UkraineAlarm.com': 'public'
        };
    }
}

// Експортовані функції для backwards compatibility
const apiManager = new APIManager();

// Основні функції для використання в додатку
export async function fetchRealAlerts() {
    return apiManager.getCurrentAlerts();
}

export async function fetchRegionsHistory(regionId = null, hours = 24) {
    return apiManager.getAlertHistory(regionId, hours);
}

export async function fetchRegions() {
    return apiManager.getRegions();
}

export async function testAllAPIs() {
    return apiManager.testAllAPIs();
}

export function getAPIStats() {
    return apiManager.getStats();
}

export function switchAPI(apiName) {
    return apiManager.switchToAPI(apiName);
}

export function getAllAPIs() {
    return apiManager.activeAPIs;
}

// Додаткові функції для обробки даних
export function convertAlertsToTargets(alertsData) {
    if (!alertsData || !alertsData.states) {
        return [];
    }
    
    const targets = [];
    const regionCoordinates = getRegionCoordinatesMap();
    
    alertsData.states.forEach(region => {
        if (region.alert === true || region.alert === 1 || region.status === 'alert') {
            const coords = regionCoordinates[region.name] || getCoordinatesByRegionId(region.id) || [49.0, 31.5];
            
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
                apiSource: alertsData._source?.api || 'unknown',
                regionId: region.id
            });
        }
    });
    
    return targets;
}

// Розширена мапа координат всіх регіонів України
function getRegionCoordinatesMap() {
    return {
        // Області
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
        
        // Міста
        'м.Київ': [50.45, 30.52],
        'м.Севастополь': [44.61, 33.52],
        'м.Харків': [49.99, 36.23],
        'м.Одеса': [46.48, 30.73],
        'м.Дніпро': [48.45, 35.05],
        'м.Донецьк': [48.02, 37.80],
        'м.Запоріжжя': [47.84, 35.14],
        'м.Львів': [49.84, 24.03],
        'м.Кривий Ріг': [47.91, 33.39],
        'м.Миколаїв': [46.98, 31.99],
        'м.Маріуполь': [47.10, 37.55],
        'м.Луганськ': [48.57, 39.30],
        'м.Вінниця': [49.23, 28.48],
        'м.Макіївка': [48.08, 38.06],
        'м.Херсон': [46.64, 32.62],
        'м.Полтава': [49.59, 34.55],
        'м.Чернігів': [51.50, 31.30],
        'м.Черкаси': [49.44, 32.06],
        'м.Суми': [50.91, 34.80],
        'м.Житомир': [50.25, 28.66],
        'м.Хмельницький': [49.42, 26.99],
        'м.Чернівці': [48.29, 25.94],
        'м.Рівне': [50.62, 26.25],
        'м.Івано-Франківськ': [48.92, 24.71],
        'м.Тернопіль': [49.55, 25.59],
        'м.Луцьк': [50.75, 25.34],
        'м.Ужгород': [48.62, 22.29],
        
        // Автономні республіки
        'АР Крим': [45.04, 34.00],
        'Автономна Республіка Крим': [45.04, 34.00],
        'Крим': [45.04, 34.00],
        
        // Регіональні центри
        'Центр': [49.0, 31.5],
        'Схід': [48.5, 37.5],
        'Захід': [49.5, 24.0],
        'Північ': [51.5, 31.0],
        'Південь': [46.5, 32.0]
    };
}

// Альтернативний спосіб отримання координат за ID регіону
function getCoordinatesByRegionId(regionId) {
    const regionMap = {
        1: [49.23, 28.48],   // Вінницька
        2: [50.75, 25.34],   // Волинська
        3: [48.45, 35.05],   // Дніпропетровська
        4: [48.02, 37.80],   // Донецька
        5: [50.25, 28.66],   // Житомирська
        6: [48.62, 22.29],   // Закарпатська
        7: [47.84, 35.14],   // Запорізька
        8: [48.92, 24.71],   // Івано-Франківська
        9: [50.45, 30.52],   // Київська
        10: [48.51, 32.26],  // Кіровоградська
        11: [48.57, 39.30],  // Луганська
        12: [49.84, 24.03],  // Львівська
        13: [46.98, 31.99],  // Миколаївська
        14: [46.48, 30.73],  // Одеська
        15: [49.59, 34.55],  // Полтавська
        16: [50.62, 26.25],  // Рівненська
        17: [50.91, 34.80],  // Сумська
        18: [49.55, 25.59],  // Тернопільська
        19: [49.99, 36.23],  // Харківська
        20: [46.64, 32.62],  // Херсонська
        21: [49.42, 26.99],  // Хмельницька
        22: [49.44, 32.06],  // Черкаська
        23: [48.29, 25.94],  // Чернівецька
        24: [51.50, 31.30],  // Чернігівська
        25: [50.45, 30.52],  // Київ
        26: [44.61, 33.52],  // Севастополь
        27: [45.04, 34.00]   // АР Крим
    };
    
    return regionMap[regionId];
}

// Функція для запуску регулярних оновлень з усіма API
export function startMultiAPIUpdates(callback, interval = 30000) {
    console.log(`Starting multi-API updates every ${interval/1000} seconds`);
    
    let isRunning = true;
    let currentApiIndex = 0;
    
    const updateData = async () => {
        if (!isRunning) return;
        
        try {
            const alertsData = await apiManager.getCurrentAlerts();
            callback(alertsData);
            
        } catch (error) {
            console.error('Multi-API update failed:', error);
            // Калбек з інформацією про помилку
            callback({
                error: error.message,
                states: [],
                _source: { api: 'All APIs failed', timestamp: new Date().toISOString() }
            });
        }
    };
    
    // Перше оновлення
    updateData();
    
    // Запускаємо інтервал
    const intervalId = setInterval(updateData, interval);
    
    const stopUpdates = () => {
        isRunning = false;
        clearInterval(intervalId);
        console.log('Multi-API updates stopped');
    };
    
    return stopUpdates;
}

// Експорт менеджера для прямого доступу
export { apiManager, APIManager };
