export function initPanels() {
    console.log('Panels initialized');
    
    // Ініціалізація списку цілей
    updateTargetsList([]);
}

export function updateTargetsList(targets) {
    const targetsListEl = document.getElementById('targets-list');
    if (!targetsListEl) return;
    
    if (targets.length === 0) {
        targetsListEl.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 10px;">🛡️</div>
                <div style="font-weight: bold; margin-bottom: 5px;">Немає активних цілей</div>
                <div style="color: #bbdefb; font-size: 0.9rem;">Система моніторингу активна</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    targets.forEach(target => {
        const time = new Date(target.timestamp).toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="target-item" data-target-id="${target.id}">
                <div class="target-header">
                    <span style="font-size: 20px; margin-right: 10px;">${target.icon}</span>
                    <div>
                        <div class="target-type">${target.type}</div>
                        <div class="target-time">🕒 ${time} | 📍 ${target.region}</div>
                    </div>
                </div>
                <div class="target-details">
                    <div class="detail-item">
                        <span class="detail-label">Швидкість:</span>
                        <span class="detail-value">${target.speed} км/год</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Висота:</span>
                        <span class="detail-value">${target.altitude} м</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Напрямок:</span>
                        <span class="detail-value">${target.getDirectionArrow ? target.getDirectionArrow() : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відстань:</span>
                        <span class="detail-value">${target.distance} км</span>
                    </div>
                </div>
                <div class="target-status" style="
                    background: ${target.status === 'active' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.2)'};
                    color: ${target.status === 'active' ? '#e74c3c' : '#2ecc71'};
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    margin-top: 8px;
                    text-align: center;
                    font-weight: bold;
                ">
                    ${target.status === 'active' ? '⚡ АКТИВНА' : '✅ НЕАКТИВНА'}
                </div>
            </div>
        `;
    });
    
    targetsListEl.innerHTML = html;
    
    // Додаємо обробники кліку
    document.querySelectorAll('.target-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.targetId;
            // Можна реалізувати центрування на цілі
            console.log('Target clicked:', targetId);
        });
    });
}
