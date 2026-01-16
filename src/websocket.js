/**
 * WebSocket менеджер для отримання даних про цілі в реальному часі
 */

export class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 3000; // 3 секунди
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.eventListeners = new Map();
        this.pingInterval = null;
        
        // Статуси з'єднання
        this.STATUS = {
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            DISCONNECTED: 'disconnected',
            ERROR: 'error',
            RECONNECTING: 'reconnecting'
        };
        
        this.currentStatus = this.STATUS.DISCONNECTED;
    }

    /**
     * Підключення до WebSocket сервера
     */
    connect(url) {
        return new Promise((resolve, reject) => {
            try {
                this.updateStatus(this.STATUS.CONNECTING);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = (event) => {
                    console.log('WebSocket connected:', url);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.updateStatus(this.STATUS.CONNECTED);
                    this.startPing();
                    this.triggerEvent('connected', event);
                    resolve(event);
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.updateStatus(this.STATUS.ERROR);
                    this.triggerEvent('error', error);
                    reject(error);
                };
                
                this.ws.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.updateStatus(this.STATUS.DISCONNECTED);
                    this.stopPing();
                    this.triggerEvent('disconnected', event);
                    
                    // Автоматичне перепідключення
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnect(url);
                    }
                };
                
            } catch (error) {
                console.error('WebSocket connection failed:', error);
                reject(error);
            }
        });
    }
    
    /**
     * Автоматичне перепідключення
     */
    reconnect(url) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        this.updateStatus(this.STATUS.RECONNECTING);
        
        console.log(`Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);
        
        setTimeout(() => {
            this.connect(url).catch(() => {
                console.log('Reconnection failed');
            });
        }, this.reconnectInterval);
    }
    
    /**
     * Відправка повідомлення
     */
    send(type, data = {}) {
        if (!this.isConnected || !this.ws) {
            console.error('Cannot send: WebSocket not connected');
            return false;
        }
        
        try {
            const message = {
                type: type,
                timestamp: new Date().toISOString(),
                data: data
            };
            
            this.ws.send(JSON.stringify(message));
            console.log('Message sent:', type);
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }
    
    /**
     * Обробка вхідних повідомлень
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            console.log('Message received:', message.type, message);
            
            // Виклик обробників за типом
            const handlers = this.messageHandlers.get(message.type) || [];
            handlers.forEach(handler => {
                try {
                    handler(message.data, message);
                } catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
            
            // Загальні обробники
            this.triggerEvent('message', message);
            
        } catch (error) {
            console.error('Error parsing message:', error, event.data);
        }
    }
    
    /**
     * Реєстрація обробника для певного типу повідомлень
     */
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }
    
    /**
     * Видалення обробника
     */
    offMessage(type, handler) {
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    /**
     * Реєстрація слухача подій
     */
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }
    
    /**
     * Видалення слухача подій
     */
    off(event, listener) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * Виклик подій
     */
    triggerEvent(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('Error in event listener:', error);
            }
        });
    }
    
    /**
     * Запуск ping-ів для підтримки з'єднання
     */
    startPing() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping', { timestamp: Date.now() });
            }
        }, 30000); // Кожні 30 секунд
    }
    
    /**
     * Зупинка ping-ів
     */
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    /**
     * Оновлення статусу з'єднання
     */
    updateStatus(status) {
        this.currentStatus = status;
        this.triggerEvent('statusChange', status);
        
        // Автоматична розсилка статусу в UI
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('websocket-status', {
                detail: { status }
            });
            window.dispatchEvent(event);
        }
    }
    
    /**
     * Отримання поточного статусу
     */
    getStatus() {
        return this.currentStatus;
    }
    
    /**
     * Перевірка підключення
     */
    isConnected() {
        return this.isConnected;
    }
    
    /**
     * Відключення
     */
    disconnect(code = 1000, reason = 'Normal closure') {
        if (this.ws) {
            this.ws.close(code, reason);
        }
        this.isConnected = false;
        this.stopPing();
        this.updateStatus(this.STATUS.DISCONNECTED);
    }
    
    /**
     * Мок-сервер для тестування
     */
    static createMockServer() {
        console.log('Creating mock WebSocket server...');
        
        // Імітація серверних відповідей
        const mockResponses = {
            'target_update': () => ({
                type: 'target_update',
                timestamp: new Date().toISOString(),
                data: {
                    targets: generateMockTargets(),
                    region: 'all',
                    version: '1.0.0'
                }
            }),
            
            'system_status': () => ({
                type: 'system_status',
                timestamp: new Date().toISOString(),
                data: {
                    uptime: Math.floor(Math.random() * 10000),
                    activeConnections: Math.floor(Math.random() * 100),
                    lastUpdate: new Date().toISOString()
                }
            }),
            
            'ping': (data) => ({
                type: 'pong',
                timestamp: new Date().toISOString(),
                data: {
                    originalTimestamp: data.timestamp,
                    serverTime: Date.now(),
                    latency: Date.now() - data.timestamp
                }
            })
        };
        
        function generateMockTargets() {
            const types = ['shahed', 'cruise_missile', 'ballistic_missile', 'uav'];
            const regions = ['Київська', 'Харківська', 'Одеська', 'Львівська', 'Дніпропетровська'];
            
            const count = Math.floor(Math.random() * 5) + 1;
            const targets = [];
            
            for (let i = 0; i < count; i++) {
                targets.push({
                    id: `mock_${Date.now()}_${i}`,
                    type: types[Math.floor(Math.random() * types.length)],
                    coordinates: [
                        48.0 + Math.random() * 5.0,
                        23.0 + Math.random() * 16.0
                    ],
                    speed: 100 + Math.random() * 900,
                    altitude: 500 + Math.random() * 3000,
                    direction: Math.random() * 360,
                    region: regions[Math.floor(Math.random() * regions.length)],
                    status: 'active',
                    confidence: 0.7 + Math.random() * 0.3,
                    timestamp: new Date().toISOString()
                });
            }
            
            return targets;
        }
        
        return {
            // Імітація відповіді сервера
            simulateResponse: function(type, data = {}) {
                const responseFn = mockResponses[type];
                if (responseFn) {
                    return responseFn(data);
                }
                return null;
            },
            
            // Генерація випадкових оновлень
            startAutoUpdates: function(callback, interval = 5000) {
                const intervalId = setInterval(() => {
                    if (Math.random() > 0.3) {
                        const update = mockResponses['target_update']();
                        callback(update);
                    }
                }, interval);
                
                return () => clearInterval(intervalId);
            }
        };
    }
}

/**
 * Фабрика для створення WebSocket менеджера
 */
export function createWebSocketManager(config = {}) {
    const manager = new WebSocketManager();
    
    // Конфігурація за замовчуванням
    const defaultConfig = {
        url: 'wss://api.example.com/air-alert',
        autoConnect: true,
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectInterval: 3000
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    
    // Застосування конфігурації
    manager.maxReconnectAttempts = finalConfig.maxReconnectAttempts;
    manager.reconnectInterval = finalConfig.reconnectInterval;
    
    // Автоматичне підключення
    if (finalConfig.autoConnect && finalConfig.url) {
        setTimeout(() => {
            manager.connect(finalConfig.url).catch(error => {
                console.error('Auto-connect failed:', error);
            });
        }, 1000);
    }
    
    return manager;
}

/**
 * Хук для React/Vue (якщо потрібно)
 */
export function useWebSocket(url, options = {}) {
    const manager = createWebSocketManager({ url, ...options });
    
    return {
        manager,
        connect: () => manager.connect(url),
        disconnect: () => manager.disconnect(),
        send: (type, data) => manager.send(type, data),
        onMessage: (type, handler) => manager.onMessage(type, handler),
        onStatusChange: (handler) => manager.on('statusChange', handler),
        getStatus: () => manager.getStatus()
    };
}

// Експорт за замовчуванням
export default WebSocketManager;
