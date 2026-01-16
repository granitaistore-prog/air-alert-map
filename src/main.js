import { initMap, changeBaseLayer } from './map/mapInit.js';
import { initLayers } from './map/layers.js';
import { initRadar } from './map/radarOverlay.js';
import { TargetManager } from './targets/targetManager.js';
import { initHUD, updateHUD } from './ui/hud.js';
import { initPanels, updateTargetsList, updateAlertsList, updateAPIInfo } from './ui/panels.js';
import { showNotification } from './ui/notifications.js';
import { 
    fetchRealAlerts, 
    fetchRegionsHistory, 
    testAllAPIs, 
    getAPIStats, 
    switchAPI, 
    getAllAPIs,
    startMultiAPIUpdates,
    apiManager
} from './net/api.js';

class AirAlertApp {
    constructor() {
        this.map = null;
        this.targetManager = null;
        this.isPanelOpen = false;
        this.connectionStatus = 'connecting';
        this.activeAlerts = [];
        this.lastUpdate = null;
        this.updateInterval = null;
        this.updateTimer = null;
        this.currentAPI = null;
        this.apiStats = null;
        this.allAPIs = [];
        this.updateFrequency = 30000; // 30 секунд
    }

    async init() {
        try {
            // Ініціалізація компонентів
            await this.showLoading(10, 'Завантаження мапи...');
            
            this.map = initMap();
            await this.showLoading(30, 'Ініціалізація шарів...');
            
            initLayers(this.map);
            await this.showLoading(50, 'Підготовка інтерфейсу...');
            
            initRadar(this.map);
            await this.showLoading(70, 'Підключення до систем тривог...');
            
            this.targetManager = new TargetManager(this.map);
            initHUD();
            initPanels();
            
            // Отримання списку всіх API
            this.allAPIs = getAllAPIs();
            this.currentAPI = apiManager.currentAPI;
            
            await this.showLoading(90, 'Тестування API...');
            
            // Тестування всіх API
            await this.testAPIs();
            
            this.bindEvents();
            
            // Запуск оновлення даних
            this.startDataUpdates();
            
            await this.showLoading(100, 'Завершення ініціалізації...');
            this.hideLoading();
            
            showNotification('Система моніторингу активована', 'success');
            console.log('Air Alert App initialized successfully');
            
            // Оновлення інформації про API
            this.updateAPIInfo();
            
        } catch (error) {
            console.error('App initialization failed:', error);
            showNotification('Помилка ініціалізації', 'error');
        }
    }

    async testAPIs() {
        try {
            showNotification('Тестування джерел даних...', 'info');
            
            const testResults = await testAllAPIs();
            const workingAPIs = testResults.filter(r => r.ok);
            
            if (workingAPIs.length === 0) {
                throw new Error('Жодне API не відповідає');
            }
            
            console.log(`Found ${workingAPIs.length} working APIs`);
            
            // Вибираємо найшвидше API
            const fastestAPI = workingAPIs.reduce((fastest, current) => 
                current.responseTime < fastest.responseTime ? current : fastest
            );
            
            this.currentAPI = this.allAPIs.find(api => api.name === fastestAPI.api);
            this.connectionStatus = 'connected';
            
            showNotification(`Підключено до ${this.currentAPI.name}`, 'success');
            
        } catch (error) {
            console.error('API testing failed:', error);
            showNotification('Помилка тестування API', 'error');
            this.connectionStatus = 'error';
        }
    }

    startDataUpdates() {
        // Зупиняємо попередні інтервали, якщо вони є
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        console.log(`Starting data updates every ${this.updateFrequency/1000} seconds`);
        
        // Перше оновлення
        this.updateAlertData();
        
        // Запускаємо регулярні оновлення
        this.updateInterval = setInterval(() => {
            this.updateAlertData();
        }, this.updateFrequency);
        
        // Таймер для відліку часу до наступного оновлення
        this.startUpdateTimer();
        
        this.connectionStatus = 'connected';
        this.updateConnectionStatus();
    }

