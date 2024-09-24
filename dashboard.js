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
    'CF': 'Coastal floods'
};

// Exposure categories name mapping
const expCatNames = {
    'POP': 'Population',
    'BU': 'Built-Up',
    'AGR': 'Cropland'
};

// Hardcoded country data
const countriesData = [
    { NAM_0: "Jamaica", ISO_A3: "JAM", ADM_lvl: 1, HZD_list: "FL;CF" },
    { NAM_0: "Tunisia", ISO_A3: "TUN", ADM_lvl: 2, HZD_list: "FL;CF" },
    { NAM_0: "Philippines", ISO_A3: "PHL", ADM_lvl: 2, HZD_list: "FL;CF" }
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
    selector.innerHTML = '<option value="">Select hazard type</option>';
    hazardList.split(';').forEach(hazardCode => {
        const option = document.createElement('option');
        option.value = hazardCode;
        option.textContent = hazardMapping[hazardCode];
        selector.appendChild(option);
    });
    selector.disabled = false;
}

// Populate period selector
function populatePeriodSelector() {
    const selector = document.getElementById('period-selector');
    selector.innerHTML = '<option value="">Select time period</option>';
    ['2020', '2030', '2050', '2080'].forEach(period => {
        const option = document.createElement('option');
        option.value = period;
        option.textContent = period;
        selector.appendChild(option);
    });
}

// Populate scenario selector
function populateScenarioSelector() {
    const selector = document.getElementById('scenario-selector');
    selector.innerHTML = '<option value="">Select climate scenario</option>';
    [
        { value: 'SSP1_2.6', text: 'SSP1-2.6' },
        { value: 'SSP2_4.5', text: 'SSP2-4.5' },
        { value: 'SSP3_7.0', text: 'SSP3-7.0' },
        { value: 'SSP5_8.5', text: 'SSP5-8.5' }
    ].forEach(scenario => {
        const option = document.createElement('option');
        option.value = scenario.value;
        option.textContent = scenario.text;
        selector.appendChild(option);
    });
}

// Load XLSX data
async function loadXLSXData(isoA3, admLevel, hazardCode, expCat, period, scenario) {
    try {
        let fileName;
        if (period === '2020') {
            fileName = `data/${isoA3}_ADM${admLevel}_${hazardCode}_${period}.xlsx`;
        } else {
            fileName = `data/${isoA3}_ADM${admLevel}_${hazardCode}_${period}_${scenario}.xlsx`;
        }
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

        // Load Summary sheet
        const summarySheet = workbook.Sheets['Summary'];
        if (!summarySheet) {
            throw new Error('Summary sheet not found in workbook');
        }
        const summaryData = XLSX.utils.sheet_to_json(summarySheet);

        console.log(`Loaded ${jsonData.length} rows of data and ${summaryData.length} rows of summary data`);
        return { mainData: jsonData, summaryData: summaryData };
    } catch (error) {
        console.error('Error loading XLSX data:', error);
        return null;
    }
}

// Create a legend
function createLegend(colorScale, breaks, expCat) {
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '6px 8px';
        div.style.font = '14px Arial, Helvetica, sans-serif';
        div.style.lineHeight = '18px';
        div.style.margin = '0 0 5px 0';
        div.style.color = '#555';

        let title;
        switch(expCat) {
            case 'POP':
                title = 'Population EAI [#]';
                break;
            case 'BU':
                title = 'Built-up EAI [Ha]';
                break;
            case 'AGR':
                title = 'Cropland EAI [Ha]';
                break;
            default:
                title = 'EAI';
        }

        div.innerHTML = '<h4 style="margin:0 0 10px 0;">' + title + '</h4>';

        if (breaks && breaks.length > 0) {
            breaks.reverse();

            for (let i = 0; i < breaks.length; i++) {
                const color = colorScale(breaks[i]).hex();
                const nextBreak = breaks[i + 1] || 0;
                div.innerHTML +=
                    '<i style="background:' + color + '; width: 18px; height: 18px; float: left; margin-right: 8px; opacity: 0.7;"></i> ' +
                    (i === breaks.length - 1 ? '0 &ndash; ' : '') +
                    nextBreak.toFixed(4) + (i === 0 ? '+' : '') + '<br>';
            }
        } else {
            div.innerHTML += '<i style="background: #FFFFFF; width: 18px; height: 18px; float: left; margin-right: 8px; opacity: 0.7;"></i> No data<br>';
        }
        
        return div;
    };
    return legend;
}

