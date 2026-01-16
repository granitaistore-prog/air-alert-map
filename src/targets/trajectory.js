/**
 * Модуль для роботи з траєкторіями цілей
 */

export class Trajectory {
    constructor(targetId, maxPoints = 50) {
        this.targetId = targetId;
        this.maxPoints = maxPoints;
        this.points = []; // Масив точок [lat, lng, timestamp, altitude, speed]
        this.polyline = null;
        this.isVisible = true;
        this.style = {
            color: '#2ecc71',
            weight: 2,
            opacity: 0.7,
            dashArray: '5, 10',
            lineCap: 'round',
            lineJoin: 'round'
        };
    }
    
    /**
     * Додавання нової точки до траєкторії
     * @param {Array} coordinates - [lat, lng]
     * @param {Object} metadata - Додаткові дані
     */
    addPoint(coordinates, metadata = {}) {
        const point = {
            coordinates: [...coordinates],
            timestamp: metadata.timestamp || Date.now(),
            altitude: metadata.altitude || 0,
            speed: metadata.speed || 0,
            heading: metadata.heading || 0
        };
        
        this.points.push(point);
        
        // Обмежуємо кількість точок
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
        
        return point;
    }
    
    /**
     * Оновлення стилю траєкторії
     */
    updateStyle(style = {}) {
        this.style = { ...this.style, ...style };
        
        if (this.polyline) {
            this.polyline.setStyle(this.style);
        }
    }
    
    /**
     * Зміна кольору залежно від типу цілі
     */
    setColorByTargetType(targetType) {
        const colorMap = {
            'shahed': '#e74c3c',
            'cruise_missile': '#9b59b6',
            'ballistic_missile': '#f39c12',
            'uav': '#3498db',
            'helicopter': '#1abc9c',
            'aircraft': '#95a5a6',
            'unknown': '#7f8c8d'
        };
        
        const color = colorMap[targetType] || '#2ecc71';
        this.updateStyle({ color });
    }
    
    /**
     * Розрахунок довжини траєкторії (км)
     */
    calculateLength() {
        if (this.points.length < 2) return 0;
        
        let totalDistance = 0;
        
        for (let i = 1; i < this.points.length; i++) {
            const prev = this.points[i - 1];
            const current = this.points[i];
            
            totalDistance += this.calculateDistance(
                prev.coordinates,
                current.coordinates
            );
        }
        
        return totalDistance;
    }
    
    /**
     * Розрахунок відстані між двома точками (км)
     */
    calculateDistance(coord1, coord2) {
        const [lat1, lon1] = coord1;
        const [lat2, lon2] = coord2;
        
        const R = 6371; // Радіус Землі в км
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    /**
     * Прогнозування майбутньої позиції
     */
    predictFuturePosition(seconds = 60) {
        if (this.points.length < 2) return null;
        
        const lastPoint = this.points[this.points.length - 1];
        const prevPoint = this.points[this.points.length - 2];
        
        // Розраховуємо вектор руху
        const timeDiff = (lastPoint.timestamp - prevPoint.timestamp) / 1000; // секунди
        if (timeDiff === 0) return null;
        
        const latDiff = lastPoint.coordinates[0] - prevPoint.coordinates[0];
        const lngDiff = lastPoint.coordinates[1] - prevPoint.coordinates[1];
        
        const latSpeed = latDiff / timeDiff;
        const lngSpeed = lngDiff / timeDiff;
        
        // Прогнозуємо майбутню позицію
        const predictedLat = lastPoint.coordinates[0] + (latSpeed * seconds);
        const predictedLng = lastPoint.coordinates[1] + (lngSpeed * seconds);
        
        return {
            coordinates: [predictedLat, predictedLng],
            timestamp: lastPoint.timestamp + (seconds * 1000),
            confidence: this.calculatePredictionConfidence()
        };
    }
    
    /**
     * Впевненість у прогнозі
     */
    calculatePredictionConfidence() {
        if (this.points.length < 3) return 0.3;
        
        // Аналізуємо стабільність траєкторії
        const speeds = [];
        const headings = [];
        
        for (let i = 1; i < this.points.length; i++) {
            const prev = this.points[i - 1];
            const current = this.points[i];
            
            const timeDiff = (current.timestamp - prev.timestamp) / 1000;
            const distance = this.calculateDistance(prev.coordinates, current.coordinates);
            
            speeds.push(distance / timeDiff); // км/с
            
            // Розрахунок курсу
            const heading = this.calculateHeading(prev.coordinates, current.coordinates);
            headings.push(heading);
        }
        
        // Розраховуємо варіації
        const speedVariance = this.calculateVariance(speeds);
        const headingVariance = this.calculateVariance(headings);
        
        // Впевненість зменшується зі збільшенням варіацій
        const confidence = Math.max(0.1, 1 - (speedVariance * 0.5) - (headingVariance * 0.01));
        return Math.min(1, confidence);
    }
    
    /**
     * Розрахунок курсу (градуси)
     */
    calculateHeading(coord1, coord2) {
        const [lat1, lon1] = coord1;
        const [lat2, lon2] = coord2;
        
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                 Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        
        let heading = Math.atan2(y, x) * (180 / Math.PI);
        heading = (heading + 360) % 360;
        
        return heading;
    }
    
    /**
     * Розрахунок дисперсії
     */
    calculateVariance(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((a, b) => a + b) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b) / values.length;
        
        return variance;
    }
    
