// src/svitlo/svitloAPI.js
class SvitloAPI {
    constructor(config = {}) {
        this.config = {
            baseUrl: config.baseUrl || 'https://api.svitlo.live/api',
            region: config.region || 'kharkivska', // за замовчуванням Харківська
            queue: config.queue || 'queue1',
            cacheMinutes: config.cacheMinutes || 10,
            ...config
        };
        
        this.cache = {
            lastFetch: null,
            data: null,
            regions: null
        };
    }

    /**
     * Отримання даних про відключення світла
     */
    async getOutageData() {
        // Перевірка кешу
        if (this.cache.lastFetch && 
            (Date.now() - this.cache.lastFetch) < (this.config.cacheMinutes * 60 * 1000) &&
            this.cache.data) {
            console.log('Using cached Svitlo data');
            return this.cache.data;
        }
        
        try {
            const response = await fetch(this.config.baseUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const apiData = await response.json();
            
            // Обробка відповіді (аналогічно Python-коду)
            const processedData = this.processApiResponse(apiData);
            
            // Оновлення кешу
            this.cache = {
                lastFetch: Date.now(),
                data: processedData,
                regions: apiData.regions || []
            };
            
            return processedData;
            
        } catch (error) {
            console.error('Svitlo API error:', error);
            
            // Повернення кешованих даних у разі помилки
            if (this.cache.data) {
                console.log('Returning cached data due to error');
                return this.cache.data;
            }
            
            throw error;
        }
    }

    /**
     * Обробка відповіді API (адаптовано з Python)
     */
    processApiResponse(apiData) {
        const { region, queue } = this.config;
        const dateToday = apiData.date_today;
        const dateTomorrow = apiData.date_tomorrow;
        
        // Пошук регіону в даних
        const regionObj = apiData.regions?.find(r => r.cpu === region);
        
        if (!regionObj) {
            throw new Error(`Region '${region}' not found in API response`);
        }
        
        // Перевірка на аварійне відключення
        const isEmergency = regionObj.emergency || false;
        
        // Отримання розкладу для черги
        const schedule = (regionObj.schedule || {})[queue] || {};
        const slotsToday = schedule[dateToday] || {};
        const slotsTomorrow = schedule[dateTomorrow] || {};
        
        // Побудова списку станів на сьогодні
        const todayStates = this.buildHalfHourStates(slotsToday);
        
        // Поточний стан
        const now = new Date();
        const kyivTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
        const currentIndex = kyivTime.getHours() * 2 + (kyivTime.getMinutes() >= 30 ? 1 : 0);
        const currentState = todayStates[currentIndex] || 'unknown';
        
        // Пошук наступної зміни
        const nextChange = this.findNextChange(todayStates, currentIndex);
        
        // Формування результату
        return {
            region: regionObj.name || region,
            queue: queue,
            isEmergency: isEmergency,
            currentState: currentState, // 'on', 'off', 'unknown'
            nextChangeTime: nextChange?.time,
            nextChangeState: nextChange?.state,
            scheduleToday: todayStates,
            scheduleTomorrow: dateTomorrow ? this.buildHalfHourStates(slotsTomorrow) : null,
            updated: new Date().toISOString(),
            coordinates: this.getRegionCoordinates(region) // Додамо координати для мапи
        };
    }

    /**
     * Побудова станів для 48 півгодинних інтервалів
     */
    buildHalfHourStates(slotsMap) {
        const states = [];
        
        for (let hour = 0; hour < 24; hour++) {
            for (let minute of [0, 30]) {
                const timeKey = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const code = slotsMap[timeKey] || 0;
                
                if (code === 1) states.push('on');      // світло є
                else if (code === 2) states.push('off'); // світла немає
                else states.push('unknown');             // невідомо
            }
        }
        
        return states;
    }

    /**
     * Пошук наступної зміни стану
     */
    findNextChange(states, currentIndex) {
        if (!states || states.length === 0) return null;
        
        const currentState = states[currentIndex];
        
        for (let i = 1; i < states.length; i++) {
            const nextIndex = (currentIndex + i) % states.length;
            if (states[nextIndex] !== currentState) {
                const hour = Math.floor(nextIndex / 2);
                const minute = (nextIndex % 2) * 30;
                
                return {
                    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                    state: states[nextIndex]
                };
            }
        }
        
        return null;
    }

    /**
     * Отримання координат регіону для мапи
     */
    getRegionCoordinates(regionKey) {
        const regionCoords = {
            'kharkivska': [49.99, 36.23],      // Харківська
            'kyivska': [50.45, 30.52],         // Київська
            'odeska': [46.48, 30.73],          // Одеська
            'lvivska': [49.84, 24.03],         // Львівська
            'donetska': [48.02, 37.80],        // Донецька
            'mikolaivska': [46.98, 31.99],     // Миколаївська
            'default': [49.0, 31.5]            // Центр України
        };
        
        return regionCoords[regionKey] || regionCoords.default;
    }

    /**
     * Отримання всіх активних відключень
     */
    async getAllActiveOutages() {
        try {
            const data = await this.getOutageData();
            const outages = [];
            
            // Якщо зараз відключення
            if (data.currentState === 'off') {
                outages.push({
                    id: `svitlo_${data.region}_${data.queue}`,
                    type: 'power_outage',
                    name: `Відключення світла: ${data.region}`,
                    description: `Черга ${data.queue}`,
                    coordinates: data.coordinates,
                    region: data.region,
                    status: 'active',
                    isEmergency: data.isEmergency,
                    nextChange: data.nextChangeTime,
                    timestamp: new Date().toISOString(),
                    icon: '💡',
                    color: data.isEmergency ? '#e74c3c' : '#f39c12'
                });
            }
            
            return outages;
            
        } catch (error) {
            console.error('Error getting outages:', error);
            return [];
        }
    }
}

// Експорт для використання в проекті
export default SvitloAPI;
