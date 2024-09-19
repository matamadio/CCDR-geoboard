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

// Hazard code to name mapping
const hazardMapping = {
    'FL': 'River floods',
    'CF': 'Coastal floods',
    'LS': 'Landslides',
    'TC': 'Tropical cyclones',
    'HS': 'Heat stress',
    'DR': 'Drought'
};

// Hardcoded country data
const countriesData = [
    { NAM_0: "Jamaica", ISO_A3: "JAM", ADM_lvl: 2, HZD_list: "FL;CF" },
    { NAM_0: "Cambodia", ISO_A3: "KHM", ADM_lvl: 3, HZD_list: "FL;CF;LS;TC;HS" },
    { NAM_0: "Lao PDR", ISO_A3: "LAO", ADM_lvl: 2, HZD_list: "FL" },
    { NAM_0: "Tunisia", ISO_A3: "TUN", ADM_lvl: 3, HZD_list: "FL" }
];

// Populate country selector
function populateCountrySelector() {
    const selector = document.getElementById('country-selector');
    countriesData.sort((a, b) => a.NAM_0.localeCompare(b.NAM_0)).forEach(country => {
        const option = document.createElement('option');
        option.value = country.ISO_A3;
        option.textContent = country.NAM_0;
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

// Populate ADM level selector
function populateADMLevelSelector(maxLevel) {
    const selector = document.getElementById('adm-level-selector');
    selector.innerHTML = '<option value="">Select ADM level</option>';
    for (let i = 1; i <= maxLevel; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `ADM level ${i}`;
        selector.appendChild(option);
    }
    selector.disabled = false;
}

// Populate hazard selector
function populateHazardSelector(hazardList) {
    const selector = document.getElementById('hazard-selector');
    selector.innerHTML = '<option value="">Select a hazard</option>';
    hazardList.split(';').forEach(hazardCode => {
        const option = document.createElement('option');
        option.value = hazardCode;
        option.textContent = hazardMapping[hazardCode];
        selector.appendChild(option);
    });
    selector.disabled = false;
}

// Load XLSX data
async function loadXLSXData(isoA3, admLevel, hazardCode, expCat) {
    try {
        const fileName = `data/${isoA3}_${admLevel}_${hazardCode}.xlsx`;
        const response = await fetch(fileName);
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let sheetName;
        switch (expCat) {
            case 'POP':
                sheetName = 'POP_EAI_function';
                break;
            case 'BU':
                sheetName = 'BU_EAI_function';
                break;
            case 'AGR':
                sheetName = 'AGR_EAI_function';
                break;
        }
        
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(sheet);
    } catch (error) {
        console.error('Error loading XLSX data:', error);
    }
}

// Update map with XLSX data
function updateMapWithXLSXData(xlsxData, admLevel) {
    if (!currentADMLayer) return;

    currentADMLayer.eachLayer(layer => {
        const properties = layer.feature.properties;
        const hascCode = properties[`HASC_${admLevel}`];
        const matchingData = xlsxData.find(row => row[`HASC_${admLevel}`] === hascCode);

        if (matchingData) {
            const eaiValue = matchingData[`${expCat}_EAI`];
            const eaiPercentage = matchingData[`${expCat}_EAI%`];

            // Update layer style based on EAI value
            layer.setStyle({
                fillColor: getColor(eaiValue),
                fillOpacity: 0.7
            });

            // Add popup with EAI information
            layer.bindPopup(`
                <strong>${properties[`NAM_${admLevel}`]}</strong><br>
                EAI: ${eaiValue.toFixed(2)}<br>
                EAI%: ${eaiPercentage.toFixed(2)}%
            `);
        }
    });
}

// Color scale function for EAI values
function getColor(eaiValue) {
    // Implement your color scale logic here
    // This is a simple example, you may want to use a more sophisticated scale
    return eaiValue > 1000 ? '#800026' :
           eaiValue > 500  ? '#BD0026' :
           eaiValue > 200  ? '#E31A1C' :
           eaiValue > 100  ? '#FC4E2A' :
           eaiValue > 50   ? '#FD8D3C' :
           eaiValue > 20   ? '#FEB24C' :
           eaiValue > 10   ? '#FED976' :
                             '#FFEDA0';
}

// Event listeners
document.getElementById('country-selector').addEventListener('change', async (event) => {
    const country = event.target.value;
    if (country) {
        const countryData = countriesData.find(d => d.ISO_A3 === country);
        populateADMLevelSelector(countryData.ADM_lvl);
        document.getElementById('hazard-selector').disabled = true;
        document.getElementById('exposure-selector').disabled = true;
    }
});

document.getElementById('adm-level-selector').addEventListener('change', async (event) => {
    const admLevel = event.target.value;
    const country = document.getElementById('country-selector').value;
    if (country && admLevel) {
        const countryData = countriesData.find(d => d.ISO_A3 === country);
        populateHazardSelector(countryData.HZD_list);
        const geojsonData = await fetchADMData(country, admLevel);
        updateMap(geojsonData, admLevel);
    }
});

document.getElementById('hazard-selector').addEventListener('change', (event) => {
    const hazard = event.target.value;
    if (hazard) {
        document.getElementById('exposure-selector').disabled = false;
    }
});

document.getElementById('exposure-selector').addEventListener('change', async (event) => {
    const expCat = event.target.value;
    const country = document.getElementById('country-selector').value;
    const admLevel = document.getElementById('adm-level-selector').value;
    const hazard = document.getElementById('hazard-selector').value;

    if (country && admLevel && hazard && expCat) {
        const xlsxData = await loadXLSXData(country, admLevel, hazard, expCat);
        updateMapWithXLSXData(xlsxData, admLevel);
    }
});

// Initialize the dashboard
populateCountrySelector();