    /**
     * Очищення траєкторії
     */
    clear() {
        this.points = [];
        
        if (this.polyline) {
            this.polyline.remove();
            this.polyline = null;
        }
    }
    
    /**
     * Експорт траєкторії у формат GeoJSON
     */
    toGeoJSON() {
        const coordinates = this.points.map(point => [
            point.coordinates[1], // GeoJSON використовує [lng, lat]
            point.coordinates[0]
        ]);
        
        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            properties: {
                targetId: this.targetId,
                pointCount: this.points.length,
                lengthKm: this.calculateLength(),
                timestamps: this.points.map(p => p.timestamp),
                altitudes: this.points.map(p => p.altitude),
                speeds: this.points.map(p => p.speed)
            }
        };
    }
    
    /**
     * Отримання статистики траєкторії
     */
    getStatistics() {
        if (this.points.length === 0) {
            return null;
        }
        
        const speeds = this.points.map(p => p.speed).filter(s => s > 0);
        const altitudes = this.points.map(p => p.altitude).filter(a => a > 0);
        
        return {
            pointCount: this.points.length,
            totalLength: this.calculateLength(),
            duration: this.points.length > 1 ? 
                (this.points[this.points.length - 1].timestamp - this.points[0].timestamp) / 1000 : 0,
            avgSpeed: speeds.length > 0 ? 
                speeds.reduce((a, b) => a + b) / speeds.length : 0,
            maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
            avgAltitude: altitudes.length > 0 ? 
                altitudes.reduce((a, b) => a + b) / altitudes.length : 0,
            maxAltitude: altitudes.length > 0 ? Math.max(...altitudes) : 0,
            startTime: this.points[0]?.timestamp,
            endTime: this.points[this.points.length - 1]?.timestamp
        };
    }
}

/**
 * Менеджер траєкторій для кількох цілей
 */
export class TrajectoryManager {
    constructor(map) {
        this.map = map;
        this.trajectories = new Map(); // targetId -> Trajectory
        this.trajectoryLayer = L.layerGroup().addTo(map);
        this.isVisible = true;
        this.maxPointsPerTrajectory = 100;
        this.autoCleanup = true;
        this.cleanupInterval = null;
        
        // Конфігурація
        this.config = {
            showPredictions: false,
            predictionLength: 60, // секунд
            smoothLines: true,
            fadeOldPoints: true,
            colorByType: true
        };
        
        this.startAutoCleanup();
    }
    
    /**
     * Додавання/оновлення траєкторії
     */
    updateTrajectory(targetId, coordinates, metadata = {}) {
        let trajectory = this.trajectories.get(targetId);
        
        if (!trajectory) {
            trajectory = new Trajectory(targetId, this.maxPointsPerTrajectory);
            this.trajectories.set(targetId, trajectory);
            
            // Налаштування кольору за типом
            if (this.config.colorByType && metadata.targetType) {
                trajectory.setColorByTargetType(metadata.targetType);
            }
        }
        
        // Додаємо точку
        trajectory.addPoint(coordinates, metadata);
        
        // Оновлюємо відображення
        this.renderTrajectory(targetId);
        
        // Прогнозування
        if (this.config.showPredictions) {
            this.renderPrediction(targetId);
        }
        
        return trajectory;
    }
    
