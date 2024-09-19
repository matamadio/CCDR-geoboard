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
    { NAM_0: "Jamaica", ISO_A3: "JAM", ADM_lvl: 1, HZD_list: "FL;CF" },
    { NAM_0: "Cambodia", ISO_A3: "KHM", ADM_lvl: 2, HZD_list: "FL;CF;LS;TC;HS" },
    { NAM_0: "Lao PDR", ISO_A3: "LAO", ADM_lvl: 2, HZD_list: "FL" },
    { NAM_0: "Tunisia", ISO_A3: "TUN", ADM_lvl: 2, HZD_list: "FL" }
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

// Function to get the correct layer ID based on administrative level
async function getLayerIdForAdm(admLevel) {
    const layersUrl = `https://services.arcgis.com/iQ1dY19aHwbSDYIF/ArcGIS/rest/services/World_Bank_Global_Administrative_Divisions_VIEW/FeatureServer/layers`;
    const targetLayerName = `WB_GAD_ADM${admLevel}`;

    try {
        const response = await axios.get(layersUrl, { params: { f: 'json' } });
        const layersInfo = response.data.layers;
        
        for (const layer of layersInfo) {
            if (layer.name === targetLayerName) {
                return layer.id;
            }
        }
        console.error(`Layer matching ${targetLayerName} not found.`);
        return null;
    } catch (error) {
        console.error('Error fetching layers:', error);
        return null;
    }
}

// Fetch ADM data
async function fetchADMData(country, admLevel) {
    console.log(`Fetching ADM data for ${country}, level ${admLevel}`);
    const layerId = await getLayerIdForAdm(admLevel);
    
    if (!layerId) {
        console.error("Invalid administrative level or layer mapping not found.");
        return null;
    }

    const queryUrl = `https://services.arcgis.com/iQ1dY19aHwbSDYIF/ArcGIS/rest/services/World_Bank_Global_Administrative_Divisions_VIEW/FeatureServer/${layerId}/query`;
    const params = {
        where: `ISO_A3 = '${country}'`,
        outFields: '*',
        f: 'geojson'
    };

    try {
        console.log('Fetching from URL:', queryUrl);
        console.log('With params:', params);
        const response = await axios.get(queryUrl, { params });
        console.log('Response received:', response.status);
        return response.data;
    } catch (error) {
        console.error('Error fetching ADM data:', error);
        return null;
    }
}

