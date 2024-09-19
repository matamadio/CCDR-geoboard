// Initialize the map
const map = L.map('map').setView([0, 0], 2);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Add layer control
const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    "Topographic": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }),
    "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    })
};

L.control.layers(baseMaps).addTo(map);

// Global variables
let currentCountryLayer = null;
let currentADMLayer = null;

// Fetch countries data
async function fetchCountries() {
    try {
        const response = await axios.get('https://services.arcgis.com/iQ1dY19aHwbSDYIF/ArcGIS/rest/services/World_Bank_Global_Administrative_Divisions_VIEW/FeatureServer/0/query?where=1%3D1&outFields=ISO_A3,NAM_0&returnGeometry=false&f=json');
        const countries = response.data.features.map(feature => ({
            iso: feature.attributes.ISO_A3,
            name: feature.attributes.NAM_0
        }));
        populateCountrySelector(countries);
    } catch (error) {
        console.error('Error fetching countries:', error);
    }
}

// Populate country selector
function populateCountrySelector(countries) {
    const selector = document.getElementById('country-selector');
    countries.sort((a, b) => a.name.localeCompare(b.name)).forEach(country => {
        const option = document.createElement('option');
        option.value = country.iso;
        option.textContent = country.name;
        selector.appendChild(option);
    });
}

// Fetch ADM data
async function fetchADMData(country, admLevel) {
    try {
        const layerId = admLevel;
        const url = `https://services.arcgis.com/iQ1dY19aHwbSDYIF/ArcGIS/rest/services/World_Bank_Global_Administrative_Divisions_VIEW/FeatureServer/${layerId}/query`;
        const params = {
            where: `ISO_A3 = '${country}'`,
            outFields: '*',
            f: 'geojson'
        };
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching ADM data:', error);
    }
}

// Update map with ADM data
function updateMap(geojsonData, admLevel) {
    if (currentADMLayer) {
        map.removeLayer(currentADMLayer);
    }

    currentADMLayer = L.geoJSON(geojsonData, {
        style: {
            color: 'black',
            weight: 2,
            fillOpacity: 0
        }
    }).addTo(map);

    map.fitBounds(currentADMLayer.getBounds());
}

// Event listeners
document.getElementById('country-selector').addEventListener('change', async (event) => {
    const country = event.target.value;
    if (country) {
        const admLevel = document.getElementById('adm-level-selector').value;
        const geojsonData = await fetchADMData(country, admLevel);
        updateMap(geojsonData, admLevel);
    }
});

document.getElementById('adm-level-selector').addEventListener('change', async (event) => {
    const admLevel = event.target.value;
    const country = document.getElementById('country-selector').value;
    if (country) {
        const geojsonData = await fetchADMData(country, admLevel);
        updateMap(geojsonData, admLevel);
    }
});

// Initialize the dashboard
fetchCountries();