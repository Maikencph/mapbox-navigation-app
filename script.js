// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1IjoiYmVoYXYiLCJhIjoiY20zeDd0ZzF0MWU1YTJyb3Jrcm9vaGJubSJ9.18ZoBfkA2BbHCYxsunpOqg';

// Create the map with mobile-optimized settings
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-74.5, 40],
    zoom: 9,
    pitch: 45,
    attributionControl: false
});

// Add minimal navigation controls for mobile
const nav = new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true
});
map.addControl(nav, 'bottom-right');

// Add the directions control with mobile-optimized settings
const directions = new MapboxDirections({
    accessToken: mapboxgl.accessToken,
    unit: 'metric',
    profile: 'mapbox/driving',
    alternatives: true,
    geometries: 'geojson',
    controls: {
        inputs: true,
        instructions: false
    },
    interactive: false,
    flyTo: true
});

map.addControl(directions, 'top-left');

// Add geolocation control with high accuracy for mobile
const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
});
map.addControl(geolocate, 'bottom-right');

// Get user's location and center the map
map.on('load', () => {
    // Trigger geolocation on load
    geolocate.trigger();
    
    // Update instructions panel when route changes
    directions.on('route', (e) => {
        if (e.route && e.route[0]) {
            const steps = e.route[0].legs[0].steps;
            const instructionsDiv = document.getElementById('instructions');
            instructionsDiv.innerHTML = steps.map(step => 
                `<p>${step.maneuver.instruction}</p>`
            ).join('');
        }
    });
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        map.resize();
    }, 200);
});
