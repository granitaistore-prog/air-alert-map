import { initMap, changeBaseLayer } from './map/mapInit.js';
import { initLayers } from './map/layers.js';
import { initRadar } from './map/radarOverlay.js';
import { TargetManager } from './targets/targetManager.js';
import { initHUD, updateHUD } from './ui/hud.js';
import { initPanels, updateTargetsList } from './ui/panels.js';
import { showNotification } from './ui/notifications.js';
import { simulateWebSocket, getMockTargets, fetchRealAlerts, fetchRegionsHistory, startRealDataUpdates } from './net/api.js';
import { createWebSocketManager } from './net/websocket.js';

class AirAlertApp {
    constructor() {
        this.map = null;
        this.targetManager = null;
        this.trajectoryManager = null;
        this.wsManager = null;
        this.isSimulating = false;
        this.simulationInterval = null;
        this.realDataInterval = null;
        this.isPanelOpen = false;
        this.connectionStatus = 'disconnected';
        this.useRealAPI = true; // Змініть на false для мок-даних
        this.alertRegions = new Set(); // Області з активною тривогою
        this.lastAlertUpdate = null;
        this.updateMode = 'mixed'; // 'real', 'mock', 'mixed'
    }

    async init() {
        try {
            // Ініціалізація компонентів
            await this.showLoading(10);
            
            this.map = initMap();
            await this.showLoading(30);
            
            initLayers(this.map);
            await this.showLoading(50);
            
            initRadar(this.map);
            await this.showLoading(70);
            
            this.targetManager = new TargetManager(this.map);
            initHUD();
            initPanels();
            
            // Ініціалізація WebSocket (опціонально)
            await this.initWebSocket();
            
            await this.showLoading(90);
            
            this.bindEvents();
            
            // Запускаємо отримання даних
            if (this.useRealAPI) {
                await this.startRealData();
            } else {
                this.startMockData();
            }
            
            await this.showLoading(100);
            this.hideLoading();
            
            showNotification('Система моніторингу активована', 'success');
            console.log('Air Alert App initialized successfully');
            
        } catch (error) {
            console.error('App initialization failed:', error);
            showNotification('Помилка ініціалізації', 'error');
        }
    }

    async initWebSocket() {
        try {
            // Зараз використовуємо REST API замість WebSocket
            // Але залишаємо можливість для майбутніх оновлень
            console.log('Using REST API for data updates');
            
            // Можливість WebSocket для реального часу (закоментовано)
            /*
            this.wsManager = createWebSocketManager({
                url: 'wss://alerts.com.ua/ws',
                autoConnect: false,
                maxReconnectAttempts: 5,
                reconnectInterval: 5000
            });
            
            this.setupWebSocketHandlers();
            */
            
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
        }
    }

    setupWebSocketHandlers() {
        if (!this.wsManager) return;
        
        this.wsManager.onMessage('alert_update', (data) => {
            console.log('Alert update via WebSocket:', data);
            this.handleRealAlertsData(data);
        });
        
        this.wsManager.onStatusChange((status) => {
            this.connectionStatus = status;
            this.updateConnectionStatus(status);
        });
    }

    async startRealData() {
        try {
            console.log('Starting real data updates...');
            
            // Перше завантаження даних
            await this.fetchAndProcessAlerts();
            
            // Запускаємо регулярне оновлення
            this.realDataInterval = setInterval(async () => {
                await this.fetchAndProcessAlerts();
            }, 30000); // Оновлення кожні 30 секунд
            
            // Альтернатива: використання готової функції
            // this.realDataInterval = startRealDataUpdates(this.handleRealAlertsData.bind(this), 30000);
            
            this.updateConnectionStatus('connected');
            showNotification('Підключено до системи попередження', 'success');
            
        } catch (error) {
            console.error('Failed to start real data:', error);
            showNotification('Помилка завантаження даних тривог', 'error');
            
            // Fallback на мок-дані
            this.startMockData();
        }
    }

    async fetchAndProcessAlerts() {
        try {
            console.log('Fetching alert data from API...');
            
            // Отримуємо поточні тривоги
            const alertsData = await fetchRealAlerts();
            
            if (!alertsData || !alertsData.states) {
                throw new Error('Invalid API response format');
            }
            
            // Обробляємо дані
            this.handleRealAlertsData(alertsData);
            
            // Оновлюємо час останнього оновлення
            this.lastAlertUpdate = new Date();
            
            // Оновлюємо HUD
            updateHUD({
                targetCount: this.targetManager.getTargetCount(),
                lastUpdate: this.lastAlertUpdate.toLocaleTimeString('uk-UA'),
                connectionStatus: this.getConnectionStatusIcon()
            });
            
        } catch (error) {
            console.error('Error fetching alerts:', error);
            throw error;
        }
    }

