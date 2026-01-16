// Перевірка наявності Leaflet
if (typeof L === 'undefined') {
    throw new Error('Leaflet не завантажена! Перевірте посилання в HTML');
}

// Основний клас для мапи
class MapManager {
    constructor() {
        this.map = null;
        this.baseLayers = {};
        this.overlayLayers = {};
        this.currentLayer = 'dark';
    }

    init() {
        console.log('🗺️ Ініціалізація мапи для PWA...');
        
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            throw new Error('Елемент #map не знайдено');
        }
        
        try {
            // Налаштування для мобільного PWA
            this.map = L.map('map', {
                center: [49.0, 31.5],
                zoom: 6,
                minZoom: 4,
                maxZoom: 18,
                zoomControl: false, // Додамо кастомний
                attributionControl: true,
                dragging: true,
                touchZoom: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                keyboard: true,
                tap: false, // Для кращої роботи з кнопками
                fadeAnimation: true,
                zoomAnimation: true,
                markerZoomAnimation: true,
                transform3DLimit: 8388608,
                maxBounds: [
                    [44.0, 22.0],
                    [53.0, 41.0]
                ],
                maxBoundsViscosity: 1.0
            });
            
            console.log('✅ Мапа створена');
            
            // Додаємо базові шари
            this.addBaseLayers();
            
            // Додаємо контроли
            this.addControls();
            
            // Перевіряємо розміри
            this.checkSize();
            
            return this.map;
            
        } catch (error) {
            console.error('❌ Помилка створення мапи:', error);
            throw error;
        }
    }

    addBaseLayers() {
        // Темна мапа (за замовчуванням)
        this.baseLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB',
            maxZoom: 19,
            detectRetina: true,
            crossOrigin: true
        }).addTo(this.map);
        
        // Стандартна OSM
        this.baseLayers.light = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            detectRetina: true,
            crossOrigin: true
        });
        
        // Супутникові знімки
        this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, Earthstar Geographics',
            maxZoom: 19,
            detectRetina: true,
            crossOrigin: true
        });
        
        // Топографічна
        this.baseLayers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, SRTM',
            maxZoom: 17,
            detectRetina: true,
            crossOrigin: true
        });
    }

    addControls() {
        // Кастомний контрол збільшення для мобільних
        const zoomControl = L.control.zoom({
            position: 'bottomright',
            zoomInText: '+',
            zoomOutText: '−'
        });
        
        // Стилізуємо для мобільних
        zoomControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar leaflet-control');
            div.innerHTML = `
                <a class="leaflet-control-zoom-in" href="#" title="Збільшити">+</a>
                <a class="leaflet-control-zoom-out" href="#" title="Зменшити">−</a>
            `;
            return div;
        };
        
        zoomControl.addTo(this.map);
        
        // Масштабна лінійка
        L.control.scale({
            imperial: false,
            metric: true,
            position: 'bottomleft',
            maxWidth: 150
        }).addTo(this.map);
        
        // Контроль шарів (зберігаємо посилання)
        this.layerControl = L.control.layers(this.baseLayers, this.overlayLayers, {
            position: 'topright',
            collapsed: true
        }).addTo(this.map);
        
        // Кастомна атрибуція
        const attribution = L.control.attribution({
            position: 'bottomright',
            prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © <a href="https://openstreetmap.org">OSM</a>'
        });
        attribution.addTo(this.map);
        
        // Кнопка поточного місця
        this.addLocationControl();
        
        console.log('✅ Контроли додані');
    }

    addLocationControl() {
        const locationControl = L.control({ position: 'bottomright' });
        
        locationControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-control-location');
            div.innerHTML = `
                <button style="
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border: none;
                    width: 44px;
                    height: 44px;
                    border-radius: 22px;
                    color: white;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    margin-top: 10px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                " title="Моє місцезнаходження">
                    📍
                </button>
            `;
            
            L.DomEvent.on(div, 'click', (e) => {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                this.getUserLocation();
            });
            
            return div;
        };
        
        locationControl.addTo(this.map);
    }

    async getUserLocation() {
        if (!navigator.geolocation) {
            alert('Геолокація не підтримується вашим пристроєм');
            return;
        }
        
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude } = position.coords;
            const accuracy = position.coords.accuracy;
            
            // Додаємо маркер
            if (this.locationMarker) {
                this.map.removeLayer(this.locationMarker);
            }
            
            this.locationMarker = L.circle([latitude, longitude], {
                color: '#3498db',
                fillColor: '#2980b9',
                fillOpacity: 0.2,
                radius: accuracy
            }).addTo(this.map);
            
            L.marker([latitude, longitude], {
                icon: L.divIcon({
                    className: 'user-location-pin',
                    html: '<div style="background: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);"></div>',
                    iconSize: [20, 20]
                })
            }).addTo(this.map)
            .bindPopup('Ваше поточне місцезнаходження')
            .openPopup();
            
            // Центруємо мапу
            this.map.setView([latitude, longitude], Math.max(13, this.map.getZoom()));
            
        } catch (error) {
            console.error('Помилка геолокації:', error);
            alert('Не вдалося визначити місцезнаходження');
        }
    }

    checkSize() {
        // Перевіряємо розміри та оновлюємо мапу
        setTimeout(() => {
            this.map.invalidateSize();
            console.log('✅ Розміри мапи оновлено');
        }, 100);
        
        // Оновлюємо при зміні орієнтації
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        });
        
        // Для iOS Safari
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        });
    }

    changeBaseLayer(layerId) {
        if (!this.baseLayers[layerId] || !this.map) return;
        
        // Перемикаємо шари
        Object.values(this.baseLayers).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        
        this.baseLayers[layerId].addTo(this.map);
        this.currentLayer = layerId;
        
        // Зберігаємо вибір
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('map-layer', layerId);
        }
        
        console.log(`🔄 Шар мапи змінено на: ${layerId}`);
    }

    addLayer(name, layer) {
        this.overlayLayers[name] = layer;
        if (this.layerControl) {
            this.layerControl.addOverlay(layer, name);
        }
    }

    removeLayer(name) {
        if (this.overlayLayers[name]) {
            this.map.removeLayer(this.overlayLayers[name]);
            delete this.overlayLayers[name];
        }
    }
}

// Експорт функцій
export function initMap() {
    const manager = new MapManager();
    return manager.init();
}

export function changeBaseLayer(map, layerId) {
    // Ця функція може використовуватися зовні
    // Для простоти створюємо новий менеджер
    const manager = new MapManager();
    manager.map = map;
    manager.changeBaseLayer(layerId);
}

// Додаткові утиліти
export function addMarker(map, lat, lng, options = {}) {
    const defaultOptions = {
        title: 'Маркер',
        popup: '',
        color: '#e74c3c',
        icon: null
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    let marker;
    if (finalOptions.icon) {
        marker = L.marker([lat, lng], { icon: finalOptions.icon });
    } else {
        marker = L.circleMarker([lat, lng], {
            color: finalOptions.color,
            fillColor: finalOptions.color,
            fillOpacity: 0.7,
            radius: 8
        });
    }
    
    marker.addTo(map);
    
    if (finalOptions.popup) {
        marker.bindPopup(finalOptions.popup);
    }
    
    if (finalOptions.title) {
        marker.bindTooltip(finalOptions.title);
    }
    
    return marker;
}

export function addAlertZone(map, lat, lng, radius = 10000) {
    return L.circle([lat, lng], {
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 0.3,
        radius: radius
    }).addTo(map);
    }
