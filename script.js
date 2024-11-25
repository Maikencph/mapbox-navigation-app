// Initialize Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiYmVoYXYiLCJhIjoiY20zeDd0ZzF0MWU1YTJyb3Jrcm9vaGJubSJ9.18ZoBfkA2BbHCYxsunpOqg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-74.5, 40],
    zoom: 9
});

// Add navigation controls
const nav = new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true
});
map.addControl(nav, 'bottom-right');

// Add geolocate control
const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
});

// Add geolocate control above zoom controls
map.addControl(geolocate, 'bottom-right');

// Variables for tracking state
let userLocation = null;
let destinationLocation = null;
let currentTravelMode = 'driving';
let isNavigating = false;

// Variables for navigation
let currentStep = 0;
let routeSteps = [];

// Initialize the map
map.on('load', () => {
    // Trigger geolocation on load
    geolocate.trigger();

    // Listen for when the user's location is found
    geolocate.on('geolocate', (e) => {
        userLocation = [e.coords.longitude, e.coords.latitude];
        updateAccuracyCircle(e);
        
        // Update weather when location is found
        updateWeather(e.coords.latitude, e.coords.longitude);
    });

    // Initialize time and date
    updateTimeAndDate();
    setInterval(updateTimeAndDate, 1000);

    // Add search functionality
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const query = this.value;
            searchLocation(query);
        }
    });
});

// Search for a location
async function searchLocation(query) {
    try {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const location = data.features[0];
            destinationLocation = location.center;
            
            // Add marker for destination
            if (window.destinationMarker) {
                window.destinationMarker.remove();
            }
            window.destinationMarker = new mapboxgl.Marker()
                .setLngLat(destinationLocation)
                .addTo(map);

            // Get route if we have both locations
            if (userLocation) {
                getRoute(userLocation, destinationLocation);
            }

            // Fit map to show both points
            const bounds = new mapboxgl.LngLatBounds()
                .extend(userLocation)
                .extend(destinationLocation);
            map.fitBounds(bounds, { padding: 100 });
        }
    } catch (error) {
        console.error('Error searching location:', error);
    }
}

// Get route between two points
async function getRoute(start, end) {
    try {
        const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/${currentTravelMode}/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
            { method: 'GET' }
        );
        const json = await query.json();
        const data = json.routes[0];
        const route = data.geometry.coordinates;
        const geojson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: route
            }
        };
        
        // Remove existing route
        if (map.getSource('route')) {
            map.removeLayer('route');
            map.removeSource('route');
        }

        // Add new route
        map.addSource('route', {
            type: 'geojson',
            data: geojson
        });
        map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#4CAF50',
                'line-width': 5,
                'line-opacity': 0.75
            }
        });

        // Update route info
        const distance = (data.distance / 1609.34).toFixed(1); // Convert to miles
        document.getElementById('route-info').textContent = `${distance} mi`;

        // Show directions panel
        showDirections(data.legs[0].steps);
    } catch (error) {
        console.error('Error getting route:', error);
    }
}

// Update accuracy circle function
function updateAccuracyCircle(position) {
    const coordinates = [position.coords.longitude, position.coords.latitude];
    const accuracy = position.coords.accuracy;

    const circleData = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: coordinates
        },
        properties: {
            accuracy: accuracy
        }
    };

    if (!map.getSource('accuracy-circle')) {
        map.addSource('accuracy-circle', {
            type: 'geojson',
            data: circleData
        });

        map.addLayer({
            id: 'accuracy-circle',
            type: 'circle',
            source: 'accuracy-circle',
            paint: {
                'circle-radius': ['get', 'accuracy'],
                'circle-color': '#4264fb',
                'circle-opacity': 0.2,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#4264fb'
            }
        });
    } else {
        map.getSource('accuracy-circle').setData(circleData);
    }
}

// Update user location tracking
map.on('load', () => {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const coordinates = [position.coords.longitude, position.coords.latitude];
                
                // Update user location marker
                if (!map.getSource('user-location')) {
                    map.addSource('user-location', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: coordinates
                            }
                        }
                    });
                    
                    map.addLayer({
                        id: 'user-location',
                        type: 'circle',
                        source: 'user-location',
                        paint: {
                            'circle-radius': 8,
                            'circle-color': '#4264fb',
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#ffffff'
                        }
                    });
                } else {
                    map.getSource('user-location').setData({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: coordinates
                        }
                    });
                }

                // Update accuracy circle
                updateAccuracyCircle(position);

                // Center map if following is enabled
                if (isNavigating) {
                    map.easeTo({
                        center: coordinates,
                        duration: 1000
                    });
                }

                // Update weather if needed
                updateWeather(coordinates[1], coordinates[0]);
            },
            (error) => {
                console.error('Error getting location:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }
});