    handleRealAlertsData(alertsData) {
        console.log('Processing alert data:', alertsData.states?.length || 0, 'regions');
        
        // Очищаємо попередній стан
        this.alertRegions.clear();
        
        // Аналізуємо дані про тривоги
        const activeAlerts = [];
        
        if (alertsData.states && Array.isArray(alertsData.states)) {
            alertsData.states.forEach(region => {
                if (region.alert === true || region.alert === 1) {
                    this.alertRegions.add(region.name);
                    activeAlerts.push(region);
                    
                    // Додаємо ціль для області з тривогою (для візуалізації)
                    this.addAlertRegionTarget(region);
                }
            });
        }
        
        // Оновлюємо UI з інформацією про тривоги
        this.updateAlertsDisplay(activeAlerts);
        
        // Якщо використовуємо змішаний режим, додаємо мок-цілі в області з тривогою
        if (this.updateMode === 'mixed' && activeAlerts.length > 0) {
            this.addSimulatedTargetsInAlertRegions(activeAlerts);
        }
        
        // Сповіщення про зміни
        if (activeAlerts.length > 0) {
            this.showAlertNotification(activeAlerts);
        }
        
        return activeAlerts;
    }

    addAlertRegionTarget(region) {
        // Створюємо ціль-маркер для області з тривогою
        const coordinates = this.getRegionCoordinates(region.name);
        if (!coordinates) return;
        
        const targetData = {
            id: `alert_region_${region.id || region.name}`,
            type: 'air_alert',
            name: `Повітряна тривога: ${region.name}`,
            coordinates: coordinates,
            region: region.name,
            status: 'active',
            timestamp: region.changed || new Date().toISOString(),
            confidence: 0.95,
            icon: '⚠️',
            color: '#e74c3c',
            isRegionAlert: true // Прапор, що це тривога по області
        };
        
        // Перевіряємо, чи вже існує така ціль
        const existingTarget = this.targetManager.getTargetById(targetData.id);
        if (existingTarget) {
            this.targetManager.updateTarget(targetData.id, targetData);
        } else {
            this.targetManager.addTarget(targetData);
        }
    }

    addSimulatedTargetsInAlertRegions(activeAlerts) {
        // Додаємо симульовані цілі тільки в області з активною тривогою
        activeAlerts.forEach(region => {
            // Випадково вирішуємо, чи додавати ціль в цю область
            if (Math.random() > 0.5) {
                const mockTargets = getMockTargets(1);
                if (mockTargets.length > 0) {
                    const target = mockTargets[0];
                    
                    // Оновлюємо регіон цілі
                    target.region = region.name;
                    
                    // Генеруємо координати в межах області
                    const regionCoords = this.getRegionCoordinates(region.name);
                    if (regionCoords) {
                        target.coordinates = [
                            regionCoords[0] + (Math.random() - 0.5) * 0.5,
                            regionCoords[1] + (Math.random() - 0.5) * 0.5
                        ];
                    }
                    
                    // Додаємо ціль
                    this.targetManager.addTarget(target);
                }
            }
        });
    }

    updateAlertsDisplay(activeAlerts) {
        // Оновлюємо HUD з інформацією про тривоги
        const alertCount = activeAlerts.length;
        
        updateHUD({
            targetCount: this.targetManager.getTargetCount(),
            alertCount: alertCount,
            lastUpdate: new Date().toLocaleTimeString('uk-UA'),
            connectionStatus: this.getConnectionStatusIcon()
        });
        
        // Оновлюємо бічну панель
        const allTargets = this.targetManager.getAllTargets();
        updateTargetsList(allTargets);
        
        // Оновлюємо шари мапи (підсвічування областей)
        this.updateRegionLayers(activeAlerts);
    }

    updateRegionLayers(activeAlerts) {
        // Оновлюємо шари областей на мапі
        // (цю функцію можна розширити для підсвічування областей)
        
        // Приклад: додавання маркерів для областей з тривогою
        activeAlerts.forEach(region => {
            const coords = this.getRegionCoordinates(region.name);
            if (coords) {
                // Можна додати спеціальні маркери або підсвітити області
                console.log(`Alert in ${region.name} at ${coords}`);
            }
        });
    }

    showAlertNotification(activeAlerts) {
        if (activeAlerts.length === 0) return;
        
        const regionNames = activeAlerts.map(r => r.name).join(', ');
        const message = `Повітряна тривога в ${activeAlerts.length} областях: ${regionNames}`;
        
        showNotification(message, 'warning');
        this.playAlertSound();
    }

