let notificationContainer = null;

export function showNotification(message, type = 'info', duration = 5000) {
    // Створюємо контейнер для сповіщень, якщо ще не існує
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    // Створюємо сповіщення
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Визначаємо іконку за типом
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const icon = icons[type] || icons.info;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="font-size: 20px;">${icon}</div>
            <div style="flex: 1;">
                <div style="font-weight: bold; margin-bottom: 5px;">
                    ${type === 'error' ? 'Помилка' : 
                      type === 'warning' ? 'Увага' : 
                      type === 'success' ? 'Успіх' : 'Інформація'}
                </div>
                <div>${message}</div>
            </div>
            <button class="notification-close" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 20px;
                padding: 0;
                opacity: 0.7;
            ">×</button>
        </div>
    `;
    
    // Стилі сповіщення
    const bgColors = {
        success: 'linear-gradient(135deg, #2e7d32, #4caf50)',
        error: 'linear-gradient(135deg, #c62828, #e53935)',
        warning: 'linear-gradient(135deg, #f57c00, #ff9800)',
        info: 'linear-gradient(135deg, #1565c0, #1976d2)'
    };
    
    notification.style.cssText = `
        background: ${bgColors[type] || bgColors.info};
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        animation: slideIn 0.3s ease-out;
        border-left: 4px solid rgba(255, 255, 255, 0.5);
    `;
    
    // Додаємо CSS для анімації
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .notification.slide-out {
                animation: slideOut 0.3s ease-in forwards;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Додаємо сповіщення в контейнер
    notificationContainer.appendChild(notification);
    
    // Обробник закриття
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        removeNotification(notification);
    });
    
    // Автоматичне закриття
    if (duration > 0) {
        setTimeout(() => {
            removeNotification(notification);
        }, duration);
    }
    
    return notification;
}

function removeNotification(notification) {
    notification.classList.add('slide-out');
    setTimeout(() => {
        if (notification.parentNode === notificationContainer) {
            notificationContainer.removeChild(notification);
        }
        
        // Видаляємо контейнер, якщо сповіщень більше немає
        if (notificationContainer.children.length === 0) {
            notificationContainer.parentNode.removeChild(notificationContainer);
            notificationContainer = null;
        }
    }, 300);
}
