import { AirTarget } from './targetModel.js';
import { renderTarget, updateTargetMarker, removeTargetMarker } from './targetRenderer.js';

export class TargetManager {
    constructor(map) {
        this.map = map;
        this.targets = new Map(); // Map для швидкого доступу за ID
        this.targetLayer = L.layerGroup().addTo(map);
        this.updateCallbacks = [];
        
        console.log('TargetManager initialized');
    }
    
    addTarget(targetData) {
        const target = new AirTarget(targetData);
        
        // Додаємо до колекції
        this.targets.set(target.id, target);
        
        // Рендеримо на мапі
        target.marker = renderTarget(target, this.map, this.targetLayer);
        
        // Додаємо обробник кліку
        target.marker.on('click', () => {
            this.triggerUpdateCallbacks('target_selected', target);
        });
        
        // Сповіщаємо про додавання
        this.triggerUpdateCallbacks('target_added', target);
        
        return target;
    }
    
    updateTarget(id, updates) {
        const target = this.targets.get(id);
        if (!target) return null;
        
        // Оновлюємо властивості
        Object.assign(target, updates);
        
        // Якщо змінилися координати
        if (updates.coordinates) {
            target.updatePosition(updates.coordinates);
            updateTargetMarker(target);
        }
        
        this.triggerUpdateCallbacks('target_updated', target);
        return target;
    }
    
    removeTarget(id) {
        const target = this.targets.get(id);
        if (!target) return false;
        
        // Видаляємо маркер
        removeTargetMarker(target, this.targetLayer);
        
        // Видаляємо з колекції
        this.targets.delete(id);
        
        this.triggerUpdateCallbacks('target_removed', target);
        return true;
    }
    
    updateTargets() {
        // Оновлюємо позиції всіх цілей
        this.targets.forEach(target => {
            if (target.status === 'active') {
                // Симулюємо рух
                const newLat = target.coordinates[0] + target.vector.dx * 0.1;
                const newLng = target.coordinates[1] + target.vector.dy * 0.1;
                
                this.updateTarget(target.id, {
                    coordinates: [newLat, newLng]
                });
            }
        });
    }
    
    updateFromServer(targetsData) {
        // Оновлюємо цілі з серверних даних
        targetsData.forEach(targetData => {
            if (this.targets.has(targetData.id)) {
                this.updateTarget(targetData.id, targetData);
            } else {
                this.addTarget(targetData);
            }
        });
        
        // Видаляємо цілі, яких більше немає на сервері
        const serverIds = new Set(targetsData.map(t => t.id));
        this.targets.forEach((target, id) => {
            if (!serverIds.has(id) && target.status === 'active') {
                this.removeTarget(id);
            }
        });
    }
    
    clearAllTargets() {
        this.targets.forEach(target => {
            removeTargetMarker(target, this.targetLayer);
        });
        this.targets.clear();
        this.triggerUpdateCallbacks('all_targets_cleared');
    }
    
    getTargetCount() {
        return this.targets.size;
    }
    
    getActiveTargets() {
        return Array.from(this.targets.values()).filter(t => t.status === 'active');
    }
    
    getTargetById(id) {
        return this.targets.get(id);
    }
    
    getAllTargets() {
        return Array.from(this.targets.values());
    }
    
    // Підписка на оновлення
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }
    
    triggerUpdateCallbacks(event, data) {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Callback error:', error);
            }
        });
    }
}
