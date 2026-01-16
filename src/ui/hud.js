export function initHUD() {
    console.log('HUD initialized');
    
    // Оновлюємо час
    updateTime();
    setInterval(updateTime, 60000);
}

export function updateHUD(data = {}) {
    const {
        targetCount = 0,
        lastUpdate = '--:--',
        connectionStatus = '🟢'
    } = data;
    
    // Оновлюємо відображення
    const targetCountEl = document.getElementById('target-count');
    const lastUpdateEl = document.getElementById('last-update');
    const connectionStatusEl = document.getElementById('connection-status');
    
    if (targetCountEl) {
        targetCountEl.textContent = targetCount;
        
        // Змінюємо колір залежно від кількості
        if (targetCount === 0) {
            targetCountEl.style.color = '#2ecc71';
        } else if (targetCount < 5) {
            targetCountEl.style.color = '#f39c12';
        } else {
            targetCountEl.style.color = '#e74c3c';
            targetCountEl.style.animation = 'pulse 0.8s infinite';
        }
    }
    
    if (lastUpdateEl) {
        lastUpdateEl.textContent = lastUpdate;
    }
    
    if (connectionStatusEl) {
        connectionStatusEl.textContent = connectionStatus;
        
        // Змінюємо колір статусу
        if (connectionStatus === '🟢') {
            connectionStatusEl.style.color = '#2ecc71';
        } else if (connectionStatus === '🟡') {
            connectionStatusEl.style.color = '#f39c12';
        } else {
            connectionStatusEl.style.color = '#e74c3c';
        }
    }
}

function updateTime() {
    const timeEl = document.getElementById('last-update');
    if (timeEl && timeEl.textContent === '--:--') {
        timeEl.textContent = new Date().toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
