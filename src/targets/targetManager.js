import { AirTarget } from './targetModel.js';
import { renderTarget, updateTargetMarker, removeTargetMarker } from './targetRenderer.js';
import { TrajectoryManager } from './trajectory.js';

export class TargetManager {
    constructor(map) {
        this.map = map;
        this.targets = new Map(); // Map для швидкого доступу за ID
        this.targetLayer = L.layerGroup().addTo(map);
        this.updateCallbacks = [];
        
        // Ініціалізація менеджера траєкторій
        this.trajectoryManager = new TrajectoryManager(map);
        
        // Конфігурація траєкторій
        this.trajectoryConfig = {
            enabled: true,
            maxPoints: 50,
            showPredictions: false,
            predictionSeconds: 60,
            autoCleanup: true
        };
        
        console.log('TargetManager initialized with trajectory support');
    }
    
    addTarget(targetData) {
        const target = new AirTarget(targetData);
        
        // Додаємо до колекції
        this.targets.set(target.id, target);
        
        // Рендеримо на мапі
        target.marker = renderTarget(target, this.map, this.targetLayer);
        
        // Додаємо обробник кліку
        target.marker.on('click', () => {
            this.onTargetClick(target);
        });
        
        // Додаємо траєкторію, якщо увімкнено
        if (this.trajectoryConfig.enabled) {
            this.addTrajectoryPoint(target);
        }
        
        // Сповіщаємо про додавання
        this.triggerUpdateCallbacks('target_added', target);
        
        return target;
    }
    
    updateTarget(id, updates) {
        const target = this.targets.get(id);
        if (!target) return null;
        
        // Зберігаємо старі дані для траєкторії
        const oldCoordinates = [...target.coordinates];
        const hadActiveTrajectory = this.trajectoryConfig.enabled && 
                                   this.trajectoryManager.trajectories.has(id);
        
        // Оновлюємо властивості
        Object.assign(target, updates);
        
        // Якщо змінилися координати
        if (updates.coordinates) {
            target.updatePosition(updates.coordinates);
            updateTargetMarker(target);
            
            // Оновлюємо траєкторію
            if (this.trajectoryConfig.enabled) {
                this.updateTrajectory(target, oldCoordinates);
            }
        }
        
        this.triggerUpdateCallbacks('target_updated', target);
        return target;
    }
    
    removeTarget(id) {
        const target = this.targets.get(id);
        if (!target) return false;
        
        // Видаляємо маркер
        removeTargetMarker(target, this.targetLayer);
        
        // Видаляємо траєкторію
        if (this.trajectoryConfig.enabled) {
            this.trajectoryManager.removeTrajectory(id);
        }
        
        // Видаляємо з колекції
        this.targets.delete(id);
        
        this.triggerUpdateCallbacks('target_removed', target);
        return true;
    }
    
    updateTargets() {
        // Оновлюємо позиції всіх активних цілей
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
        if (!targetsData || !Array.isArray(targetsData)) {
            console.warn('Invalid targets data for updateFromServer');
            return;
        }
        
        console.log(`Updating from server: ${targetsData.length} targets`);
        
        const updatedIds = new Set();
        
        // Оновлюємо або додаємо цілі з серверних даних
        targetsData.forEach(targetData => {
            updatedIds.add(targetData.id);
            
            if (this.targets.has(targetData.id)) {
                this.updateTarget(targetData.id, targetData);
            } else {
                this.addTarget(targetData);
            }
        });
        
        // Видаляємо цілі, яких більше немає на сервері
        this.targets.forEach((target, id) => {
            if (!updatedIds.has(id) && target.status === 'active') {
                console.log(`Removing target ${id} - no longer on server`);
                this.removeTarget(id);
            }
        });
        
        this.triggerUpdateCallbacks('server_update_complete', {
            updatedCount: targetsData.length,
            removedCount: this.targets.size - updatedIds.size
        });
    }
    
    clearAllTargets() {
        console.log(`Clearing all ${this.targets.size} targets`);
        
        this.targets.forEach(target => {
            removeTargetMarker(target, this.targetLayer);
        });
        
        // Очищаємо всі траєкторії
        if (this.trajectoryConfig.enabled) {
            this.trajectoryManager.clearAll();
        }
        
        this.targets.clear();
        this.triggerUpdateCallbacks('all_targets_cleared');
    }
    
    // Методи для роботи з траєкторіями
    addTrajectoryPoint(target) {
        if (!this.trajectoryConfig.enabled) return;
        
        this.trajectoryManager.updateTrajectory(target.id, target.coordinates, {
            timestamp: Date.now(),
            altitude: target.altitude,
            speed: target.speed,
            heading: target.direction,
            targetType: target.type.toLowerCase().replace(/[^a-z]/g, '_')
        });
    }
    
