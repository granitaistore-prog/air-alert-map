export class PowerOutageManager {
    constructor(map) {
        this.map = map;
        this.outageLayer = null;
        this.outageMarkers = [];
    }
    
    async showLayer() {
        // Завантажуємо реальні дані
        const outages = await this.fetchOutages();
        
        // Відображаємо на карті
        this.displayOutages(outages);
    }
    
    async fetchOutages() {
        try {
            // Тут має бути виклик реального API
            const response = await fetch('https://ваш-api-світла.com/data');
            return await response.json();
        } catch (error) {
            console.error('Помилка завантаження даних про світло:', error);
            return [];
        }
    }
    
    displayOutages(outages) {
        // Видалити старі маркери
        this.clearLayer();
        
        // Додати нові
        outages.forEach(outage => {
            const marker = this.createOutageMarker(outage);
            this.outageMarkers.push(marker);
            marker.addTo(this.map);
        });
    }
    
    createOutageMarker(outage) {
        // Маркер з кольором за статусом
        const colors = {
            'no_power': '#e74c3c',    // червоний - немає світла
            'partial': '#f39c12',     // жовтий - часткове
            'scheduled': '#3498db',   // синій - за графіком
            'normal': '#2ecc71'       // зелений - є світло
        };
        
        return L.circleMarker(outage.coords, {
            color: colors[outage.status] || '#95a5a6',
            fillColor: colors[outage.status] || '#95a5a6',
            fillOpacity: 0.6,
            radius: 12
        }).bindPopup(this.createPopup(outage));
    }
    
    createPopup(outage) {
        return `
            <div style="min-width: 200px;">
                <strong>${outage.region}</strong><br>
                Статус: ${this.getStatusText(outage.status)}<br>
                Район: ${outage.district}<br>
                Тривалість: ${outage.duration || "невідомо"}<br>
                <small>Оновлено: ${new Date().toLocaleTimeString()}</small>
            </div>
        `;
    }
}