    async updateAlertData() {
        try {
            console.log('Updating alert data...');
            
            // Оновлюємо статус підключення
            this.connectionStatus = 'updating';
            this.updateConnectionStatus();
            
            // Отримуємо дані з API
            const alertsData = await fetchRealAlerts();
            
            // Обробляємо дані
            this.processAlertData(alertsData);
            
            // Оновлюємо час останнього оновлення
            this.lastUpdate = new Date();
            
            // Оновлюємо статус
            this.connectionStatus = 'connected';
            this.updateConnectionStatus();
            
            // Оновлюємо статистику API
            this.apiStats = getAPIStats();
            this.updateAPIInfo();
            
        } catch (error) {
            console.error('Failed to update alert data:', error);
            
            this.connectionStatus = 'error';
            this.updateConnectionStatus();
            
            showNotification('Помилка оновлення даних', 'error');
            
            // Спроба переключити на інше API
            await this.switchToNextAPI();
        }
    }

    processAlertData(alertsData) {
        if (!alertsData || !alertsData.states) {
            console.warn('Invalid alert data received');
            return;
        }
        
        console.log(`Processing ${alertsData.states.length} alert states from ${alertsData._source?.api}`);
        
        // Оновлюємо список активних тривог
        const previousAlerts = [...this.activeAlerts];
        this.activeAlerts = alertsData.states.filter(region => region.alert);
        
        // Оновлюємо цілі на мапі
        const targets = convertAlertsToTargets(alertsData);
        this.targetManager.updateFromServer(targets);
        
        // Оновлюємо списки в UI
        updateTargetsList(this.targetManager.getActiveTargets());
        updateAlertsList(this.activeAlerts);
        
        // Оновлюємо HUD
        updateHUD({
            alertCount: this.activeAlerts.length,
            lastUpdate: this.lastUpdate?.toLocaleTimeString('uk-UA') || '--:--',
            connectionStatus: this.getConnectionStatusIcon(),
            apiSource: alertsData._source?.api || 'Невідомо'
        });
        
        // Перевіряємо нові тривоги
        this.checkForNewAlerts(previousAlerts);
        
        // Оновлюємо інформацію про API
        updateAPIInfo({
            currentAPI: alertsData._source?.api,
            responseTime: alertsData._source?.responseTime,
            timestamp: alertsData._source?.timestamp
        });
    }

    checkForNewAlerts(previousAlerts) {
        const previousIds = new Set(previousAlerts.map(a => a.id || a.name));
        const newAlerts = this.activeAlerts.filter(alert => 
            !previousIds.has(alert.id || alert.name)
        );
        
        if (newAlerts.length > 0) {
            this.notifyNewAlerts(newAlerts);
        }
        
        // Перевіряємо зняття тривог
        const currentIds = new Set(this.activeAlerts.map(a => a.id || a.name));
        const removedAlerts = previousAlerts.filter(alert => 
            !currentIds.has(alert.id || alert.name)
        );
        
        if (removedAlerts.length > 0) {
            this.notifyRemovedAlerts(removedAlerts);
        }
    }

    notifyNewAlerts(newAlerts) {
        const regionNames = newAlerts.map(a => a.name).join(', ');
        const message = `Нова повітряна тривога в ${newAlerts.length} регіонах: ${regionNames}`;
        
        showNotification(message, 'warning');
        this.playAlertSound();
        
        // Показуємо повідомлення в UI
        this.showNewAlertNotice(newAlerts);
    }

    notifyRemovedAlerts(removedAlerts) {
        if (removedAlerts.length > 0) {
            const regionNames = removedAlerts.map(a => a.name).join(', ');
            const message = `Тривогу знято в ${removedAlerts.length} регіонах: ${regionNames}`;
            
            showNotification(message, 'info');
        }
    }

    async switchToNextAPI() {
        const currentIndex = this.allAPIs.findIndex(api => api.name === this.currentAPI?.name);
        const nextIndex = (currentIndex + 1) % this.allAPIs.length;
        
        if (nextIndex !== currentIndex) {
            const nextAPI = this.allAPIs[nextIndex];
            showNotification(`Переключення на ${nextAPI.name}...`, 'info');
            
            if (switchAPI(nextAPI.name)) {
                this.currentAPI = nextAPI;
                this.updateAPIInfo();
                
                // Спроба оновити дані з нового API
                setTimeout(() => this.updateAlertData(), 1000);
            }
        }
    }

