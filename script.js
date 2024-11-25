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
    antialias: true // Enable antialiasing for smoother rendering
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
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 7000
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

// Get direction icon based on maneuver type
function getDirectionIcon(maneuver) {
    const icons = {
        'turn-right': 'fa-turn-right',
        'turn-left': 'fa-turn-left',
        'turn-slight-right': 'fa-turn-right',
        'turn-slight-left': 'fa-turn-left',
        'turn-sharp-right': 'fa-turn-right',
        'turn-sharp-left': 'fa-turn-left',
        'uturn': 'fa-turn-up',
        'straight': 'fa-arrow-up',
        'merge': 'fa-merge',
        'roundabout': 'fa-circle-right',
        'arrive': 'fa-location-dot'
    };
    return icons[maneuver] || 'fa-arrow-up';
}

// Format distance
function formatDistance(meters) {
    const miles = meters / 1609.344;
    return miles < 0.1 ? `${Math.round(meters)} ft` : `${miles.toFixed(1)} mi`;
}

// Update directions panel
function updateDirectionsPanel(steps) {
    const panel = document.getElementById('directions-panel');
    const toggle = document.getElementById('toggle-directions');
    panel.innerHTML = '';

    steps.forEach(step => {
        const div = document.createElement('div');
        div.className = 'direction-step';
        div.innerHTML = `
            <i class="fas ${getDirectionIcon(step.maneuver.type)}"></i>
            <span>${step.maneuver.instruction}</span>
            <span class="direction-distance">${formatDistance(step.distance)}</span>
        `;
        panel.appendChild(div);
    });

    toggle.classList.add('visible');
}

// Toggle directions panel
document.getElementById('toggle-directions').addEventListener('click', () => {
    const panel = document.getElementById('directions-panel');
    panel.classList.toggle('active');
    const isActive = panel.classList.contains('active');
    document.getElementById('toggle-directions').querySelector('span').textContent = 
        isActive ? 'Hide Directions' : 'Show Directions';
});

// Update user location when geolocation changes
geolocate.on('geolocate', (e) => {
    userLocation = [e.coords.longitude, e.coords.latitude];
    
    // If we have a destination, update the route
    if (destinationLocation) {
        getRoute(userLocation, destinationLocation);
    }
    
    // Force map update to ensure accuracy circle is centered
    map.triggerRepaint();
});

// Handle tracking error
geolocate.on('error', (e) => {
    console.error('Geolocation error:', e.error);
    setTimeout(() => {
        geolocate.trigger();
    }, 2000);
});

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
        
        // Fit map to show entire route
        const bounds = new mapboxgl.LngLatBounds()
            .extend(userLocation)
            .extend(destinationLocation);
        map.fitBounds(bounds, {
            padding: 100,
            pitch: 60,
            duration: 1000
        });
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
        const steps = data.legs[0].steps;

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
        const miles = (data.distance / 1609.344).toFixed(1);
        routeInfo.textContent = `${miles} mi`;

        // Update directions panel
        updateDirectionsPanel(steps);

    } catch (error) {
        console.error('Error:', error);
    }
}

// Add 3D buildings when the map loads
map.on('load', () => {
    // Trigger geolocation on load
    geolocate.trigger();

    // Add 3D building layer with enhanced styling
    map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 12,
        'paint': {
            'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'height'],
                0, '#666',
                50, '#999',
                100, '#aaa',
                200, '#ccc'
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6,
            'fill-extrusion-vertical-gradient': true
        }
    });

    // Add light effect to make 3D buildings look better
    map.setLight({
        anchor: 'viewport',
        color: 'white',
        intensity: 0.4,
        position: [1.5, 90, 80]
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