// Function to update weather
async function updateWeather(latitude, longitude) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=YOUR_API_KEY&units=imperial`);
        const data = await response.json();
        
        const weatherDiv = document.getElementById('current-weather');
        const temp = Math.round(data.main.temp);
        const description = data.weather[0].description;
        const icon = data.weather[0].icon;
        
        weatherDiv.innerHTML = `
            <img src="https://openweathermap.org/img/wn/${icon}.png" alt="Weather icon">
            <span>${temp}°F</span>
            <span>${description}</span>
        `;
    } catch (error) {
        console.error('Weather error:', error);
    }
}

// Function to update time and date
function updateTimeAndDate() {
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

// Handle successful geolocation
geolocate.on('geolocate', (e) => {
    console.log('Geolocated:', e);
    userLocation = [e.coords.longitude, e.coords.latitude];
    
    // Update weather when location is found
    updateWeather(e.coords.latitude, e.coords.longitude);
    
    // Center map on user's location initially
    if (!destinationLocation) {
        map.flyTo({
            center: userLocation,
            zoom: 15,
            essential: true
        });
    }
    
    if (destinationLocation) {
        getRoute(userLocation, destinationLocation);
    }

    if (isNavigating) {
        // Update camera to follow user
        map.easeTo({
            center: userLocation,
            bearing: e.coords.heading || 0,
            pitch: 60,
            duration: 1000
        });

        // Check if we need to update the current step
        if (routeSteps && routeSteps.length > currentStep) {
            const nextStep = routeSteps[currentStep];
            const distanceToNextStep = turf.distance(
                turf.point(userLocation),
                turf.point(nextStep.maneuver.location),
                { units: 'meters' }
            );

            if (distanceToNextStep < 20) {
                currentStep++;
                updateDirectionsPanel(routeSteps, currentTravelMode, currentStep);
            }
        }
    }
});

// Show directions in the panel
function showDirections(steps) {
    routeSteps = steps;
    const panel = document.getElementById('directions-panel');
    panel.innerHTML = '';
    
    steps.forEach((step, index) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'direction-step';
        if (index === currentStep && isNavigating) {
            stepDiv.classList.add('current-step');
        }
        
        const icon = document.createElement('i');
        icon.className = `fas ${getDirectionIcon(step.maneuver.type, currentTravelMode)}`;
        
        const text = document.createElement('span');
        text.textContent = step.maneuver.instruction;
        
        stepDiv.appendChild(icon);
        stepDiv.appendChild(text);
        panel.appendChild(stepDiv);
    });

    // Show the toggle directions button
    document.getElementById('toggle-directions').style.display = 'flex';
    
    // Show the start journey button
    document.getElementById('start-journey').style.display = 'block';
}

// Get direction icon based on maneuver type
function getDirectionIcon(maneuver, mode) {
    const icons = {
        'turn-right': 'fa-turn-right',
        'turn-left': 'fa-turn-left',
        'turn-slight-right': 'fa-turn-right',
        'turn-slight-left': 'fa-turn-left',
        'turn-sharp-right': 'fa-turn-right',
        'turn-sharp-left': 'fa-turn-left',
        'uturn': 'fa-u-turn',
        'merge': 'fa-merge',
        'fork': 'fa-code-fork',
        'roundabout': 'fa-circle-notch',
        'exit-roundabout': 'fa-circle-notch',
        'arrive': 'fa-location-dot'
    };
    
    return icons[maneuver] || 'fa-arrow-right';
}

// Handle start journey button
document.getElementById('start-journey').addEventListener('click', function() {
    isNavigating = !isNavigating;
    this.textContent = isNavigating ? 'End Journey' : 'Start Journey';
    
    if (isNavigating) {
        currentStep = 0;
        document.getElementById('directions-panel').classList.add('active');
        updateCurrentStep();
    } else {
        document.getElementById('directions-panel').classList.remove('active');
    }
});

// Handle toggle directions button
document.getElementById('toggle-directions').addEventListener('click', function() {
    const panel = document.getElementById('directions-panel');
    panel.classList.toggle('active');
    
    const text = panel.classList.contains('active') ? 'Hide Directions' : 'Show Directions';
    this.querySelector('span').textContent = text;
});

// Update current navigation step
function updateCurrentStep() {
    if (!isNavigating) return;

    const steps = document.querySelectorAll('.direction-step');
    steps.forEach(step => step.classList.remove('current-step'));
    
    if (steps[currentStep]) {
        steps[currentStep].classList.add('current-step');
        steps[currentStep].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Handle travel mode selection
document.querySelectorAll('.travel-mode-btn').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.travel-mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        currentTravelMode = this.dataset.mode;
        
        if (userLocation && destinationLocation) {
            getRoute(userLocation, destinationLocation);
        }
    });
});

// Add start journey button
const startJourneyButton = document.createElement('button');
startJourneyButton.id = 'start-journey';
startJourneyButton.innerHTML = '<i class="fas fa-play"></i> Start Journey';
startJourneyButton.style.display = 'none';
document.body.appendChild(startJourneyButton);

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

// Add light effect to make 3D buildings look better
map.setLight({
    anchor: 'viewport',
    color: 'white',
    intensity: 0.4,
    position: [1.5, 90, 80]
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        map.resize();
    }, 200);
});
