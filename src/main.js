import { initMap, changeBaseLayer } from './map/mapInit.js';
import { initLayers } from './map/layers.js';
import { initRadar } from './map/radarOverlay.js';
import { TargetManager } from './targets/targetManager.js';
import { initHUD, updateHUD } from './ui/hud.js';
import { initPanels } from './ui/panels.js';
import { showNotification } from './ui/notifications.js';
import { simulateWebSocket, getMockTargets } from './net/api.js';

class AirAlertApp {
    constructor() {
        this.map = null;
        this.targetManager = null;
        this.isSimulating = false;
        this.simulationInterval = null;
        this.isPanelOpen = false;
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
            
            await this.showLoading(90);
            
            this.bindEvents();
            this.startMockData();
            
            await this.showLoading(100);
            this.hideLoading();
            
            showNotification('Система моніторингу активована', 'success');
            console.log('Air Alert App initialized successfully');
            
        } catch (error) {
            console.error('App initialization failed:', error);
            showNotification('Помилка ініціалізації', 'error');
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
                    }
                    deferredPrompt = null;
                }
            });
        });

        // Модальне вікно шарів
        const layerModal = document.getElementById('modal-layers');
        const layerOptions = document.querySelectorAll('input[name="map-layer"]');
        
        layerOptions.forEach(option => {
            option.addEventListener('change', (e) => {
                const layerId = e.target.id.replace('layer-', '');
                changeBaseLayer(this.map, layerId);
                layerModal.classList.remove('active');
            });
        });

        layerModal.querySelector('.btn-close').addEventListener('click', () => {
            layerModal.classList.remove('active');
        });

        // Hotkeys
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleSidePanel(false);
                layerModal.classList.remove('active');
            }
            if (e.key === 's' && e.ctrlKey) {
                e.preventDefault();
                this.toggleSimulation();
            }
        });
    }

    toggleSimulation() {
        const btn = document.getElementById('btn-simulate');
        
        if (this.isSimulating) {
            clearInterval(this.simulationInterval);
            this.targetManager.clearAllTargets();
            this.isSimulating = false;
            btn.textContent = '🚀 Тест';
            btn.style.background = 'linear-gradient(to right, var(--secondary-color), #2c5282)';
            showNotification('Симуляцію зупинено', 'info');
        } else {
            this.startSimulation();
            this.isSimulating = true;
            btn.textContent = '⏹️ Стоп';
            btn.style.background = 'linear-gradient(to right, #d84315, #ff5722)';
            showNotification('Симуляцію запущено', 'success');
        }
    }

    startSimulation() {
        // Додаємо початкові цілі
        const mockTargets = getMockTargets(5);
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
            
            // Оновлюємо HUD
            updateHUD({
                targetCount: this.targetManager.getTargetCount(),
                lastUpdate: new Date().toLocaleTimeString('uk-UA')
            });
            
        }, 2000);
    }

    toggleSidePanel(forceState = null) {
        const panel = document.getElementById('side-panel');
        const btn = document.getElementById('btn-panel');
        
        this.isPanelOpen = forceState !== null ? forceState : !this.isPanelOpen;
        
        if (this.isPanelOpen) {
            panel.classList.add('active');
            btn.textContent = '✖️ Закрити';
            btn.style.background = 'linear-gradient(to right, #d84315, #ff5722)';
        } else {
            panel.classList.remove('active');
            btn.textContent = '📊 Список';
            btn.style.background = 'linear-gradient(to right, var(--secondary-color), #2c5282)';
        }
    }

    showLayersModal() {
        document.getElementById('modal-layers').classList.add('active');
    }

    startMockData() {
        // Імітація WebSocket з'єднання
        simulateWebSocket((data) => {
            if (data.type === 'target_update') {
                this.targetManager.updateFromServer(data.targets);
            }
        });
    }
}

// Запуск додатку
const app = new AirAlertApp();
document.addEventListener('DOMContentLoaded', () => app.init());

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
