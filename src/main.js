import { initMap, changeBaseLayer } from './map/mapInit.js';
import { initLayers } from './map/layers.js';
import { initRadar } from './map/radarOverlay.js';
import { TargetManager } from './targets/targetManager.js';
import { initHUD, updateHUD } from './ui/hud.js';
import { initPanels, updateTargetsList } from './ui/panels.js';
import { showNotification } from './ui/notifications.js';
import { simulateWebSocket, getMockTargets } from './net/api.js';
import { createWebSocketManager } from './net/websocket.js';

class AirAlertApp {
    constructor() {
        this.map = null;
        this.targetManager = null;
        this.trajectoryManager = null;
        this.wsManager = null;
        this.isSimulating = false;
        this.simulationInterval = null;
        this.isPanelOpen = false;
        this.connectionStatus = 'disconnected';
        this.useMockServer = true; // Змініть на false для реального сервера
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
            
            // Ініціалізація WebSocket
            await this.initWebSocket();
            
            await this.showLoading(90);
            
            this.bindEvents();
            
            // Якщо не використовуємо реальний сервер, запускаємо мок-дані
            if (this.useMockServer) {
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
            if (this.useMockServer) {
                // Використовуємо мок-сервер для тестування
                console.log('Using mock WebSocket server');
                return;
            }
            
            // Для реального сервера (розкоментуйте та налаштуйте URL)
            /*
            this.wsManager = createWebSocketManager({
                url: 'wss://your-real-api.com/air-alert',
                autoConnect: true,
                maxReconnectAttempts: 10,
                reconnectInterval: 3000
            });
            
            // Налаштування обробників подій WebSocket
            this.setupWebSocketHandlers();
            */
            
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
            showNotification('Помилка підключення до сервера', 'error');
        }
    }

    setupWebSocketHandlers() {
        if (!this.wsManager) return;
        
        // Обробка оновлень цілей
        this.wsManager.onMessage('target_update', (data, message) => {
            console.log('Target update received:', data.targets?.length || 0, 'targets');
            this.handleTargetUpdate(data.targets || []);
        });
        
        // Обробка статусу системи
        this.wsManager.onMessage('system_status', (data) => {
            console.log('System status:', data);
            this.updateSystemStatus(data);
        });
        
        // Обробка зміни статусу з'єднання
        this.wsManager.onStatusChange((status) => {
            console.log('WebSocket status changed:', status);
            this.connectionStatus = status;
            this.updateConnectionStatus(status);
            
            // Показуємо сповіщення про зміну статусу
            const statusMessages = {
                'connected': 'Підключено до сервера моніторингу',
                'disconnected': 'Відключено від сервера',
                'reconnecting': 'Перепідключення до сервера...',
                'error': 'Помилка з\'єднання з сервером'
            };
            
            if (statusMessages[status]) {
                showNotification(statusMessages[status], 
                    status === 'connected' ? 'success' : 
                    status === 'error' ? 'error' : 'warning');
            }
        });
        
        // Обробка загальних повідомлень
        this.wsManager.on('message', (message) => {
            console.log('WebSocket message:', message.type, message);
        });
        
        // Обробка помилок
        this.wsManager.on('error', (error) => {
            console.error('WebSocket error:', error);
            showNotification('Помилка з\'єднання з сервером', 'error');
        });
        
        // Обробка відключення
        this.wsManager.on('disconnected', (event) => {
            console.log('WebSocket disconnected:', event);
            if (event.code !== 1000) { // Не нормальне закриття
                showNotification('Втрачено з\'єднання з сервером', 'warning');
            }
        });
    }

    handleTargetUpdate(targetsData) {
        if (!targetsData || !Array.isArray(targetsData)) {
            console.warn('Invalid targets data received:', targetsData);
            return;
        }
        
        console.log(`Processing ${targetsData.length} targets from server`);
        
        // Оновлюємо цілі на мапі
        this.targetManager.updateFromServer(targetsData);
        
        // Оновлюємо список цілей в бічній панелі
        const activeTargets = this.targetManager.getActiveTargets();
        updateTargetsList(activeTargets);
        
        // Оновлюємо HUD
        updateHUD({
            targetCount: this.targetManager.getTargetCount(),
            lastUpdate: new Date().toLocaleTimeString('uk-UA'),
            connectionStatus: this.getConnectionStatusIcon()
        });
        
        // Показуємо сповіщення про нові цілі
        if (targetsData.length > 0) {
            this.showTargetUpdateNotification(targetsData);
        }
    }

    updateSystemStatus(statusData) {
        // Оновлюємо статус системи в HUD
        updateHUD({
            connectionStatus: this.getConnectionStatusIcon(),
            lastUpdate: new Date(statusData.lastUpdate || Date.now()).toLocaleTimeString('uk-UA')
        });
        
        // Додаткова логіка обробки статусу системи
        console.log('System status updated:', statusData);
    }

    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;
        
        statusEl.textContent = this.getConnectionStatusIcon();
        statusEl.title = `Статус: ${status}`;
        
        // Оновлюємо HUD
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

