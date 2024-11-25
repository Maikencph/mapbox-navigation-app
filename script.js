// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1IjoiYmVoYXYiLCJhIjoiY20zeDd0ZzF0MWU1YTJyb3Jrcm9vaGJubSJ9.18ZoBfkA2BbHCYxsunpOqg';

// Create the map with mobile-optimized settings
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-74.5, 40],
    zoom: 14,
    pitch: 60,
    bearing: 0,
    attributionControl: false
});

// Add minimal navigation controls for mobile
const nav = new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true
});
map.addControl(nav, 'bottom-right');

// Add geolocation control with high accuracy for mobile
const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true,
    showAccuracyCircle: true
});
map.addControl(geolocate, 'bottom-right');

// Initialize route data
let currentRoute = null;
let userLocation = null;
let destinationLocation = null;

// Add the search control
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Where to?',
    marker: false
});
map.addControl(geocoder, 'bottom-left');

// Update route when a location is selected
geocoder.on('result', async (e) => {
    destinationLocation = e.result.center;
    if (userLocation) {
        await getRoute(userLocation, destinationLocation);
    }
});

// Get user's location when available
geolocate.on('geolocate', (e) => {
    userLocation = [e.coords.longitude, e.coords.latitude];
    if (destinationLocation) {
        getRoute(userLocation, destinationLocation);
    }
});

// Function to get route between two points
async function getRoute(start, end) {
    try {
        const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
        );
        const json = await query.json();
        const data = json.routes[0];
        const route = data.geometry.coordinates;
        const distance = data.distance;

        // Update the route display
        if (map.getSource('route')) {
            map.getSource('route').setData({
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': route
                }
            });
        } else {
            map.addLayer({
                'id': 'route',
                'type': 'line',
                'source': {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': route
                        }
                    }
                },
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#4CAF50',
                    'line-width': 5,
                    'line-opacity': 0.75
                }
            });
        }

        // Update distance display
        const routeInfo = document.getElementById('route-info');
        const miles = (distance / 1609.344).toFixed(1);
        routeInfo.textContent = `${miles} mi`;

    } catch (error) {
        console.error('Error:', error);
    }
}

// Add 3D buildings when the map loads
map.on('load', () => {
    map.on('geolocate', (e) => {
        // Reduce the accuracy radius to make the circle smaller
        if (e.coords && e.coords.accuracy) {
            e.coords.accuracy = e.coords.accuracy * 0.3; // Reduce to 30% of original size
        }
    });
    
    // Trigger geolocation on load
    geolocate.trigger();

    // Add 3D building layer
    map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 12,
        'paint': {
            'fill-extrusion-color': '#666',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6
        }
    });

    // Update UI with current time and weather
    updateTimeAndWeather();
});

// Function to update time and weather info
function updateTimeAndWeather() {
    const timeDiv = document.getElementById('current-time');
    const dateDiv = document.getElementById('current-date');
    
    function updateTime() {
        const now = new Date();
        timeDiv.textContent = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        dateDiv.textContent = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    updateTime();
    setInterval(updateTime, 1000);
}

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        map.resize();
    }, 200);
});
