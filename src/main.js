import { initMap } from './map/mapInit.js';
import { startRadar } from './targets/targetManager.js';
const map = initMap(); startRadar(map);