    /**
     * Відображення траєкторії на мапі
     */
    renderTrajectory(targetId) {
        const trajectory = this.trajectories.get(targetId);
        if (!trajectory || trajectory.points.length < 2) return;
        
        // Створюємо масив координат для полілінії
        const coordinates = trajectory.points.map(point => point.coordinates);
        
        // Видаляємо стару полілінію
        if (trajectory.polyline) {
            this.trajectoryLayer.removeLayer(trajectory.polyline);
        }
        
        // Створюємо нову полілінію
        trajectory.polyline = L.polyline(coordinates, {
            ...trajectory.style,
            interactive: false
        }).addTo(this.trajectoryLayer);
        
        // Додаємо тултіп
        const stats = trajectory.getStatistics();
        if (stats) {
            trajectory.polyline.bindTooltip(`
                <div style="font-size: 12px;">
                    <b>Траєкторія</b><br>
                    Довжина: ${stats.totalLength.toFixed(1)} км<br>
                    Тривалість: ${stats.duration.toFixed(0)} с<br>
                    Точок: ${stats.pointCount}
                </div>
            `, { permanent: false });
        }
    }
    
    /**
     * Відображення прогнозованої траєкторії
     */
    renderPrediction(targetId) {
        const trajectory = this.trajectories.get(targetId);
        if (!trajectory || trajectory.points.length < 2) return;
        
        const prediction = trajectory.predictFuturePosition(this.config.predictionLength);
        if (!prediction) return;
        
        const lastPoint = trajectory.points[trajectory.points.length - 1];
        
        // Створюємо прогнозовану лінію
        const predictionLine = L.polyline([
            lastPoint.coordinates,
            prediction.coordinates
        ], {
            color: '#ff9800',
            weight: 1,
            opacity: 0.5,
            dashArray: '3, 6',
            interactive: false
        }).addTo(this.trajectoryLayer);
        
        // Додаємо точку прогнозу
        const predictionMarker = L.circleMarker(prediction.coordinates, {
            radius: 3,
            color: '#ff9800',
            fillColor: '#ff9800',
            fillOpacity: 0.7
        }).addTo(this.trajectoryLayer);
        
        predictionMarker.bindTooltip(`
            <div style="font-size: 12px;">
                <b>Прогноз (${this.config.predictionLength}с)</b><br>
                Впевненість: ${(prediction.confidence * 100).toFixed(0)}%
            </div>
        `, { permanent: false });
        
        // Зберігаємо для видалення
        trajectory.predictionElements = trajectory.predictionElements || [];
        trajectory.predictionElements.push(predictionLine, predictionMarker);
    }
    
    /**
     * Очищення прогнозів
     */
    clearPredictions(targetId) {
        const trajectory = this.trajectories.get(targetId);
        if (!trajectory || !trajectory.predictionElements) return;
        
        trajectory.predictionElements.forEach(element => {
            if (element.remove) element.remove();
        });
        
        trajectory.predictionElements = [];
    }
    
    /**
     * Видалення траєкторії
     */
    removeTrajectory(targetId) {
        const trajectory = this.trajectories.get(targetId);
        if (!trajectory) return;
        
        // Видаляємо основну лінію
        if (trajectory.polyline) {
            this.trajectoryLayer.removeLayer(trajectory.polyline);
        }
        
        // Видаляємо прогнози
        this.clearPredictions(targetId);
        
        // Видаляємо з колекції
        this.trajectories.delete(targetId);
    }
    
    /**
     * Очищення всіх траєкторій
     */
    clearAll() {
        this.trajectories.forEach((trajectory, targetId) => {
            this.removeTrajectory(targetId);
        });
        
        this.trajectories.clear();
    }
    
    /**
     * Показати/приховати всі траєкторії
     */
    setVisible(visible) {
        this.isVisible = visible;
        
        if (visible) {
            this.map.addLayer(this.trajectoryLayer);
        } else {
            this.map.removeLayer(this.trajectoryLayer);
        }
        
        // Оновлюємо всі траєкторії
        this.trajectories.forEach((trajectory, targetId) => {
            if (trajectory.polyline) {
                if (visible) {
                    trajectory.polyline.addTo(this.trajectoryLayer);
                } else {
                    this.trajectoryLayer.removeLayer(trajectory.polyline);
                }
            }
        });
    }
    
    /**
     * Автоматична очистка старих траєкторій
     */
    startAutoCleanup(interval = 60000) {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        
        this.cleanupInterval = setInterval(() => {
            if (this.autoCleanup) {
                this.cleanupOldTrajectories();
            }
        }, interval);
    }
    
    /**
     * Очищення старих траєкторій
     */
    cleanupOldTrajectories(maxAge = 300000) { // 5 хвилин за замовчуванням
        const now = Date.now();
        const toRemove = [];
        
        this.trajectories.forEach((trajectory, targetId) => {
            if (trajectory.points.length === 0) {
                toRemove.push(targetId);
                return;
            }
            
            const lastPoint = trajectory.points[trajectory.points.length - 1];
            const age = now - lastPoint.timestamp;
            
            if (age > maxAge) {
                toRemove.push(targetId);
            }
        });
        
        toRemove.forEach(targetId => {
            this.removeTrajectory(targetId);
        });
        
        if (toRemove.length > 0) {
            console.log(`Cleaned up ${toRemove.length} old trajectories`);
        }
    }
    