    startUpdateTimer() {
        let secondsLeft = this.updateFrequency / 1000;
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        this.updateTimer = setInterval(() => {
            secondsLeft--;
            
            if (secondsLeft <= 0) {
                secondsLeft = this.updateFrequency / 1000;
            }
            
            // Оновлюємо таймер в UI
            const timerElement = document.getElementById('update-timer');
            if (timerElement) {
                timerElement.textContent = secondsLeft;
            }
            
        }, 1000);
    }

    updateAPIInfo() {
        const apiInfo = {
            current: this.currentAPI?.name || 'Невідомо',
            allAPIs: this.allAPIs.map(api => ({
                name: api.name,
                active: api === this.currentAPI,
                priority: api.priority
            })),
            stats: this.apiStats
        };
        
        // Оновлення UI з інформацією про API
        const apiInfoElement = document.getElementById('api-info');
        if (apiInfoElement) {
            apiInfoElement.innerHTML = `
                <strong>Поточне API:</strong> ${apiInfo.current}<br>
                <strong>Доступні:</strong> ${apiInfo.allAPIs.map(a => a.name).join(', ')}
            `;
        }
        
        // Оновлення джерела даних у статусі
        const apiSourceElement = document.getElementById('api-source');
        if (apiSourceElement) {
            apiSourceElement.textContent = apiInfo.current;
        }
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        const iconElement = document.getElementById('connection-icon');
        
        if (!statusElement || !iconElement) return;
        
        const statusConfig = {
            'connected': { text: 'Підключено', icon: '📡', color: '#2ecc71' },
            'connecting': { text: 'Підключення...', icon: '🔄', color: '#f39c12' },
            'updating': { text: 'Оновлення...', icon: '⏳', color: '#3498db' },
            'error': { text: 'Помилка', icon: '❌', color: '#e74c3c' },
            'disconnected': { text: 'Відключено', icon: '📴', color: '#95a5a6' }
        };
        
        const config = statusConfig[this.connectionStatus] || statusConfig.disconnected;
        
        statusElement.textContent = config.text;
        statusElement.style.color = config.color;
        iconElement.textContent = config.icon;
    }

    getConnectionStatusIcon() {
        const icons = {
            'connected': '🟢',
            'connecting': '🟡',
            'updating': '🔵',
            'error': '🔴',
            'disconnected': '⚫'
        };
        
        return icons[this.connectionStatus] || '❓';
    }

    showNewAlertNotice(alerts) {
        const noticeElement = document.getElementById('new-alert-notice');
        const textElement = document.getElementById('new-alert-text');
        
        if (noticeElement && textElement) {
            const regionNames = alerts.map(a => a.name).join(', ');
            textElement.textContent = `Нова тривога в ${alerts.length} регіонах: ${regionNames}`;
            
            noticeElement.style.display = 'flex';
            
            // Автоматично ховаємо через 10 секунд
            setTimeout(() => {
                noticeElement.style.display = 'none';
            }, 10000);
        }
    }

    playAlertSound() {
        // Можна додати звукові сповіщення
        console.log('Playing alert sound');
    }

    showLoading(progress, message) {
        return new Promise(resolve => {
            const progressElement = document.getElementById('loading-progress');
            const fillElement = document.getElementById('progress-fill');
            const stepElement = document.getElementById('loading-step');
            
            if (progressElement) progressElement.textContent = `${progress}%`;
            if (fillElement) fillElement.style.width = `${progress}%`;
            if (stepElement && message) stepElement.textContent = message;
            
            setTimeout(resolve, 50);
        });
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    bindEvents() {
        // Кнопки управління
        document.getElementById('btn-center')?.addEventListener('click', () => {
            this.map.setView([49.0, 31.5], 6);
            showNotification('Мапа центрована на Україні', 'info');
        });

        document.getElementById('btn-show-alerts')?.addEventListener('click', () => {
            this.toggleAlertsPanel();
        });

        document.getElementById('btn-layers')?.addEventListener('click', () => {
            this.showLayersModal();
        });

        document.getElementById('btn-location')?.addEventListener('click', () => {
            this.getUserLocation();
        });

        document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        document.getElementById('btn-refresh')?.addEventListener('click', () => {
            this.manualUpdate();
        });

        document.getElementById('btn-close-panel')?.addEventListener('click', () => {
            this.toggleAlertsPanel(false);
        });

        document.getElementById('btn-manual-update')?.addEventListener('click', () => {
            this.manualUpdate();
        });

        // PWA встановлення
        let deferredPrompt;
        const installButton = document.getElementById('btn-install');
        
        if (installButton) {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                installButton.style.display = 'flex';
                
                installButton.addEventListener('click', async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                            installButton.innerHTML = '✅ Встановлено';
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
                    showNotification(`Шар мапи змінено`, 'info');
                });
            });

