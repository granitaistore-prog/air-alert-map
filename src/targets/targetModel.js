export class AirTarget {
    constructor(data) {
        this.id = data.id || `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = data.type || 'unknown';
        this.coordinates = data.coordinates || [49.0, 31.5];
        this.speed = data.speed || 0; // км/год
        this.altitude = data.altitude || 0; // метри
        this.direction = data.direction || 0; // градуси
        this.region = data.region || 'Не визначено';
        this.distance = data.distance || 0; // км
        this.timestamp = data.timestamp || new Date().toISOString();
        this.status = data.status || 'active'; // active, destroyed, passed
        this.confidence = data.confidence || 0.8; // впевненість у данних 0-1
        this.vector = data.vector || { dx: 0, dy: 0 };
        this.marker = null;
        this.trajectory = [];
        
        // Визначаємо колір за типом
        this.color = this.getColorByType();
        
        // Визначаємо іконку
        this.icon = this.getIcon();
    }
    
    getColorByType() {
        const colors = {
            'shahed': '#e74c3c',
            'cruise_missile': '#9b59b6',
            'ballistic_missile': '#f39c12',
            'uav': '#3498db',
            'helicopter': '#1abc9c',
            'aircraft': '#95a5a6',
            'unknown': '#7f8c8d'
        };
        
        const typeKey = this.type.toLowerCase().replace(/[^a-z]/g, '_');
        return colors[typeKey] || colors.unknown;
    }
    
    getIcon() {
        const icons = {
            'shahed': '🛸',
            'cruise_missile': '🚀',
            'ballistic_missile': '💥',
            'uav': '📡',
            'helicopter': '🚁',
            'aircraft': '✈️',
            'unknown': '❓'
        };
        
        const typeKey = this.type.toLowerCase().replace(/[^a-z]/g, '_');
        return icons[typeKey] || icons.unknown;
    }
    
    updatePosition(newCoords) {
        // Зберігаємо стару позицію в траєкторії
        this.trajectory.push([...this.coordinates]);
        
        // Обмежуємо довжину траєкторії
        if (this.trajectory.length > 20) {
            this.trajectory.shift();
        }
        
        // Оновлюємо позицію
        this.coordinates = newCoords;
        this.timestamp = new Date().toISOString();
        
        // Оновлюємо вектор руху
        if (this.trajectory.length >= 2) {
            const lastPoint = this.trajectory[this.trajectory.length - 1];
            const prevPoint = this.trajectory[this.trajectory.length - 2];
            
            this.vector.dx = lastPoint[0] - prevPoint[0];
            this.vector.dy = lastPoint[1] - prevPoint[1];
            
            // Розраховуємо напрямок
            this.direction = Math.atan2(this.vector.dy, this.vector.dx) * (180 / Math.PI);
            if (this.direction < 0) this.direction += 360;
        }
    }
    
    getDirectionArrow() {
        const directions = ['Пн ⇑', 'ПнСх ⇗', 'Сх ⇐', 'ПдСх ⇙', 'Пд ⇓', 'ПдЗ ⇘', 'З ⇒', 'ПнЗ ⇖'];
        const index = Math.round(this.direction / 45) % 8;
        return directions[index];
    }
    
    getSpeedCategory() {
        if (this.speed < 100) return 'повільна';
        if (this.speed < 500) return 'середня';
        if (this.speed < 1000) return 'швидка';
        return 'дуже швидка';
    }
    
    getAltitudeCategory() {
        if (this.altitude < 100) return 'дуже низько';
        if (this.altitude < 1000) return 'низько';
        if (this.altitude < 5000) return 'середня';
        return 'високо';
    }
    
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            coordinates: this.coordinates,
            speed: this.speed,
            altitude: this.altitude,
            direction: this.direction,
            region: this.region,
            distance: this.distance,
            timestamp: this.timestamp,
            status: this.status,
            confidence: this.confidence,
            color: this.color,
            icon: this.icon
        };
    }
}