    /**
     * Експорт всіх траєкторій у формат GeoJSON
     */
    exportToGeoJSON() {
        const features = Array.from(this.trajectories.values())
            .map(trajectory => trajectory.toGeoJSON());
        
        return {
            type: 'FeatureCollection',
            features: features,
            properties: {
                exportTime: new Date().toISOString(),
                trajectoryCount: features.length,
                totalPoints: features.reduce((sum, feature) => 
                    sum + feature.properties.pointCount, 0
                )
            }
        };
    }
    
    /**
     * Отримання статистики по всіх траєкторіях
     */
    getStatistics() {
        const stats = {
            totalTrajectories: this.trajectories.size,
            totalPoints: 0,
            totalLength: 0,
            activeTrajectories: 0
        };
        
        this.trajectories.forEach(trajectory => {
            const trajectoryStats = trajectory.getStatistics();
            if (trajectoryStats) {
                stats.totalPoints += trajectoryStats.pointCount;
                stats.totalLength += trajectoryStats.totalLength;
                stats.activeTrajectories++;
            }
        });
        
        return stats;
    }
    
    /**
     * Зупинка менеджера
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.clearAll();
        
        if (this.trajectoryLayer) {
            this.map.removeLayer(this.trajectoryLayer);
        }
    }
}

/**
 * Утиліти для роботи з траєкторіями
 */
export const TrajectoryUtils = {
    /**
     * Згладжування траєкторії
     */
    smoothTrajectory(points, strength = 0.5) {
        if (points.length < 3) return points;
        
        const smoothed = [...points];
        
        for (let i = 1; i < points.length - 1; i++) {
            smoothed[i] = {
                ...points[i],
                coordinates: [
                    points[i].coordinates[0] * (1 - strength) + 
                    (points[i-1].coordinates[0] + points[i+1].coordinates[0]) * strength / 2,
                    points[i].coordinates[1] * (1 - strength) + 
                    (points[i-1].coordinates[1] + points[i+1].coordinates[1]) * strength / 2
                ]
            };
        }
        
        return smoothed;
    },
    
    /**
     * Обчислення середньої швидкості
     */
    calculateAverageSpeed(trajectory) {
        if (!trajectory || trajectory.points.length < 2) return 0;
        
        const speeds = [];
        for (let i = 1; i < trajectory.points.length; i++) {
            const prev = trajectory.points[i - 1];
            const current = trajectory.points[i];
            
            const timeDiff = (current.timestamp - prev.timestamp) / 1000; // секунди
            const distance = trajectory.calculateDistance(
                prev.coordinates,
                current.coordinates
            );
            
            if (timeDiff > 0) {
                speeds.push(distance / timeDiff);
            }
        }
        
        if (speeds.length === 0) return 0;
        return speeds.reduce((a, b) => a + b) / speeds.length;
    },
    
    /**
     * Детекція маневрів
     */
    detectManeuvers(trajectory, threshold = 30) {
        if (!trajectory || trajectory.points.length < 3) return [];
        
        const maneuvers = [];
        
        for (let i = 2; i < trajectory.points.length; i++) {
            const p1 = trajectory.points[i - 2];
            const p2 = trajectory.points[i - 1];
            const p3 = trajectory.points[i];
            
            const heading1 = trajectory.calculateHeading(p1.coordinates, p2.coordinates);
            const heading2 = trajectory.calculateHeading(p2.coordinates, p3.coordinates);
            
            const headingChange = Math.abs(heading2 - heading1);
            const normalizedChange = Math.min(headingChange, 360 - headingChange);
            
            if (normalizedChange > threshold) {
                maneuvers.push({
                    index: i,
                    timestamp: p3.timestamp,
                    location: p3.coordinates,
                    headingChange: normalizedChange,
                    intensity: normalizedChange / threshold
                });
            }
        }
        
        return maneuvers;
    },
    
    /**
     * Конвертація в градуси для відображення
     */
    formatHeading(degrees) {
        const directions = ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗ', 'З', 'ПнЗ'];
        const index = Math.round(degrees / 45) % 8;
        return `${directions[index]} (${Math.round(degrees)}°)`;
    }
};

// Експорт за замовчуванням
export default TrajectoryManager;
