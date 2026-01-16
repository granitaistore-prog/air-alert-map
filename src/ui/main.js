// Імпорти для PWA додатку
import { initMap, changeBaseLayer } from '../map/mapInit.js';
import { initLayers } from '../map/layers.js';
import { initRadar } from '../map/radarOverlay.js';
import { TargetManager } from '../targets/targetManager.js';
import { PowerOutageManager } from '../svitlo/outageManager.js';

// Додаткові функції (створіть ці файли або використовуйте наведені нижче заглушки)
// import { fetchRealAlerts } from '../net/api.js';

// ====================
// ЗАГЛУШКИ ДЛЯ ТЕСТУ
// ====================

// Тимчасові функції API (замініть на реальні)
const mockAlerts = [
    { id: 1, name: 'Київська область', alert: true, changed: new Date().toISOString() },
    { id: 2, name: 'Харківська область', alert: true, changed: new Date().toISOString() },
    { id: 3, name: 'Одеська область', alert: false, changed: new Date().toISOString() },
    { id: 4, name: 'Львівська область', alert: false, changed: new Date().toISOString() },
    { id: 5, name: 'Дніпропетровська область', alert: true, changed: new Date().toISOString() }
];

async function fetchRealAlerts() {
    // Тимчасова заглушка
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                states: mockAlerts,
                _source: { api: 'test', timestamp: new Date().toISOString() }
            });
        }, 500);
    });
}

// ====================
// ОСНОВНИЙ КЛАС PWA ДОДАТКУ
// ====================

class AirAlertPWA {
    constructor() {
        this.map = null;
        this.targetManager = null;
        this.outageManager = null;
        this.activeAlerts = [];
        this.isPanelOpen = false;
        this.connectionStatus = 'connecting';
        this.updateInterval = null;
        this.outageUpdateInterval = null;
        
        // Координати областей України
        this.regionCoordinates = {
            'Київська область': [50.45, 30.52],
            'Харківська область': [49.99, 36.23],
            'Одеська область': [46.48, 30.73],
            'Львівська область': [49.84, 24.03],
            'Дніпропетровська область': [48.45, 35.05],
            'Запорізька область': [47.84, 35.14],
            'Донецька область': [48.02, 37.80],
            'Луганська область': [48.57, 39.30],
            'Миколаївська область': [46.98, 31.99],
            'Херсонська область': [46.64, 32.62],
            'Полтавська область': [49.59, 34.55],
            'Чернігівська область': [51.50, 31.30],
            'Черкаська область': [49.44, 32.06],
            'Сумська область': [50.91, 34.80],
            'Житомирська область': [50.25, 28.66],
            'Хмельницька область': [49.42, 26.99],
            'Чернівецька область': [48.29, 25.94],
            'Тернопільська область': [49.55, 25.59],
            'Рівненська область': [50.62, 26.25],
            'Івано-Франківська область': [48.92, 24.71],
            'Волинська область': [50.75, 25.34],
            'Закарпатська область': [48.62, 22.29],
            'Кіровоградська область': [48.51, 32.26],
            'м.Київ': [50.45, 30.52],
            'АР Крим': [45.04, 34.00]
        };
    }

    async init() {
        try {
            console.log('🚀 Запуск PWA додатку для смартфону...');
            
            // Оновлюємо прогрес завантаження
            this.updateLoading(10, 'Підготовка системи...');
            
            // 1. ІНІЦІАЛІЗАЦІЯ МАПИ
            await this.delay(300);
            this.updateLoading(30, 'Завантаження мапи...');
            
            this.map = initMap();
            if (!this.map) throw new Error('Не вдалося ініціалізувати мапу');
            
            console.log('✅ Мапа ініціалізована');
            
            // 2. НАЛАШТУВАННЯ МАПИ ДЛЯ МОБІЛЬНИХ
            this.setupMobileMap();
            
            await this.delay(300);
            this.updateLoading(50, 'Налаштування інтерфейсу...');
            
            // 3. ІНІЦІАЛІЗАЦІЯ КОМПОНЕНТІВ
            this.initComponents();
            
            // 4. НАЛАШТУВАННЯ ПОДІЙ
            this.bindEvents();
            
            await this.delay(300);
            this.updateLoading(70, 'Підключення до даних...');
            
            // 5. ЗАВАНТАЖЕННЯ ДАНИХ
            await this.loadInitialData();
            
            await this.delay(300);
            this.updateLoading(90, 'Запуск оновлень...');
            
            // 6. ЗАПУСК ОНОВЛЕНЬ
            this.startUpdates();
            
            // 7. ЗАВЕРШЕННЯ ЗАВАНТАЖЕННЯ
            await this.delay(500);
            this.updateLoading(100, 'Готово!');
            
            setTimeout(() => {
                this.hideLoading();
                this.showNotification('Система моніторингу активована', 'success');
                this.updateStatus('connected', '🟢 Система активна');
                console.log('✅ PWA додаток готовий до роботи');
            }, 800);
            
        } catch (error) {
            console.error('❌ Помилка ініціалізації:', error);
            this.showNotification(`Помилка: ${error.message}`, 'error');
            this.updateStatus('error', '🔴 Помилка');
        }
    }