    getRegionCoordinates(regionName) {
        const regionCoords = {
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
            'АР Крим': [45.04, 34.00]
        };
        
        // Спроба знайти координати (з урахуванням можливих варіацій назв)
        for (const [key, coords] of Object.entries(regionCoords)) {
            if (regionName.includes(key) || key.includes(regionName)) {
                return coords;
            }
        }
        
        return [49.0, 31.5]; // Центр України як fallback
    }

    updateConnectionStatus(status) {
        this.connectionStatus = status;
        
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = this.getConnectionStatusIcon();
            statusEl.title = `Статус: ${status}`;
        }
        
        updateHUD({
            connectionStatus: this.getConnectionStatusIcon()
        });
    }

    getConnectionStatusIcon() {
        const icons = {
            'connected': '🟢',
            'connecting': '🟡',
            'reconnecting': '🟡',
            'disconnected': '🔴',
            'error': '🔴'
        };
        
        return icons[this.connectionStatus] || '❓';
    }

    playAlertSound() {
        try {
            // Простий звук сповіщення через Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);
            
        } catch (error) {
            console.log('Sound alert not available:', error);
        }
    }

    showLoading(progress) {
        return new Promise(resolve => {
            const progressEl = document.getElementById('loading-progress');
            if (progressEl) {
                progressEl.textContent = `${progress}%`;
            }
            setTimeout(resolve, 50);
        });
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    bindEvents() {
        // Кнопки управління
        document.getElementById('btn-center')?.addEventListener('click', () => {
            this.map.setView([49.0, 31.5], 6);
            showNotification('Мапа центрована на Україні', 'info');
        });

        document.getElementById('btn-simulate')?.addEventListener('click', () => {
            this.toggleSimulation();
        });

        document.getElementById('btn-panel')?.addEventListener('click', () => {
            this.toggleSidePanel();
        });

        document.getElementById('btn-layers')?.addEventListener('click', () => {
            this.showLayersModal();
        });

        document.getElementById('btn-close-panel')?.addEventListener('click', () => {
            this.toggleSidePanel();
        });

        // Нова кнопка для перемикання режимів
        document.getElementById('btn-mode')?.addEventListener('click', () => {
            this.toggleDataMode();
        });

        // PWA встановлення
        let deferredPrompt;
        const installButton = document.getElementById('btn-install');
        
        if (installButton) {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                installButton.style.display = 'block';
                
                installButton.addEventListener('click', async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                            installButton.textContent = '✅ Встановлено';
                            installButton.disabled = true;
                            showNotification('Додаток успішно встановлено', 'success');
                        }
                        deferredPrompt = null;
                    }
                });
            });
        }

        // Модальне вікно шарів
        const layerModal = document.getElementById('modal-layers');
        if (layerModal) {
            const layerOptions = document.querySelectorAll('input[name="map-layer"]');
            
            layerOptions.forEach(option => {
                option.addEventListener('change', (e) => {
                    const layerId = e.target.id.replace('layer-', '');
                    changeBaseLayer(this.map, layerId);
                    layerModal.classList.remove('active');
                    showNotification(`Шар мапи змінено на: ${layerId}`, 'info');
                });
            });

            layerModal.querySelector('.btn-close').addEventListener('click', () => {
                layerModal.classList.remove('active');
            });
        }

        // Hotkeys
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleSidePanel(false);
                const layerModal = document.getElementById('modal-layers');
                if (layerModal) layerModal.classList.remove('active');
            }
            if (e.key === 's' && e.ctrlKey) {
                e.preventDefault();
                this.toggleSimulation();
            }
            if (e.key === 'm' && e.ctrlKey) {
                e.preventDefault();
                this.toggleDataMode();
            }
            if (e.key === 'r' && e.ctrlKey) {
                e.preventDefault();
                this.refreshAlertsData();
            }
        });

        // Оновлення даних при поверненні онлайн
        window.addEventListener('online', () => {
            showNotification('Інтернет-з\'єднання відновлено', 'success');
            if (this.useRealAPI) {
                this.refreshAlertsData();
            }
        });

        window.addEventListener('offline', () => {
            showNotification('Втрачено інтернет-з\'єднання', 'warning');
            this.updateConnectionStatus('disconnected');
        });
    }

    toggleSimulation() {
        const btn = document.getElementById('btn-simulate');
        
        if (this.isSimulating) {
            this.stopSimulation();
            if (btn) {
                btn.textContent = '🚀 Тест';
                btn.style.background = 'linear-gradient(to right, var(--secondary-color), #2c5282)';
            }
            showNotification('Симуляцію зупинено', 'info');
        } else {
            this.startSimulation();
            this.isSimulating = true;
            if (btn) {
                btn.textContent = '⏹️ Стоп';
                btn.style.background = 'linear-gradient(to right, #d84315, #ff5722)';
            }
            showNotification('Симуляцію запущено', 'success');
        }
    }

    startSimulation() {
        // Додаємо симульовані цілі
        const mockTargets = getMockTargets(3);
        mockTargets.forEach(target => {
            this.targetManager.addTarget(target);
        });

        // Запускаємо оновлення
        this.simulationInterval = setInterval(() => {
            this.targetManager.updateTargets();
            
            // Випадково додаємо нові цілі
            if (Math.random() > 0.7) {
                const newTarget = getMockTargets(1)[0];
                this.targetManager.addTarget(newTarget);
            }
            
            // Оновлюємо UI
            this.updateUI();
            
        }, 3000);
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        
        // Видаляємо тільки симульовані цілі, залишаючи тривоги областей
        const allTargets = this.targetManager.getAllTargets();
        allTargets.forEach(target => {
            if (target.id.startsWith('mock_')) {
                this.targetManager.removeTarget(target.id);
            }
        });
        
        this.isSimulating = false;
    }

    toggleDataMode() {
        const modes = ['real', 'mixed', 'mock'];
        const currentIndex = modes.indexOf(this.updateMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.updateMode = modes[nextIndex];
        
        // Оновлюємо кнопку
        const btn = document.getElementById('btn-mode');
        if (btn) {
            const modeLabels = {
                'real': '📡 Реальні дані',
                'mixed': '🔀 Змішаний режим',
                'mock': '🚀 Тестовий режим'
            };
            btn.textContent = modeLabels[this.updateMode];
        }
        
        showNotification(`Режим оновлено: ${this.updateMode}`, 'info');
        
        // Перезапускаємо відповідний режим
        if (this.updateMode === 'real' || this.updateMode === 'mixed') {
            if (this.realDataInterval) {
                clearInterval(this.realDataInterval);
            }
            this.startRealData();
        } else {
            if (this.realDataInterval) {
                clearInterval(this.realDataInterval);
                this.realDataInterval = null;
            }
            this.startMockData();
        }
    }

    startMockData() {
        // Очищаємо попередні цілі
        this.targetManager.clearAllTargets();
        
        // Імітація WebSocket з'єднання з мок-даними
        const stopSimulation = simulateWebSocket((data) => {
            if (data.type === 'target_update') {
                const mockTargets = data.targets || [];
                this.targetManager.updateFromServer(mockTargets);
                this.updateUI();
            }
        });
        
        // Зберігаємо функцію зупинки
        this.stopMockData = stopSimulation;
        
        this.updateConnectionStatus('connected');
        showNotification('Тестовий режим активовано', 'info');
    }

    refreshAlertsData() {
        if (this.useRealAPI) {
            showNotification('Оновлення даних тривог...', 'info');
            this.fetchAndProcessAlerts().catch(error => {
                console.error('Refresh failed:', error);
                showNotification('Помилка оновлення даних', 'error');
            });
        }
    }

    toggleSidePanel(forceState = null) {
        const panel = document.getElementById('side-panel');
        const btn = document.getElementById('btn-panel');
        
        if (!panel || !btn) return;
        
        this.isPanelOpen = forceState !== null ? forceState : !this.isPanelOpen;
        
        if (this.isPanelOpen) {
            panel.classList.add('active');
            btn.textContent = '✖️ Закрити';
            btn.style.background = 'linear-gradient(to right, #d84315, #ff5722)';
            
            // Оновлюємо список при відкритті
            this.updateTargetsList();
        } else {
            panel.classList.remove('active');
            btn.textContent = '📊 Список';
            btn.style.background = 'linear-gradient(to right, var(--secondary-color), #2c5282)';
        }
    }

    updateTargetsList() {
        const allTargets = this.targetManager.getAllTargets();
        updateTargetsList(allTargets);
    }

    updateUI() {
        updateHUD({
            targetCount: this.targetManager.getTargetCount(),
            lastUpdate: new Date().toLocaleTimeString('uk-UA'),
            connectionStatus: this.getConnectionStatusIcon()
        });
        
        this.updateTargetsList();
    }

    showLayersModal() {
        const modal = document.getElementById('modal-layers');
        if (modal) {
            modal.classList.add('active');
        }
    }

    // Очищення ресурсів
    destroy() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        
        if (this.realDataInterval) {
            clearInterval(this.realDataInterval);
        }
        
        if (this.stopMockData) {
            this.stopMockData();
        }
        
        if (this.targetManager) {
            this.targetManager.destroy();
        }
        
        console.log('AirAlertApp destroyed');
    }
}

// Запуск додатку
const app = new AirAlertApp();
document.addEventListener('DOMContentLoaded', () => app.init());

// Робимо додаток доступним глобально для відладки
window.AirAlertApp = app;

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
