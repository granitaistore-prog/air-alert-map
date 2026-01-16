// src/svitlo/outageManager.js
import SvitloAPI from './svitloAPI.js';

export class PowerOutageManager {
    constructor(map) {
        this.map = map;
        this.outageLayer = L.layerGroup().addTo(map);
        this.svitloAPI = new SvitloAPI({
            region: 'kharkivska',
            queue: 'queue1'
        });
        this.updateInterval = null;
    }
    
    async updateOutages() {
        try {
            this.outageLayer.clearLayers();
            const outages = await this.svitloAPI.getAllActiveOutages();
            
            outages.forEach(outage => {
                const marker = L.marker(outage.coordinates, {
                    icon: L.divIcon({
                        html: `<div style="background: ${outage.color}; ...">${outage.icon}</div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    })
                }).addTo(this.outageLayer);
                
                marker.bindPopup(`<div>${outage.name}</div>`);
            });
            
            return outages.length;
        } catch (error) {
            console.error('Power outage update failed:', error);
            return 0;
        }
    }
    
    startUpdates(intervalMinutes = 5) {
        this.updateOutages();
        this.updateInterval = setInterval(() => {
            this.updateOutages();
        }, intervalMinutes * 60 * 1000);
    }
    
    stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    destroy() {
        this.stopUpdates();
        this.outageLayer.clearLayers();
        this.map.removeLayer(this.outageLayer);
    }
}