    updateTrajectory(target, oldCoordinates) {
        if (!this.trajectoryConfig.enabled) return;
        
        // Додаємо нову точку до траєкторії
        this.addTrajectoryPoint(target);
        
        // Оновлюємо прогнози, якщо увімкнено
        if (this.trajectoryConfig.showPredictions) {
            this.trajectoryManager.config.showPredictions = true;
            this.trajectoryManager.config.predictionLength = this.trajectoryConfig.predictionSeconds;
        }
    }
    
    onTargetClick(target) {
        // Показуємо детальну інформацію про ціль
        this.triggerUpdateCallbacks('target_selected', target);
        
        // Центруємо мапу на цілі
        this.map.setView(target.coordinates, this.map.getZoom());
        
        // Показуємо траєкторію, якщо вона є
        if (this.trajectoryConfig.enabled) {
            const trajectory = this.trajectoryManager.trajectories.get(target.id);
            if (trajectory) {
                this.highlightTrajectory(target.id);
            }
        }
    }
    
    highlightTrajectory(targetId) {
        const trajectory = this.trajectoryManager.trajectories.get(targetId);
        if (!trajectory || !trajectory.polyline) return;
        
        // Змінюємо стиль траєкторії для виділення
        const originalStyle = { ...trajectory.style };
        trajectory.updateStyle({
            weight: 4,
            opacity: 1,
            color: '#ffeb3b'
        });
        
        // Повертаємо оригінальний стиль через 3 секунди
        setTimeout(() => {
            trajectory.updateStyle(originalStyle);
        }, 3000);
    }
    
    // Управління траєкторіями
    toggleTrajectories(enabled) {
        this.trajectoryConfig.enabled = enabled;
        
        if (enabled) {
            this.trajectoryManager.setVisible(true);
            console.log('Trajectories enabled');
        } else {
            this.trajectoryManager.setVisible(false);
            console.log('Trajectories disabled');
        }
        
        this.triggerUpdateCallbacks('trajectories_toggled', { enabled });
    }
    
    setTrajectoryConfig(config) {
        this.trajectoryConfig = { ...this.trajectoryConfig, ...config };
        
        if (this.trajectoryManager) {
            if (config.maxPoints !== undefined) {
                this.trajectoryManager.maxPointsPerTrajectory = config.maxPoints;
            }
            
            if (config.showPredictions !== undefined) {
                this.trajectoryManager.config.showPredictions = config.showPredictions;
            }
            
            if (config.autoCleanup !== undefined) {
                this.trajectoryManager.autoCleanup = config.autoCleanup;
            }
        }
        
        console.log('Trajectory config updated:', this.trajectoryConfig);
    }
    
    exportTrajectories() {
        if (!this.trajectoryConfig.enabled) {
            console.warn('Trajectories are disabled');
            return null;
        }
        
        const geoJSON = this.trajectoryManager.exportToGeoJSON();
        console.log('Exported trajectories:', geoJSON);
        return geoJSON;
    }
    
    getTrajectoryStatistics() {
        if (!this.trajectoryConfig.enabled) {
            return null;
        }
        
        return this.trajectoryManager.getStatistics();
    }
    
    // Інші методи доступу
    getTargetCount() {
        return this.targets.size;
    }
    
    getActiveTargets() {
        return Array.from(this.targets.values()).filter(t => t.status === 'active');
    }
    
    getInactiveTargets() {
        return Array.from(this.targets.values()).filter(t => t.status !== 'active');
    }
    
    getTargetById(id) {
        return this.targets.get(id);
    }
    
    getAllTargets() {
        return Array.from(this.targets.values());
    }
    
    getTargetsByType(type) {
        return Array.from(this.targets.values()).filter(t => 
            t.type.toLowerCase().includes(type.toLowerCase())
        );
    }
    
    getTargetsInRegion(region) {
        return Array.from(this.targets.values()).filter(t => 
            t.region.toLowerCase().includes(region.toLowerCase())
        );
    }
    
    // Підписка на оновлення
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }
    
    offUpdate(callback) {
        const index = this.updateCallbacks.indexOf(callback);
        if (index > -1) {
            this.updateCallbacks.splice(index, 1);
        }
    }
    
    triggerUpdateCallbacks(event, data) {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in update callback:', error);
            }
        });
    }
    
    // Деструктор для очищення ресурсів
    destroy() {
        this.clearAllTargets();
        
        if (this.trajectoryManager) {
            this.trajectoryManager.destroy();
        }
        
        if (this.targetLayer) {
            this.map.removeLayer(this.targetLayer);
        }
        
        this.updateCallbacks = [];
        console.log('TargetManager destroyed');
    }
}
