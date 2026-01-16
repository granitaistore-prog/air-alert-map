// Мок-дані для тестування
export function getMockTargets(count = 5) {
    const targetTypes = [
        { type: 'Shahed-136', speed: 180, altitude: 800, icon: '🛸' },
        { type: 'Крилата ракета', speed: 900, altitude: 1500, icon: '🚀' },
        { type: 'БПЛА Орлан', speed: 90, altitude: 500, icon: '📡' },
        { type: 'Тактична ракета', speed: 1200, altitude: 3000, icon: '💥' }
    ];
    
    const regions = [
        'Київська область', 'Харківська область', 'Одеська область',
        'Львівська область', 'Дніпропетровська область', 'Запорізька область',
        'Вінницька область', 'Житомирська область'
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
            coordinates: [lat, lng],
            speed: type.speed + Math.random() * 50 - 25,
            altitude: type.altitude + Math.random() * 200 - 100,
            direction: Math.random() * 360,
            region: region,
            distance: Math.floor(Math.random() * 200) + 50,
            timestamp: new Date().toISOString(),
            status: 'active',
            confidence: 0.7 + Math.random() * 0.3,
            vector: {
                dx: (Math.random() - 0.5) * 0.02,
                dy: (Math.random() - 0.5) * 0.02
            }
        });
    }
    
    return targets;
}

// Імітація WebSocket з'єднання
export function simulateWebSocket(callback) {
    console.log('WebSocket simulation started');
    
    let isConnected = true;
    let messageCount = 0;
    
    // Імітація періодичних оновлень
    const interval = setInterval(() => {
        if (!isConnected) {
            clearInterval(interval);
            return;
        }
        
        messageCount++;
        
        // Випадково генеруємо оновлення
        if (Math.random() > 0.3) {
            const targetCount = Math.floor(Math.random() * 3);
            const targets = getMockTargets(targetCount);
            
            callback({
                type: 'target_update',
                timestamp: new Date().toISOString(),
                targets: targets,
                messageId: messageCount
            });
        }
        
        // Випадково імітуємо зміну статусу з'єднання
        if (Math.random() > 0.9) {
            isConnected = false;
            callback({
                type: 'connection_status',
                status: 'disconnected',
                timestamp: new Date().toISOString()
            });
            
            // Відновлюємо через 5 секунд
            setTimeout(() => {
                isConnected = true;
                callback({
                    type: 'connection_status',
                    status: 'connected',
                    timestamp: new Date().toISOString()
                });
            }, 5000);
        }
        
    }, 3000 + Math.random() * 4000); // Випадковий інтервал 3-7 секунд
    
    // Повертаємо функцію для зупинки
    return () => {
        clearInterval(interval);
        console.log('WebSocket simulation stopped');
    };
}

// Функція для отримання реальних даних (заглушка)
export async function fetchRealData() {
    try {
        // Тут буде реальний запит до API
        // const response = await fetch('https://api.example.com/targets');
        // return await response.json();
        
        console.log('Real data fetch would happen here');
        return getMockTargets(3);
    } catch (error) {
        console.error('Failed to fetch real data:', error);
        return [];
    }
}