    showTargetUpdateNotification(targetsData) {
        const newTargets = targetsData.filter(target => 
            target.status === 'active' && 
            (!target.timestamp || Date.now() - new Date(target.timestamp).getTime() < 60000)
        );
        
        if (newTargets.length > 0) {
            const targetTypes = [...new Set(newTargets.map(t => t.type))];
            const message = `Виявлено ${newTargets.length} нових цілей: ${targetTypes.join(', ')}`;
            
            showNotification(message, 'warning');
            
            // Відтворюємо звукове сповіщення (якщо є)
            this.playAlertSound();
        }
    }

    playAlertSound() {
        // Додайте логіку для відтворення звукового сповіщення
        try {
            const audio = new Audio('/assets/sounds/alert.mp3');
            audio.volume = 0.3;
            audio.play().catch(e => console.log('Audio play failed:', e));
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
        document.getElementById('btn-center').addEventListener('click', () => {
            this.map.setView([49.0, 31.5], 6);
            showNotification('Мапа центрована на Україні', 'info');
        });

        document.getElementById('btn-simulate').addEventListener('click', () => {
            this.toggleSimulation();
        });

        document.getElementById('btn-panel').addEventListener('click', () => {
            this.toggleSidePanel();
        });

        document.getElementById('btn-layers').addEventListener('click', () => {
            this.showLayersModal();
        });

        document.getElementById('btn-close-panel').addEventListener('click', () => {
            this.toggleSidePanel();
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
            if (e.key === 'r' && e.ctrlKey) {
                e.preventDefault();
                this.reconnectWebSocket();
            }
        });

        // Слухач подій WebSocket статусу для UI
        window.addEventListener('websocket-status', (event) => {
            this.connectionStatus = event.detail.status;
            this.updateConnectionStatus(event.detail.status);
        });
    }

    toggleSimulation() {
        const btn = document.getElementById('btn-simulate');
        
        if (this.isSimulating) {
            clearInterval(this.simulationInterval);
            this.targetManager.clearAllTargets();
            this.isSimulating = false;
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
        // Додаємо початкові цілі
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
            
            // Випадково видаляємо старі цілі
            if (Math.random() > 0.8 && this.targetManager.getTargetCount() > 2) {
                const targets = this.targetManager.getAllTargets();
                const targetToRemove = targets[Math.floor(Math.random() * targets.length)];
                if (targetToRemove) {
                    this.targetManager.removeTarget(targetToRemove.id);
                }
            }
            
            // Оновлюємо HUD та список цілей
            updateHUD({
                targetCount: this.targetManager.getTargetCount(),
                lastUpdate: new Date().toLocaleTimeString('uk-UA'),
                connectionStatus: this.getConnectionStatusIcon()
            });
            
            const activeTargets = this.targetManager.getActiveTargets();
            updateTargetsList(activeTargets);
            
        }, 3000); // Оновлення кожні 3 секунди
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
            
            // Оновлюємо список цілей при відкритті панелі
            const activeTargets = this.targetManager.getActiveTargets();
            updateTargetsList(activeTargets);
        } else {
            panel.classList.remove('active');
            btn.textContent = '📊 Список';
            btn.style.background = 'linear-gradient(to right, var(--secondary-color), #2c5282)';
        }
    }

    showLayersModal() {
        const modal = document.getElementById('modal-layers');
        if (modal) {
            modal.classList.add('active');
        }
    }

    startMockData() {
        // Імітація WebSocket з'єднання з мок-даними
        simulateWebSocket((data) => {
            if (data.type === 'target_update') {
                this.handleTargetUpdate(data.targets || []);
            }
        });
    }

    reconnectWebSocket() {
        if (this.wsManager) {
            showNotification('Перепідключення до сервера...', 'info');
            this.wsManager.disconnect();
            
            // Запускаємо перепідключення через 1 секунду
            setTimeout(() => {
                if (this.wsManager.connect) {
                    this.wsManager.connect(this.wsManager.url).catch(error => {
                        console.error('Reconnection failed:', error);
                    });
                }
            }, 1000);
        } else {
            showNotification('WebSocket не ініціалізовано', 'warning');
        }
    }

    // Додаткові методи для управління WebSocket
    sendWebSocketMessage(type, data = {}) {
        if (this.wsManager && this.wsManager.send) {
            return this.wsManager.send(type, data);
        }
        return false;
    }

    getWebSocketStatus() {
        return this.connectionStatus;
    }

    // Метод для зміни режиму (мок/реальний сервер)
    setServerMode(useMock) {
        this.useMockServer = useMock;
        
        if (this.wsManager) {
            this.wsManager.disconnect();
            this.wsManager = null;
        }
        
        if (!useMock) {
            this.initWebSocket();
        } else {
            showNotification('Режим тестування активовано', 'info');
        }
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
                
                // Оновлення Service Worker
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New Service Worker found:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showNotification('Доступне оновлення додатку', 'info');
                        }
                    });
                });
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// Обробка офлайн/онлайн статусу
window.addEventListener('online', () => {
    showNotification('Інтернет-з\'єднання відновлено', 'success');
    if (app.wsManager && app.getWebSocketStatus() === 'disconnected') {
        app.reconnectWebSocket();
    }
});

window.addEventListener('offline', () => {
    showNotification('Втрачено інтернет-з\'єднання', 'warning');
});