    setupMobileMap() {
        // Оптимізація для мобільних пристроїв
        this.map.touchZoom.enable();
        this.map.doubleClickZoom.enable();
        this.map.scrollWheelZoom.enable();
        
        // Налаштування для кращої роботи на смартфоні
        this.map.options.tap = false; // Вимикаємо тап для кращої роботи з кнопками
        
        // Додаємо темну тему для мапи
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB',
            maxZoom: 19
        }).addTo(this.map);
        
        // Перевіряємо розміри для мобільного
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }

    initComponents() {
        // Ініціалізація менеджерів
        this.targetManager = new TargetManager(this.map);
        this.outageManager = new PowerOutageManager(this.map);
        
        // Тимчасово - ініціалізація шарів та радару
        if (typeof initLayers === 'function') {
            initLayers(this.map);
        }
        
        if (typeof initRadar === 'function') {
            initRadar(this.map);
        }
        
        console.log('✅ Компоненти ініціалізовані');
    }

    bindEvents() {
        // Кнопка тривог
        document.getElementById('btn-alerts').addEventListener('click', () => {
            this.toggleAlertsPanel();
        });
        
        // Кнопка закриття панелі
        document.getElementById('btn-close-panel').addEventListener('click', () => {
            this.toggleAlertsPanel(false);
        });
        
        // Кнопка центрування
        document.getElementById('btn-center').addEventListener('click', () => {
            this.map.setView([49.0, 31.5], 6);
            this.showNotification('Мапа центрована на Україні', 'info');
        });
        
        // Кнопка геолокації
        document.getElementById('btn-location').addEventListener('click', () => {
            this.getUserLocation();
        });
        
        // Кнопка світла
        document.getElementById('btn-light').addEventListener('click', () => {
            this.togglePowerOutages();
        });
        
        // Кнопка налаштувань
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.showSettings();
        });
        
        // Swipe для закриття панелі тривог
        this.setupSwipeGestures();
        
        // Події онлайн/офлайн
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        console.log('✅ Події налаштовані');
    }

    async loadInitialData() {
        try {
            // Завантаження тривог
            const alertsData = await fetchRealAlerts();
            this.activeAlerts = alertsData.states.filter(region => region.alert);
            
            // Відображення тривог на мапі
            this.displayAlertsOnMap(this.activeAlerts);
            
            // Оновлення UI
            this.updateAlertsUI();
            this.updateAlertBadge();
            
            console.log(`✅ Завантажено ${this.activeAlerts.length} активних тривог`);
            
        } catch (error) {
            console.error('Помилка завантаження даних:', error);
            this.showNotification('Помилка завантаження даних', 'error');
        }
    }

    displayAlertsOnMap(alerts) {
        // Очищаємо попередні маркери
        if (this.alertMarkers) {
            this.alertMarkers.forEach(marker => this.map.removeLayer(marker));
        }
        
        this.alertMarkers = [];
        
        // Додаємо нові маркери
        alerts.forEach(alert => {
            const coords = this.regionCoordinates[alert.name] || [49.0, 31.5];
            
            const marker = L.circleMarker(coords, {
                color: '#e74c3c',
                fillColor: '#e74c3c',
                fillOpacity: 0.7,
                radius: 10,
                weight: 2
            })
            .addTo(this.map)
            .bindPopup(`
                <div style="padding: 8px; min-width: 180px;">
                    <strong style="color: #e74c3c; font-size: 16px;">🚨 ${alert.name}</strong>
                    <div style="margin-top: 8px; font-size: 13px;">
                        <div>Повітряна тривога!</div>
                        <div style="opacity: 0.7; margin-top: 4px;">
                            ${new Date(alert.changed).toLocaleTimeString('uk-UA')}
                        </div>
                    </div>
                </div>
            `);
            
            this.alertMarkers.push(marker);
        });
        
        // Центруємо мапу на тривогах, якщо вони є
        if (alerts.length > 0) {
            const bounds = L.latLngBounds(alerts.map(a => this.regionCoordinates[a.name] || [49.0, 31.5]));
            this.map.fitBounds(bounds.pad(0.1));
        }
    }

    updateAlertsUI() {
        const alertsList = document.getElementById('alerts-list');
        const alertsCount = document.getElementById('alerts-count');
        const alertsIcon = document.getElementById('alerts-icon');
        const panelAlertsIcon = document.getElementById('panel-alerts-icon');
        const alertsBtn = document.getElementById('btn-alerts');
        
        if (!alertsList) return;
        
        // Оновлюємо кількість
        if (alertsCount) {
            alertsCount.textContent = `(${this.activeAlerts.length})`;
        }
        
        // Оновлюємо список
        if (this.activeAlerts.length === 0) {
            alertsList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; opacity: 0.7;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🕊️</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Тривог немає</div>
                    <div style="font-size: 14px;">Усі регіони безпечні</div>
                </div>
            `;
            
            if (alertsIcon) alertsIcon.textContent = '📢';
            if (panelAlertsIcon) panelAlertsIcon.textContent = '📢';
            alertsBtn.classList.remove('alert-active');
            
        } else {
            let html = '';
            this.activeAlerts.forEach(alert => {
                const time = new Date(alert.changed).toLocaleTimeString('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                html += `
                    <div class="alert-card">
                        <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <div style="font-size: 20px; margin-right: 12px;">🚨</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 16px;">${alert.name}</div>
                                <div style="font-size: 13px; opacity: 0.7; margin-top: 2px;">
                                    Оновлено: ${time}
                                </div>
                            </div>
                        </div>
                        <div style="background: rgba(231, 76, 60, 0.2); padding: 8px; border-radius: 6px; font-size: 13px;">
                            ⚠️ Активна повітряна тривога. Шукайте укриття!
                        </div>
                    </div>
                `;
            });
            
            alertsList.innerHTML = html;
            
            if (alertsIcon) alertsIcon.textContent = '🚨';
            if (panelAlertsIcon) panelAlertsIcon.textContent = '🚨';
            alertsBtn.classList.add('alert-active');
        }
    }

    updateAlertBadge() {
        const alertsBtn = document.getElementById('btn-alerts');
        if (!alertsBtn) return;
        
        // Створюємо або оновлюємо бадж
        let badge = alertsBtn.querySelector('.badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge';
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: #e74c3c;
                color: white;
                border-radius: 10px;
                min-width: 20px;
                height: 20px;
                font-size: 11px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 6px;
            `;
            alertsBtn.style.position = 'relative';
            alertsBtn.appendChild(badge);
        }
        
        if (this.activeAlerts.length > 0) {
            badge.textContent = this.activeAlerts.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    startUpdates() {
        // Оновлення тривог кожні 30 секунд
        this.updateInterval = setInterval(() => {
            this.updateAlertsData();
        }, 30000);
        
        // Оновлення відключень світла кожні 5 хвилин
        this.outageUpdateInterval = setInterval(() => {
            this.updatePowerOutages();
        }, 300000);
        
        console.log('✅ Оновлення запущено');
    }

    async updateAlertsData() {
        try {
            const alertsData = await fetchRealAlerts();
            const newAlerts = alertsData.states.filter(region => region.alert);
            
            // Перевіряємо чи є нові тривоги
            const previousIds = new Set(this.activeAlerts.map(a => a.id));
            const addedAlerts = newAlerts.filter(alert => !previousIds.has(alert.id));
            
            if (addedAlerts.length > 0) {
                this.activeAlerts = newAlerts;
                this.displayAlertsOnMap(this.activeAlerts);
                this.updateAlertsUI();
                this.updateAlertBadge();
                
                // Сповіщення про нові тривоги
                addedAlerts.forEach(alert => {
                    this.showNotification(`Нова тривога: ${alert.name}`, 'warning', true);
                });
            }
            
        } catch (error) {
            console.error('Помилка оновлення тривог:', error);
        }
    }

    async updatePowerOutages() {
        try {
            // Тут буде логіка оновлення відключень світла
            console.log('Оновлення інформації про світло...');
            
            // Тимчасова заглушка
            this.showNotification('Інформація про світло оновлена', 'info');
            
        } catch (error) {
            console.error('Помилка оновлення світла:', error);
        }
    }

    toggleAlertsPanel(forceState = null) {
        const panel = document.getElementById('alerts-panel');
        const isOpen = forceState !== null ? forceState : !this.isPanelOpen;
        
        this.isPanelOpen = isOpen;
        
        if (isOpen) {
            panel.classList.add('active');
            // Оновлюємо список при відкритті
            this.updateAlertsUI();
        } else {
            panel.classList.remove('active');
        }
    }

    togglePowerOutages() {
        // Тимчасова логіка
        const lightBtn = document.getElementById('btn-light');
        const isActive = lightBtn.classList.contains('active');
        
        if (isActive) {
            lightBtn.classList.remove('active');
            this.showNotification('Відключення світла приховані', 'info');
        } else {
            lightBtn.classList.add('active');
            this.showNotification('Відключення світла показані', 'info');
        }
    }

    async getUserLocation() {
        if (!navigator.geolocation) {
            this.showNotification('Геолокація не підтримується', 'error');
            return;
        }
        
        this.showNotification('Визначення вашого місцезнаходження...', 'info');
        
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude } = position.coords;
            
            // Додаємо маркер на мапі
            L.marker([latitude, longitude], {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div style="background: #3498db; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);"></div>',
                    iconSize: [24, 24]
                })
            })
            .addTo(this.map)
            .bindPopup('<b>Ваше місцезнаходження</b>')
            .openPopup();
            
            // Центруємо мапу
            this.map.setView([latitude, longitude], 13);
            
            this.showNotification('Місцезнаходження визначено', 'success');
            
        } catch (error) {
            console.error('Помилка геолокації:', error);
            this.showNotification('Не вдалося визначити місцезнаходження', 'error');
        }
    }

    showSettings() {
        // Тимчасове сповіщення
        this.showNotification('Налаштування будуть доступні в наступному оновленні', 'info');
    }

    setupSwipeGestures() {
        const panel = document.getElementById('alerts-panel');
        let startY = 0;
        let currentY = 0;
        
        panel.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        panel.addEventListener('touchmove', (e) => {
            if (!this.isPanelOpen) return;
            
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            
            if (diff > 50) {
                this.toggleAlertsPanel(false);
            }
        }, { passive: true });
    }

    handleOnline() {
        this.showNotification('Інтернет-з\'єднання відновлено', 'success');
        this.updateStatus('connected', '🟢 Онлайн');
        this.startUpdates();
    }

    handleOffline() {
        this.showNotification('Втрачено інтернет-з\'єднання', 'warning');
        this.updateStatus('disconnected', '🔴 Офлайн');
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.outageUpdateInterval) {
            clearInterval(this.outageUpdateInterval);
            this.outageUpdateInterval = null;
        }
    }

    showNotification(message, type = 'info', urgent = false) {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notification-text');
        
        if (!notification || !text) return;
        
        // Встановлюємо текст та стиль
        text.textContent = message;
        
        // Колір в залежності від типу
        const colors = {
            'success': '#2ecc71',
            'error': '#e74c3c',
            'warning': '#f39c12',
            'info': '#3498db'
        };
        
        notification.style.background = `rgba(${this.hexToRgb(colors[type] || '#3498db')}, 0.95)`;
        
        // Показуємо сповіщення
        notification.classList.add('show');
        
        // Ховаємо через 5 секунд (або 10 для важливих)
        const duration = urgent ? 10000 : 5000;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
        
        // Вібрація для важливих сповіщень (якщо підтримується)
        if (urgent && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '52, 152, 219';
    }

    updateStatus(status, text) {
        const icon = document.getElementById('status-icon');
        const statusText = document.getElementById('status-text');
        
        if (icon) icon.textContent = status === 'connected' ? '🟢' : '🔴';
        if (statusText) statusText.textContent = text;
    }

    updateLoading(percent, message) {
        const bar = document.getElementById('progress-bar');
        const text = document.getElementById('loading-text');
        
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.textContent = message;
    }

    hideLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 500);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ====================
// ЗАПУСК ДОДАТКУ
// ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 PWA додаток завантажується...');
    
    // Створюємо екземпляр додатку
    window.app = new AirAlertPWA();
    
    // Запускаємо ініціалізацію
    window.app.init();
    
    // Для відладки
    console.log('Додаток створено, доступний як window.app');
});

export { AirAlertPWA };