// Jenks function
function getJenksBreaks(data, numClasses) {
    if (data.length < numClasses) {
        // Not enough data for the requested number of classes
        return data.sort((a, b) => a - b);
    }
    return ss.jenks(data, numClasses);
}

// GetColorScale function
function getColorScale(data, expCat) {
    const values = data.map(d => d[`${expCat}_EAI`]).filter(v => v > 0);
    if (values.length === 0) {
        // No positive values, return a dummy scale
        return chroma.scale(['#FFFFFF', '#FFFFFF']).domain([0, 1]);
    }
    const breaks = getJenksBreaks(values, Math.min(6, values.length));
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
    const breaks = getJenksBreaks(xlsxData.map(d => d[`${expCat}_EAI`]).filter(v => v > 0), 6);

    if (map.legend) {
        map.removeControl(map.legend);
    }
    map.legend = createLegend(colorScale, breaks, expCat);
    map.legend.addTo(map);

    currentADMLayer.eachLayer(layer => {
        const properties = layer.feature.properties;
        const NameCode = properties[`NAM_${admLevel}`];
        const matchingData = xlsxData.find(row => row[`NAM_${admLevel}`] === NameCode);

        if (matchingData) {
            const eaiValue = parseFloat(matchingData[`${expCat}_EAI`]) || 0;
            const eaiPercentage = parseFloat(matchingData[`${expCat}_EAI%`]) || 0;

            // Update layer style based on EAI value
            if (eaiValue > 0) {
                layer.setStyle({
                    fillColor: getColor(eaiValue, colorScale),
                    fillOpacity: 0.7
                });
            } else {
                layer.setStyle({
                    fillColor: 'transparent',
                    fillOpacity: 0
                });
            }

            // Add popup with EAI information
            layer.bindPopup(`
                <strong>${properties[`NAM_${admLevel}`]}</strong><br>
                EAI: ${eaiValue.toFixed(4)}<br>
                EAI%: ${eaiPercentage.toFixed(4)}%
            `);
        } else {
            console.warn(`No matching data found for NAM_${admLevel}: ${NameCode}`);
            layer.setStyle({
                fillColor: 'transparent',
                fillOpacity: 0
            });
            layer.bindPopup(`<strong>${properties[`NAM_${admLevel}`]}</strong><br>No data available`);
        }
    });
}