// Update map with ADM data
function updateMap(geojsonData, admLevel) {
    console.log('Updating map with geojson data:', geojsonData);
    if (currentADMLayer) {
        map.removeLayer(currentADMLayer);
    }

    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
        console.error('Invalid or empty GeoJSON data');
        return;
    }

    currentADMLayer = L.geoJSON(geojsonData, {
        style: {
            color: 'black',
            weight: 2,
            fillOpacity: 0
        }
    }).addTo(map);

    console.log('Layer added to map');

    const bounds = currentADMLayer.getBounds();
    console.log('Layer bounds:', bounds);
    map.fitBounds(bounds);
    console.log('Map fitted to bounds');
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
        const fileName = `data/${isoA3}_ADM${admLevel}_${hazardCode}.xlsx`;
        console.log(`Attempting to load XLSX file: ${fileName}`);
        const response = await fetch(fileName);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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
            default:
                throw new Error(`Unknown exposure category: ${expCat}`);
        }
        
        console.log(`Reading sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            throw new Error(`Sheet ${sheetName} not found in workbook`);
        }
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        console.log(`Loaded ${jsonData.length} rows of data`);
        return jsonData;
    } catch (error) {
        console.error('Error loading XLSX data:', error);
        return null;
    }
}

// Calculate Jenks breaks
function getJenksBreaks(data, numClasses) {
    return ss.jenks(data, numClasses);
}

// Create a legend
function createLegend(colorScale, breaks) {
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '6px 8px';
        div.style.font = '14px Arial, Helvetica, sans-serif';
        div.style.lineHeight = '18px';
        div.style.margin = '0 0 5px 0';
        div.style.color = '#555';

        // Reverse the breaks array
        breaks.reverse();

        for (let i = 0; i < breaks.length; i++) {
            const color = colorScale(breaks[i]).hex();
            const nextBreak = breaks[i + 1] || 0; // Use 0 as the lower bound
            div.innerHTML +=
                '<i style="background:' + color + '; width: 18px; height: 18px; float: left; margin-right: 8px; opacity: 0.7;"></i> ' +
                (nextBreak !== 0 ? nextBreak.toFixed(2) + '&ndash;' : '<') + breaks[i].toFixed(2) + '<br>';
        }
        return div;
    };
    return legend;
}

// GetColorScale function
function getColorScale(data, expCat) {
    const values = data.map(d => d[`${expCat}_EAI`]);
    const breaks = getJenksBreaks(values, 6);
    const colorScale = chroma.scale(['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#BD0026']).classes(breaks);
    return colorScale;
}

// Update the getColor function
function getColor(value, colorScale) {
    return colorScale(value).hex();
}

// Update map with XLSX data
function updateMapWithXLSXData(xlsxData, admLevel, expCat) {
    console.log(`Updating map with XLSX data for ADM${admLevel}, ${expCat}`);
    if (!currentADMLayer) {
        console.error('No current ADM layer to update');
        return;
    }

    const colorScale = getColorScale(xlsxData, expCat);
    const breaks = getJenksBreaks(xlsxData.map(d => d[`${expCat}_EAI`]), 6);

    if (map.legend) {
        map.removeControl(map.legend);
    }
    map.legend = createLegend(colorScale, breaks);
    map.legend.addTo(map);

    currentADMLayer.eachLayer(layer => {
        const properties = layer.feature.properties;
        const hascCode = properties[`HASC_${admLevel}`];
        const matchingData = xlsxData.find(row => row[`HASC_${admLevel}`] === hascCode);

        if (matchingData) {
            const eaiValue = matchingData[`${expCat}_EAI`];
            const eaiPercentage = matchingData[`${expCat}_EAI%`];

            // Update layer style based on EAI value
            layer.setStyle({
                fillColor: getColor(eaiValue, colorScale),
                fillOpacity: 0.7
            });

            // Add popup with EAI information
            layer.bindPopup(`
                <strong>${properties[`NAM_${admLevel}`]}</strong><br>
                EAI: ${eaiValue.toFixed(2)}<br>
                EAI%: ${eaiPercentage.toFixed(2)}%
            `);
        } else {
            console.warn(`No matching data found for HASC_${admLevel}: ${hascCode}`);
        }
    });
}

// Event listeners
document.getElementById('country-selector').addEventListener('change', async (event) => {
    const country = event.target.value;
    console.log('Country selected:', country);
    if (country) {
        const countryData = countriesData.find(d => d.ISO_A3 === country);
        console.log('Country data:', countryData);
        populateADMLevelSelector(countryData.ADM_lvl);
        document.getElementById('hazard-selector').disabled = true;
        document.getElementById('exposure-selector').disabled = true;

        // Fetch and plot country boundaries (ADM level 0)
        console.log('Fetching country boundaries');
        const geojsonData = await fetchADMData(country, 0);
        console.log('Fetched geojson data:', geojsonData);
        if (geojsonData) {
            updateMap(geojsonData, 0);
        } else {
            console.error('Failed to fetch country boundaries');
        }
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
        try {
            console.log(`Loading XLSX data for ${country}, ADM${admLevel}, ${hazard}, ${expCat}`);
            const xlsxData = await loadXLSXData(country, admLevel, hazard, expCat);
            console.log('XLSX data loaded:', xlsxData);
            if (xlsxData) {
                updateMapWithXLSXData(xlsxData, admLevel, expCat);
            } else {
                console.error('No XLSX data loaded');
            }
        } catch (error) {
            console.error('Error loading or updating data:', error);
        }
    }
});

// Initialize the dashboard
populateCountrySelector();