            layerModal.querySelectorAll('.btn-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    layerModal.classList.remove('active');
                });
            });
        }

        // Сповіщення
        document.getElementById('btn-show-new-alert')?.addEventListener('click', () => {
            this.toggleAlertsPanel(true);
        });

        document.getElementById('btn-dismiss-alert')?.addEventListener('click', () => {
            document.getElementById('new-alert-notice').style.display = 'none';
        });

        document.getElementById('btn-dismiss-offline')?.addEventListener('click', () => {
            document.getElementById('offline-notice').style.display = 'none';
        });

        // Hotkeys
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleAlertsPanel(false);
                document.getElementById('modal-layers')?.classList.remove('active');
                document.getElementById('modal-region-info')?.classList.remove('active');
            }
            if (e.key === 'r' && e.ctrlKey) {
                e.preventDefault();
                this.manualUpdate();
            }
            if (e.key === 'a' && e.ctrlKey) {
                e.preventDefault();
                this.toggleAlertsPanel();
            }
            if (e.key === 'f' && e.ctrlKey) {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });

        // Офлайн/онлайн
        window.addEventListener('online', () => {
            showNotification('Інтернет-з\'єднання відновлено', 'success');
            this.connectionStatus = 'connected';
            this.updateConnectionStatus();
            this.startDataUpdates();
        });

        window.addEventListener('offline', () => {
            showNotification('Втрачено інтернет-з\'єднання', 'warning');
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus();
            
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
            }
        });
    }

    toggleAlertsPanel(forceState = null) {
        const panel = document.getElementById('alerts-panel');
        const btn = document.getElementById('btn-show-alerts');
        
        if (!panel || !btn) return;
        
        this.isPanelOpen = forceState !== null ? forceState : !this.isPanelOpen;
        
        if (this.isPanelOpen) {
            panel.classList.add('active');
            btn.textContent = '✖️ Закрити';
            btn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            
            // Оновлюємо список при відкритті
            updateAlertsList(this.activeAlerts);
        } else {
            panel.classList.remove('active');
            btn.textContent = '📢 Тривоги';
            btn.style.background = 'linear-gradient(135deg, var(--secondary-color), #2c5282)';
        }
    }

    showLayersModal() {
        const modal = document.getElementById('modal-layers');
        if (modal) {
            modal.classList.add('active');
        }
    }

    async getUserLocation() {
        if (!navigator.geolocation) {
            showNotification('Геолокація не підтримується', 'error');
            return;
        }
        
        showNotification('Визначення вашого місцезнаходження...', 'info');
        
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude } = position.coords;
            this.map.setView([latitude, longitude], 10);
            
            showNotification('Місцезнаходження визначено', 'success');
            
        } catch (error) {
            console.error('Geolocation error:', error);
            showNotification('Не вдалося визначити місцезнаходження', 'error');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Fullscreen error:', err);
                showNotification('Помилка повноекранного режиму', 'error');
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    manualUpdate() {
        showNotification('Оновлення даних...', 'info');
        this.updateAlertData();
    }

    // Деструктор для очищення ресурсів
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        if (this.targetManager) {
            this.targetManager.destroy();
        }
        
        console.log('AirAlertApp destroyed');
    }
}

// Допоміжні функції
function convertAlertsToTargets(alertsData) {
    if (!alertsData || !alertsData.states) {
        return [];
    }
    
    const targets = [];
    const regionCoordinates = getRegionCoordinatesMap();
    
    alertsData.states.forEach(region => {
        if (region.alert === true || region.alert === 1 || region.status === 'alert') {
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
                apiSource: alertsData._source?.api || 'unknown',
                regionId: region.id
            });
        }
    });
    
    return targets;
}

function getRegionCoordinatesMap() {
    // Повертає мапу координат (як у попередній версії)
    // ...
    return {};
}

// Запуск додатку
const app = new AirAlertApp();
document.addEventListener('DOMContentLoaded', () => app.init());

// Робимо додаток доступним глобально для відладки
window.AirAlertApp = app;