// Create EAI chart for selected exp category
function create_eai_chart(dfData, exp_cat, color, countryName, period) {
    // Defining the title and sub-title
    const mainTitle = `${countryName}, ${period}`;
    const title = `Flood x ${expCatNames[exp_cat]} EAI`;
    const subtitle = 'Exceedance frequency curve';

    // Defining the x- and y-axis data and text
    const x = dfData.map(d => d.Freq);
    const y = dfData.map(d => d[`${exp_cat}_impact`]);
    const xlbl = 'Frequency';
    const ylbl = `Impact (${expCatNames[exp_cat]})`;

    // Defining if plotting total EAI
    const txtTotal = true;
    const xpos = 0.70;
    const totEAI = d3.sum(dfData.map(d => d[`${exp_cat}_EAI`]));

    // Create the plot
    const margin = {top: 100, right: 30, bottom: 50, left: 75};
    const width = 450 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(x)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(y)])
        .range([height, 0]);

    // Create axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Create the line
    const line = d3.line()
        .x(d => xScale(d.Freq))
        .y(d => yScale(d[`${exp_cat}_impact`]));

    // Add the line path
    svg.append("path")
        .datum(dfData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("d", line);

    // Add area under the curve
    const area = d3.area()
        .x(d => xScale(d.Freq))
        .y0(height)
        .y1(d => yScale(d[`${exp_cat}_impact`]));

    svg.append("path")
        .datum(dfData)
        .attr("fill", color)
        .attr("fill-opacity", 0.3)
        .attr("d", area);

    // Add main title (country name and period)
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2) - 30)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text(mainTitle);

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2) - 10)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(title);

    // Add subtitle
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 4))
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(subtitle);

    // Add axis labels
    svg.append("text")
        .attr("transform", `translate(${width/2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .text(xlbl);

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(ylbl);

    // Add total EAI text
    if (txtTotal) {
        svg.append("text")
            .attr("x", width * xpos)
            .attr("y", height * 0.1)
            .attr("text-anchor", "start")
            .style("font-size", "15px")
            .style("font-weight", "bold")
            .text(`EAI = ${totEAI.toFixed(2)}`);
    }

    // Add RP labels
    dfData.forEach(d => {
        svg.append("text")
            .attr("x", xScale(d.Freq))
            .attr("y", yScale(d[`${exp_cat}_impact`]))
            .attr("dx", 5)
            .attr("dy", -5)
            .style("font-size", "10px")
            .text(`RP ${d.RP}`);
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
        document.getElementById('adm-level-selector').disabled = false;
        document.getElementById('hazard-selector').disabled = true;
        document.getElementById('period-selector').disabled = true;
        document.getElementById('scenario-selector').disabled = true;
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
        document.getElementById('hazard-selector').disabled = false;
        document.getElementById('period-selector').disabled = true;
        document.getElementById('scenario-selector').disabled = true;
        document.getElementById('exposure-selector').disabled = true;
        const geojsonData = await fetchADMData(country, admLevel);
        updateMap(geojsonData, admLevel);
    }
});

document.getElementById('hazard-selector').addEventListener('change', (event) => {
    const hazard = event.target.value;
    if (hazard) {
        populatePeriodSelector(); // Add this line to populate the period selector
        document.getElementById('period-selector').disabled = false;
        document.getElementById('scenario-selector').disabled = true;
        document.getElementById('exposure-selector').disabled = true;
    }
});

document.getElementById('period-selector').addEventListener('change', (event) => {
    const period = event.target.value;
    if (period) {
        if (period === '2020') {
            document.getElementById('scenario-selector').disabled = true;
            document.getElementById('exposure-selector').disabled = false;
        } else {
            document.getElementById('scenario-selector').disabled = false;
            document.getElementById('exposure-selector').disabled = true;
            populateScenarioSelector();
        }
    }
});

document.getElementById('scenario-selector').addEventListener('change', (event) => {
    const scenario = event.target.value;
    if (scenario) {
        document.getElementById('exposure-selector').disabled = false;
    }
});

// Exposure selector event listener
document.getElementById('exposure-selector').addEventListener('change', async (event) => {
    const expCat = event.target.value;
    const countrySelector = document.getElementById('country-selector');
    const country = countrySelector.value;
    const countryName = countrySelector.options[countrySelector.selectedIndex].text;
    const admLevel = document.getElementById('adm-level-selector').value;
    const hazard = document.getElementById('hazard-selector').value;
    const period = document.getElementById('period-selector').value;
    const scenario = document.getElementById('scenario-selector').value;

    if (country && admLevel && hazard && expCat && period && (period === '2020' || scenario)) {
        try {
            console.log(`Loading XLSX data for ${country}, ADM${admLevel}, ${hazard}, ${expCat}, ${period}, ${scenario}`);
            const data = await loadXLSXData(country, admLevel, hazard, expCat, period, scenario);
            console.log('XLSX data loaded:', data);
            if (data) {
                updateMapWithXLSXData(data.mainData, admLevel, expCat);
                
                // Clear previous chart
                document.getElementById('chart').innerHTML = '';
                
                // Create new chart
                const colorMap = { 'POP': 'blue', 'BU': 'orange', 'AGR': 'green' };
                create_eai_chart(data.summaryData, expCat, colorMap[expCat], countryName, period);
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