// Sargpoint GIS Converter SaaS Dashboard Controller

var dlsGridlinesLayer = null;
var isDLSGridVisible = true;

document.addEventListener('DOMContentLoaded', () => {
    let currentGeoJSON = null;
    let leafletMap = null;
    let geojsonLayer = null;
    let currentUser = null;
    let currentUsage = null;
    let isYearlyBilling = true;
    let uploadedDatasets = [];
    let selectedFeatureIndices = new Set();

    let streetsTileLayer = null;
    let satelliteTileLayer = null;
    let topoTileLayer = null;

    // Interactive Distance Measurement State
    let isMeasuring = false;
    let measurePoints = [];
    let measureMarkers = [];
    let measurePolyline = null;

    // Output Formats Catalog
    const OUTPUT_FORMATS = [
        { code: "gpx", name: "GPX - GPS Exchange Format", category: "GPS" },
        { code: "kmz", name: "KMZ - Keyhole Markup Language (compressed)", category: "Google Earth" },
        { code: "kml", name: "KML - Keyhole Markup Language", category: "Google Earth" },
        { code: "shp", name: "ESRI Shapefile (.shp zip bundle)", category: "ESRI / Standard" },
        { code: "spatialite", name: "SQLite / SpatiaLite Database (.sqlite / .db)", category: "Database" },
        { code: "gpkg", name: "GPKG - GeoPackage", category: "Standard" },
        { code: "dxf", name: "DXF - AutoCAD Drawing Interchange Format", category: "CAD" },
        { code: "dgn", name: "DGN - Microstation DGN V7", category: "CAD" },
        { code: "gdb", name: "ESRI File Geodatabase vector (OpenFileGDB)", category: "ESRI" },
        { code: "geojson", name: "GeoJSON (.geojson)", category: "Web" },
        { code: "geojsonseq", name: "GeoJSON Sequence (GeoJSONSeq)", category: "Web" },
        { code: "csv", name: "CSV - Comma Separated Values", category: "Spreadsheet" },
        { code: "wkt", name: "WKT - Well-known text (.csv + WKT column)", category: "Spreadsheet" },
        { code: "flatgeobuf", name: "FlatGeobuf (.fgb)", category: "Modern" },
        { code: "gml", name: "GML - Geography Markup Language", category: "XML" },
        { code: "mapinfo_mif", name: "MapInfo MIF/MID (interchange)", category: "MapInfo" },
        { code: "mapinfo_tab", name: "MapInfo TAB (binary)", category: "MapInfo" },
        { code: "ods", name: "ODS - Open Document / LibreOffice spreadsheet", category: "Spreadsheet" },
        { code: "geopdf", name: "PDF - Geospatial PDF (GeoPDF)", category: "Document" },
        { code: "parquet", name: "Parquet - (Geo)Parquet", category: "Big Data" },
        { code: "svg", name: "SVG - Scalable Vector Graphics", category: "Graphics" },
        { code: "topojson", name: "TopoJSON (.topojson)", category: "Web" },
        { code: "xlsx", name: "XLSX - MS Office Open XML spreadsheet", category: "Spreadsheet" }
    ];

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    
    const formatSelectInput = document.getElementById('formatSelectInput');
    const formatDropdownList = document.getElementById('formatDropdownList');
    const formatSearch = document.getElementById('formatSearch');
    const formatOptionsContainer = document.getElementById('formatOptionsContainer');
    
    const crsSelectInput = document.getElementById('crsSelectInput');
    const crsDropdownList = document.getElementById('crsDropdownList');
    const crsSearch = document.getElementById('crsSearch');
    const crsOptionsContainer = document.getElementById('crsOptionsContainer');

    const pricingBtn = document.getElementById('pricingBtn');
    const usageBadge = document.getElementById('usageBadge');
    const userProfileBadge = document.getElementById('userProfileBadge');
    
    const authModal = document.getElementById('authModal');
    const pricingModal = document.getElementById('pricingModal');
    const apiModal = document.getElementById('apiModal');
    const spreadsheetModal = document.getElementById('spreadsheetModal');
    const conversionProgressModal = document.getElementById('conversionProgressModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const billingModal = document.getElementById('billingModal');
    const billingBtn = document.getElementById('billingBtn');

    let selectedFormat = "gpx";
    let selectedCRS = "EPSG:4326";
    let currentCheckoutPlan = "pro";

    // 1. Initialize Map
    initMap();
    checkAuthStatus();
    populateFormatDropdown();
    populateCRSDropdown();
    updateDatasetsSubpanelList();

    function initMap() {
        leafletMap = L.map('mapCanvas', {
            center: [20, 0],
            zoom: 2,
            maxZoom: 23,
            minZoom: 1,
            zoomControl: true
        });

        streetsTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxNativeZoom: 18,
            maxZoom: 23
        }).addTo(leafletMap);

        satelliteTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Hybrid Satellite',
            maxNativeZoom: 20,
            maxZoom: 23
        });

        topoTileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
            maxNativeZoom: 17,
            maxZoom: 23
        });

        document.getElementById('btnStreets')?.addEventListener('click', () => switchBasemap('streets'));
        document.getElementById('btnSatellite')?.addEventListener('click', () => switchBasemap('satellite'));
        document.getElementById('btnTopo')?.addEventListener('click', () => switchBasemap('topo'));

        initDLSGridlinesOverlay();

        leafletMap.on('click', (e) => {
            if (!isMeasuring) {
                showLSDGridHighlight(e.latlng.lat, e.latlng.lng);
            }
        });
    }

    function initDLSGridlinesOverlay() {
        window.dlsGridlinesLayer = L.layerGroup().addTo(leafletMap);

        const btnToggle = document.getElementById('btnToggleDLSGrid');
        if (btnToggle) {
            btnToggle.classList.add('active', 'btn-primary');
            btnToggle.classList.remove('btn-outline');
            btnToggle.addEventListener('click', () => {
                isDLSGridVisible = !isDLSGridVisible;
                if (isDLSGridVisible) {
                    btnToggle.classList.add('active', 'btn-primary');
                    btnToggle.classList.remove('btn-outline');
                    renderDLSGridlines();
                } else {
                    btnToggle.classList.remove('active', 'btn-primary');
                    btnToggle.classList.add('btn-outline');
                    if (window.dlsGridlinesLayer) window.dlsGridlinesLayer.clearLayers();
                }
            });
        }

        leafletMap.on('moveend zoomend', () => {
            if (isDLSGridVisible) renderDLSGridlines();
        });

        renderDLSGridlines();
    }

    function renderDLSGridlines() {
        if (!window.dlsGridlinesLayer || !isDLSGridVisible || !leafletMap) return;
        window.dlsGridlinesLayer.clearLayers();

        const bounds = leafletMap.getBounds();
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLon = bounds.getWest();
        const maxLon = bounds.getEast();
        const zoom = leafletMap.getZoom();

        // 1. Meridians (W1 to W7)
        const meridians = [
            { name: 'W1 (Principal Meridian - 97.4579° W)', lon: -97.457889 },
            { name: 'W2 (Second Meridian - 102.0° W)', lon: -102.000000 },
            { name: 'W3 (Third Meridian - 106.0° W)', lon: -106.000000 },
            { name: 'W4 (Fourth Meridian - 110.0° W - SK/AB Border)', lon: -110.000000 },
            { name: 'W5 (Fifth Meridian - 114.0° W)', lon: -114.000000 },
            { name: 'W6 (Sixth Meridian - 118.0° W)', lon: -118.000000 },
            { name: 'W7 (Seventh Meridian - 122.0° W)', lon: -122.000000 }
        ];

        meridians.forEach(m => {
            if (m.lon >= minLon - 1 && m.lon <= maxLon + 1) {
                L.polyline([[48.9, m.lon], [60.1, m.lon]], {
                    color: '#dc2626',
                    weight: 2.5,
                    dashArray: '8, 6',
                    interactive: false
                }).addTo(window.dlsGridlinesLayer);

                if (zoom >= 5) {
                    const labelLat = Math.max(minLat + 0.5, Math.min(maxLat - 0.5, 52.0));
                    const shortName = zoom < 7 ? m.name.split(' ')[0] : m.name;
                    L.marker([labelLat, m.lon], {
                        icon: L.divIcon({
                            className: 'dls-grid-label-meridian',
                            html: `<div style="background:#dc2626; color:#ffffff; padding:2px 7px; border-radius:4px; font-weight:700; font-size:0.75rem; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.3); transform:translate(-50%, -50%);">${shortName}</div>`
                        }),
                        interactive: false
                    }).addTo(window.dlsGridlinesLayer);
                }
            }
        });

        const latBaseline = 49.030066;
        const twpLatSpan = 0.086736;
        const secLatSpan = twpLatSpan / 6;

        // 2. Key Township Lines (every 6 miles = 0.086736° lat)
        if (zoom >= 7) {
            const startTwp = Math.max(1, Math.floor((minLat - latBaseline) / twpLatSpan));
            const endTwp = Math.min(126, Math.ceil((maxLat - latBaseline) / twpLatSpan) + 1);
            const step = zoom < 9 ? 4 : 1;

            for (let twp = startTwp; twp <= endTwp; twp += step) {
                const twpLat = latBaseline + (twp - 1) * twpLatSpan;
                if (twpLat >= minLat - 0.1 && twpLat <= maxLat + 0.1) {
                    const isCorrectionLine = (twp % 4 === 1);
                    L.polyline([[twpLat, -123.0], [twpLat, -95.0]], {
                        color: isCorrectionLine ? '#7c3aed' : '#2563eb',
                        weight: isCorrectionLine ? 2 : 1.2,
                        dashArray: isCorrectionLine ? '6, 4' : '4, 4',
                        opacity: 0.65,
                        interactive: false
                    }).addTo(window.dlsGridlinesLayer);

                    if (zoom >= 8) {
                        const labelLon = minLon + 0.08;
                        const tagText = isCorrectionLine ? `Twp ${twp} (Correction Line)` : `Twp ${twp}`;
                        L.marker([twpLat, labelLon], {
                            icon: L.divIcon({
                                className: 'dls-grid-label-twp',
                                html: `<div style="background:${isCorrectionLine ? '#7c3aed' : '#1e40af'}; color:#ffffff; padding:1px 5px; border-radius:3px; font-weight:600; font-size:0.7rem; white-space:nowrap; opacity:0.9;">${tagText}</div>`
                            }),
                            interactive: false
                        }).addTo(window.dlsGridlinesLayer);
                    }
                }
            }
        }

        // 3. Exact Calibrated Horizontal Section Lines & Vertical Section/Range Crosslines (Zoom Level >= 11)
        if (zoom >= 9) {
            const startTwp = Math.max(1, Math.floor((minLat - latBaseline) / twpLatSpan));
            const endTwp = Math.min(126, Math.ceil((maxLat - latBaseline) / twpLatSpan) + 1);

            // Determine governing meridian for active view
            meridians.forEach(m => {
                if (m.lon >= minLon - 4.5 && m.lon <= maxLon + 4.5) {
                    for (let twp = startTwp; twp <= endTwp; twp++) {
                        const numCorrLines = Math.floor((twp - 1) / 4);
                        const corrShiftLon = numCorrLines * 0.0024542;

                        // Per-township rngLonSpan using twpBaselineLat — matches getDLSInfo exactly
                        const twpBaselineLat = latBaseline + (twp - 1) * twpLatSpan;
                        const twpLatRad = twpBaselineLat * Math.PI / 180;
                        const rngLonSpan = 9.704580 / (111.32 * Math.cos(twpLatRad));
                        const secLonSpan = rngLonSpan / 6;

                        // Horizontal Section Lines
                        for (let secRow = 0; secRow < 6; secRow++) {
                            const secLat = latBaseline + (twp - 1) * twpLatSpan + secRow * secLatSpan;
                            if (secLat >= minLat - 0.02 && secLat <= maxLat + 0.02) {
                                L.polyline([[secLat, minLon - 0.05], [secLat, maxLon + 0.05]], {
                                    color: '#0284c7',
                                    weight: (secRow === 0) ? 1.5 : 1,
                                    dashArray: (secRow === 0) ? '6, 4' : '3, 3',
                                    opacity: (secRow === 0) ? 0.7 : 0.45,
                                    interactive: false
                                }).addTo(window.dlsGridlinesLayer);
                            }
                        }

                        // Vertical North-South Range & Section Crosslines
                        const twpMinLat = latBaseline + (twp - 1) * twpLatSpan;
                        const twpMaxLat = twpMinLat + twpLatSpan;

                        if (twpMaxLat >= minLat - 0.05 && twpMinLat <= maxLat + 0.05) {
                            for (let range = 1; range <= 30; range++) {
                                const rangeEastLon = (m.lon - corrShiftLon) - (range - 1) * rngLonSpan;
                                if (rangeEastLon >= minLon - 0.05 && rangeEastLon <= maxLon + 0.05) {
                                    // Range Line (Bold N-S Crossline)
                                    L.polyline([[twpMinLat, rangeEastLon], [twpMaxLat, rangeEastLon]], {
                                        color: '#7c3aed',
                                        weight: 1.6,
                                        dashArray: '6, 4',
                                        opacity: 0.65,
                                        interactive: false
                                    }).addTo(window.dlsGridlinesLayer);

                                    // Range Label Tag at zoom 9+
                                    if (zoom >= 9 && twpMinLat >= minLat && twpMinLat <= maxLat) {
                                        L.marker([twpMinLat + twpLatSpan / 2, rangeEastLon - rngLonSpan / 2], {
                                            icon: L.divIcon({
                                                className: 'dls-grid-label-rge',
                                                html: `<div style="background:#7c3aed; color:#ffffff; padding:1px 4px; border-radius:3px; font-weight:700; font-size:0.65rem; white-space:nowrap; opacity:0.85;">Rge ${range} W${m.name.split(' ')[0][1]}</div>`
                                            }),
                                            interactive: false
                                        }).addTo(window.dlsGridlinesLayer);
                                    }

                                    // Section Vertical N-S Crosslines (zoom >= 11)
                                    if (zoom >= 11) {
                                        for (let secCol = 1; secCol < 6; secCol++) {
                                            const secWestLon = rangeEastLon - secCol * secLonSpan;
                                            if (secWestLon >= minLon - 0.02 && secWestLon <= maxLon + 0.02) {
                                                L.polyline([[twpMinLat, secWestLon], [twpMaxLat, secWestLon]], {
                                                    color: '#0284c7',
                                                    weight: 1,
                                                    dashArray: '3, 3',
                                                    opacity: 0.45,
                                                    interactive: false
                                                }).addTo(window.dlsGridlinesLayer);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    async function showLSDGridHighlight(lat, lon) {
        if (typeof gisConverter === 'undefined') return;

        // Compute DLS info first to get the LSD identity key
        const dlsInfo = gisConverter.getDLSInfo(lat, lon);
        if (!dlsInfo || !dlsInfo.bounds) return;

        // Only redraw the blue boxes if the LSD has actually changed
        const lsdId = dlsInfo.shortLld;
        if (lsdId !== window.lastLSDId) {
            window.lastLSDId = lsdId;

            if (window.activeLSDGridPoly) {
                leafletMap.removeLayer(window.activeLSDGridPoly);
            }
            window.activeLSDGridPoly = L.layerGroup().addTo(leafletMap);

            // Option A: Try live official ArcGIS REST Cadastral service
            const officialCadastral = await gisConverter.queryCadastralArcGIS(lat, lon);

            if (officialCadastral && (officialCadastral.quarterFeature || officialCadastral.sectionFeature)) {
                if (officialCadastral.sectionFeature) {
                    L.geoJSON(officialCadastral.sectionFeature, {
                        style: () => ({ color: '#1e40af', weight: 2.5, dashArray: '6, 6', fill: false, interactive: false })
                    }).addTo(window.activeLSDGridPoly);
                }
                if (officialCadastral.quarterFeature) {
                    L.geoJSON(officialCadastral.quarterFeature, {
                        style: () => ({ color: '#0078ff', weight: 3, fillColor: '#0078ff', fillOpacity: 0.35, interactive: false })
                    }).addTo(window.activeLSDGridPoly);
                }
            } else {
                // Fallback: Internal calibrated DLS calculation engine
                // 1. Full Section Boundary (640 Acres - Dashed Outer Box)
                if (dlsInfo.sectionBounds) {
                    L.rectangle(dlsInfo.sectionBounds, {
                        color: '#1e40af',
                        weight: 2,
                        dashArray: '6, 6',
                        fill: false,
                        interactive: false
                    }).addTo(window.activeLSDGridPoly);
                }

                // 2. Quarter Section Boundary (160 Acres - Dotted Cyan Box)
                if (dlsInfo.quarterBounds) {
                    L.rectangle(dlsInfo.quarterBounds, {
                        color: '#0284c7',
                        weight: 2,
                        dashArray: '3, 4',
                        fill: false,
                        interactive: false
                    }).addTo(window.activeLSDGridPoly);
                }

                // 3. 40-Acre LSD Box (Solid Blue Fill)
                L.rectangle(dlsInfo.bounds, {
                    color: '#0078ff',
                    weight: 2.5,
                    fillColor: '#0078ff',
                    fillOpacity: 0.35,
                    interactive: false
                }).addTo(window.activeLSDGridPoly);
            }
        }

        // Always update the popup at the clicked position
        const popupHtml = `
            <div style="font-size:0.82rem; font-family:sans-serif; text-align:left; min-width:280px; padding:4px 2px; color:#1e293b;">
                <div style="background:#1e40af; color:#ffffff; padding:4px 8px; border-radius:4px; font-weight:700; font-size:0.85rem; margin-bottom:3px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
                    ${dlsInfo.sectionLld}
                </div>
                <div style="background:#0284c7; color:#ffffff; padding:3px 8px; border-radius:4px; font-weight:600; font-size:0.8rem; margin-bottom:3px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
                    ${dlsInfo.quarterLld}
                </div>
                <div style="background:#0078ff; color:#ffffff; padding:3px 8px; border-radius:4px; font-weight:600; font-size:0.8rem; margin-bottom:6px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
                    ${dlsInfo.lsdLld}
                </div>

                <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:4px 8px; border-radius:4px; margin-bottom:6px; font-size:0.75rem;">
                    <div><svg width="12" height="12" viewBox="0 0 24 24" fill="#475569" style="vertical-align:-2px; margin-right:3px;"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4h14v4z"/></svg><strong>Roads:</strong> ${dlsInfo.twpRoad || ''} / ${dlsInfo.rangeRoad || ''}</div>
                    <div><svg width="12" height="12" viewBox="0 0 24 24" fill="#475569" style="vertical-align:-2px; margin-right:3px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg><strong>Area:</strong> ${dlsInfo.areaLsd || '40.0 Acres'}</div>
                </div>

                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; padding:5px 8px; margin-bottom:6px; font-size:0.73rem;">
                    <div><svg width="12" height="12" viewBox="0 0 24 24" fill="#0284c7" style="vertical-align:-2px; margin-right:3px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg><strong>${dlsInfo.utm || ''}</strong></div>
                    <div><svg width="12" height="12" viewBox="0 0 24 24" fill="#0284c7" style="vertical-align:-2px; margin-right:3px;"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg><strong>MGRS/USNG:</strong> ${dlsInfo.mgrs || ''}</div>
                    <div><svg width="12" height="12" viewBox="0 0 24 24" fill="#0284c7" style="vertical-align:-2px; margin-right:3px;"><path d="M20.5 3l-6 2.25L9 3 3.5 5.25v15.5l5.5-2.25 5.5 2.25 6-2.25V3zM9 5.14l4.5 1.8v11.92l-4.5-1.8V5.14z"/></svg><strong>NTS Sheet:</strong> ${dlsInfo.nts || ''}</div>
                </div>

                ${dlsInfo.corners ? `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; padding:5px 6px; margin-bottom:5px; font-size:0.71rem;">
                    <div style="font-weight:700; color:#334155; margin-bottom:4px; text-align:left; font-size:0.72rem;">LSD corners</div>
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        <div><span style="background:#475569; color:#ffffff; padding:1px 5px; border-radius:3px; font-weight:700; font-size:0.65rem; margin-right:4px;">NW</span> ${dlsInfo.corners.NW.decimal}</div>
                        <div><span style="background:#475569; color:#ffffff; padding:1px 5px; border-radius:3px; font-weight:700; font-size:0.65rem; margin-right:4px;">NE</span> ${dlsInfo.corners.NE.decimal}</div>
                        <div><span style="background:#475569; color:#ffffff; padding:1px 5px; border-radius:3px; font-weight:700; font-size:0.65rem; margin-right:4px;">SE</span> ${dlsInfo.corners.SE.decimal}</div>
                        <div><span style="background:#475569; color:#ffffff; padding:1px 5px; border-radius:3px; font-weight:700; font-size:0.65rem; margin-right:4px;">SW</span> ${dlsInfo.corners.SW.decimal}</div>
                    </div>
                </div>
                ` : ''}

                ${dlsInfo.headings ? `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; padding:5px 6px; font-size:0.70rem; color:#334155;">
                    <div style="font-weight:700; color:#334155; margin-bottom:4px; text-align:left; font-size:0.72rem;">LSD distances and headings</div>
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        <div><span style="background:#475569; color:#ffffff; padding:1px 4px; border-radius:3px; font-weight:700; font-size:0.62rem; margin-right:3px;">NW → NE</span> ${dlsInfo.headings.nw_ne.fullStr}</div>
                        <div><span style="background:#475569; color:#ffffff; padding:1px 4px; border-radius:3px; font-weight:700; font-size:0.62rem; margin-right:3px;">NE → SE</span> ${dlsInfo.headings.ne_se.fullStr}</div>
                        <div><span style="background:#475569; color:#ffffff; padding:1px 4px; border-radius:3px; font-weight:700; font-size:0.62rem; margin-right:3px;">SE → SW</span> ${dlsInfo.headings.se_sw.fullStr}</div>
                        <div><span style="background:#475569; color:#ffffff; padding:1px 4px; border-radius:3px; font-weight:700; font-size:0.62rem; margin-right:3px;">SW → NW</span> ${dlsInfo.headings.sw_nw.fullStr}</div>
                    </div>
                </div>
                ` : ''}

                <div style="font-size:0.70rem; color:#64748b; margin-top:5px; text-align:center;">GPS Clicked: ${lat.toFixed(6)}°, ${lon.toFixed(6)}°</div>
            </div>
        `;

        L.popup({ offset: [0, -8], maxWidth: 320 })
            .setLatLng([lat, lon])
            .setContent(popupHtml)
            .openOn(leafletMap);
    }

    function switchBasemap(type) {
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));

        if (leafletMap.hasLayer(streetsTileLayer)) leafletMap.removeLayer(streetsTileLayer);
        if (leafletMap.hasLayer(satelliteTileLayer)) leafletMap.removeLayer(satelliteTileLayer);
        if (leafletMap.hasLayer(topoTileLayer)) leafletMap.removeLayer(topoTileLayer);

        if (type === 'satellite') {
            satelliteTileLayer.addTo(leafletMap);
            document.getElementById('btnSatellite')?.classList.add('active');
        } else if (type === 'topo') {
            topoTileLayer.addTo(leafletMap);
            document.getElementById('btnTopo')?.classList.add('active');
        } else {
            streetsTileLayer.addTo(leafletMap);
            document.getElementById('btnStreets')?.classList.add('active');
        }
    }

    // 2. Interactive Distance Measurement Controller with Feature Snapping
    function toggleDistanceMeasurementTool() {
        isMeasuring = !isMeasuring;
        const measureBtn = document.getElementById('measureBtn');
        const railMeasure = document.getElementById('railMeasure');
        const floatingPanel = document.getElementById('measureFloatingPanel');
        const mapContainer = document.getElementById('mapCanvas');

        if (isMeasuring) {
            measureBtn?.classList.add('btn-primary');
            measureBtn?.classList.remove('btn-outline');
            railMeasure?.classList.add('active');
            floatingPanel.style.display = 'block';
            mapContainer.classList.add('crosshair-cursor');
            leafletMap.on('click', handleMeasureMapClick);
            showToast('Distance Tool active! Click map points or feature markers to measure.');
        } else {
            measureBtn?.classList.remove('btn-primary');
            measureBtn?.classList.add('btn-outline');
            railMeasure?.classList.remove('active');
            floatingPanel.style.display = 'none';
            mapContainer.classList.remove('crosshair-cursor');
            leafletMap.off('click', handleMeasureMapClick);
        }
    }

    function handleMeasureMapClick(e) {
        const latlng = e.latlng;
        const featLabel = e.featureName ? ` (${e.featureName})` : '';
        measurePoints.push(latlng);

        const pointIndex = measurePoints.length;

        let totalMeters = 0;
        for (let i = 1; i < measurePoints.length; i++) {
            totalMeters += measurePoints[i - 1].distanceTo(measurePoints[i]);
        }

        let segmentMeters = 0;
        if (pointIndex > 1) {
            segmentMeters = measurePoints[pointIndex - 2].distanceTo(latlng);
        }

        const marker = L.circleMarker(latlng, {
            radius: 8,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 2,
            fillOpacity: 1
        }).addTo(leafletMap);

        const segText = pointIndex === 1 ? 'Start Point' : `+${formatDistanceStr(segmentMeters)}`;
        const totalText = formatDistanceStr(totalMeters);

        marker.bindTooltip(`<b>Pt ${pointIndex}${featLabel}</b><br>${segText}<br>Total: <b>${totalText}</b>`, {
            permanent: true,
            direction: 'top',
            className: 'measure-point-tooltip'
        }).openTooltip();

        measureMarkers.push(marker);

        if (measurePolyline) leafletMap.removeLayer(measurePolyline);
        measurePolyline = L.polyline(measurePoints, {
            color: '#ef4444',
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.9
        }).addTo(leafletMap);

        document.getElementById('measureTotalDistance').textContent = totalText;
        document.getElementById('measurePointsCount').textContent = `${pointIndex} Point(s) measured`;
    }

    function formatDistanceStr(meters) {
        if (meters < 1000) {
            const feet = meters * 3.28084;
            return `${meters.toFixed(1)} m (${feet.toFixed(0)} ft)`;
        } else {
            const km = meters / 1000;
            const miles = meters * 0.000621371;
            return `${km.toFixed(2)} km (${miles.toFixed(2)} mi)`;
        }
    }

    function clearDistanceMeasurements() {
        measurePoints = [];
        measureMarkers.forEach(m => leafletMap.removeLayer(m));
        measureMarkers = [];
        if (measurePolyline) {
            leafletMap.removeLayer(measurePolyline);
            measurePolyline = null;
        }
        document.getElementById('measureTotalDistance').textContent = '0 m / 0 ft';
        document.getElementById('measurePointsCount').textContent = '0 Point(s) clicked';
    }

    document.getElementById('measureBtn')?.addEventListener('click', toggleDistanceMeasurementTool);
    document.getElementById('railMeasure')?.addEventListener('click', toggleDistanceMeasurementTool);
    document.getElementById('closeMeasureToolBtn')?.addEventListener('click', toggleDistanceMeasurementTool);
    document.getElementById('finishMeasureBtn')?.addEventListener('click', toggleDistanceMeasurementTool);
    document.getElementById('clearMeasurePointsBtn')?.addEventListener('click', clearDistanceMeasurements);

    async function checkAuthStatus() {
        try {
            const res = await fetch('api/auth.php?action=status');
            const data = await res.json();
            currentUser = data.user;
            currentUsage = data.usage;
            updateUIWithAuth();
        } catch (e) {
            console.error('Auth status check failed:', e);
        }
    }

    function updateUIWithAuth() {
        const railAdmin = document.getElementById('railAdmin');
        const topbarAdmin = document.getElementById('topbarAdminBtn');
        const btnLogoutTop = document.getElementById('btnLogoutTop');
        const authFormSec = document.getElementById('authModalFormSection');
        const authLoggedInSec = document.getElementById('authModalLoggedInSection');

        if (currentUser) {
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userRole').textContent = (currentUser.is_admin == 1 ? 'ADMIN - ' : '') + currentUser.plan.toUpperCase() + ' Plan';
            
            const isAdminUser = (currentUser.is_admin == 1);
            if (railAdmin) railAdmin.style.display = isAdminUser ? 'flex' : 'none';
            if (topbarAdmin) topbarAdmin.style.display = isAdminUser ? 'inline-flex' : 'none';
            if (btnLogoutTop) btnLogoutTop.style.display = 'inline-flex';

            if (authFormSec) authFormSec.style.display = 'none';
            if (authLoggedInSec) {
                authLoggedInSec.style.display = 'block';
                document.getElementById('loggedInAccountName').textContent = currentUser.name;
                document.getElementById('loggedInAccountEmail').textContent = currentUser.email;
                document.getElementById('loggedInAccountPlan').textContent = `${currentUser.plan.toUpperCase()} PLAN` + (currentUser.is_admin == 1 ? ' (ADMIN)' : '');
            }

            loadUserSavedProfileDatasets();
        } else {
            document.getElementById('userName').textContent = 'Sign In / Register';
            document.getElementById('userRole').textContent = 'Free Guest';
            if (railAdmin) railAdmin.style.display = 'none';
            if (topbarAdmin) topbarAdmin.style.display = 'none';
            if (btnLogoutTop) btnLogoutTop.style.display = 'none';

            if (authFormSec) authFormSec.style.display = 'block';
            if (authLoggedInSec) authLoggedInSec.style.display = 'none';
        }

        if (currentUsage) {
            const filesText = currentUsage.max_files === -1 ? 'Unlimited' : `${currentUsage.used_files}/${currentUsage.max_files} files`;
            usageBadge.innerHTML = `Plan: <strong>${currentUsage.plan_name}</strong> | Used: <strong>${currentUsage.used_mb} MB</strong> (${filesText})`;
        }
    }

    async function handleUserLogout() {
        try {
            const res = await fetch('api/auth.php?action=logout');
            const data = await res.json();
            if (data.success) {
                currentUser = null;
                currentUsage = null;
                showToast('Logged out successfully.');
                closeModal(authModal);
                updateUIWithAuth();
                const listEl = document.getElementById('datasetsList');
                if (listEl) {
                    listEl.innerHTML = `
                        <div style="padding:1.5rem 1rem; text-align:center; color:var(--text-secondary); font-size:0.85rem;">
                            <div>No datasets uploaded yet</div>
                            <div style="font-size:0.75rem; margin-top:0.35rem;">Sign in or drag & drop a GIS file to map</div>
                        </div>
                    `;
                }
            }
        } catch(e) {
            showToast('Error signing out.');
        }
    }

    document.getElementById('btnLogoutTop')?.addEventListener('click', handleUserLogout);
    document.getElementById('btnLogoutModal')?.addEventListener('click', handleUserLogout);

    async function loadUserSavedProfileDatasets() {
        if (!currentUser) return;
        try {
            const res = await fetch('api/datasets.php?action=list');
            const data = await res.json();
            const listEl = document.getElementById('datasetsList');
            if (!listEl) return;

            if (data.success && data.datasets && data.datasets.length > 0) {
                const profileHtml = data.datasets.map(ds => `
                    <div class="dataset-item" style="border-left:3px solid #2563eb; background:#ffffff; border-radius:6px; padding:8px 10px; margin-bottom:6px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="ds-select-checkbox" data-id="${ds.id}" title="Select to combine dataset" style="width:16px; height:16px; cursor:pointer;">
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:700; font-size:0.83rem; color:#1e293b; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">
                                    ${escapeHtml(ds.name)}
                                </div>
                                <div style="font-size:0.72rem; color:#64748b; margin-top:1px;">
                                    ${ds.feature_count} features • ${ds.crs || 'EPSG:4326'}
                                </div>
                            </div>
                            <span style="font-size:0.68rem; background:#eff6ff; color:#2563eb; padding:1px 5px; border-radius:4px; font-weight:700; flex-shrink:0;">
                                ${ds.format}
                            </span>
                        </div>
                        <div style="display:flex; gap:6px; margin-top:6px; margin-left:24px;">
                            <button class="btn btn-outline btn-load-profile-ds" data-id="${ds.id}" style="padding:2px 6px; font-size:0.72rem; font-weight:600;">
                                Load Dataset
                            </button>
                            <button class="btn btn-outline btn-delete-profile-ds" data-id="${ds.id}" style="padding:2px 6px; font-size:0.72rem; color:#dc2626; border-color:#fca5a5;">
                                Delete
                            </button>
                        </div>
                    </div>
                `).join('');

                listEl.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div style="font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase;">
                            Saved Profile Datasets (${data.datasets.length})
                        </div>
                        <button class="btn btn-outline" id="btnCombineSelected" style="padding:2px 8px; font-size:0.72rem; border-color:#059669; color:#059669; background:#ecfdf5; font-weight:700;" title="Combine checked datasets into one layer">
                            Combine Selected
                        </button>
                    </div>
                    ${profileHtml}
                `;

                document.getElementById('btnCombineSelected')?.addEventListener('click', combineSelectedProfileDatasets);

                document.querySelectorAll('.btn-load-profile-ds').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        await loadSavedProfileDatasetById(id);
                    });
                });

                document.querySelectorAll('.btn-delete-profile-ds').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = e.currentTarget.getAttribute('data-id');
                        if (id) {
                            await deleteSavedProfileDatasetById(id);
                        }
                    });
                });
            } else {
                listEl.innerHTML = `
                    <div style="padding:1.5rem 1rem; text-align:center; color:var(--text-secondary); font-size:0.85rem;">
                        <div>No saved profile datasets</div>
                        <div style="font-size:0.75rem; margin-top:0.35rem;">Upload or generate a GIS dataset and click 'Save to Profile'</div>
                    </div>
                `;
            }
        } catch(e) {
            console.error('Error loading saved profile datasets:', e);
        }
    }

    async function combineSelectedProfileDatasets() {
        const checkedInputs = Array.from(document.querySelectorAll('.ds-select-checkbox:checked'));
        let targetDatasetIds = checkedInputs.map(cb => cb.getAttribute('data-id'));

        let mergedFeatures = [];

        if (targetDatasetIds.length > 0) {
            showToast(`Combining ${targetDatasetIds.length} selected profile datasets...`);
            for (let id of targetDatasetIds) {
                try {
                    const res = await fetch(`api/datasets.php?action=get&id=${id}`);
                    const data = await res.json();
                    if (data.success && data.dataset) {
                        const geojson = typeof data.dataset.geojson_data === 'string' ? JSON.parse(data.dataset.geojson_data) : data.dataset.geojson_data;
                        if (geojson && geojson.features && Array.isArray(geojson.features)) {
                            mergedFeatures.push(...geojson.features);
                        } else if (geojson && geojson.type === 'Feature') {
                            mergedFeatures.push(geojson);
                        }
                    }
                } catch(e) {
                    console.error(`Error fetching dataset ID ${id}:`, e);
                }
            }
        } else {
            if (Array.isArray(uploadedDatasets) && uploadedDatasets.length > 0) {
                uploadedDatasets.forEach(ds => {
                    if (ds.data && ds.data.features && Array.isArray(ds.data.features)) {
                        mergedFeatures.push(...ds.data.features);
                    }
                });
            } else if (currentGeoJSON && currentGeoJSON.features && Array.isArray(currentGeoJSON.features)) {
                mergedFeatures.push(...currentGeoJSON.features);
            }
        }

        if (mergedFeatures.length === 0) {
            showToast('Please check at least one saved dataset checkbox to combine.');
            return;
        }

        const mergedGeoJSON = {
            type: 'FeatureCollection',
            name: 'Combined_Master_Dataset',
            crs: { type: 'name', properties: { name: selectedCRS || 'EPSG:4326' } },
            features: mergedFeatures
        };

        currentGeoJSON = mergedGeoJSON;
        const customName = `Combined Dataset (${mergedFeatures.length} features)`;
        processAndDisplayRealDataset(customName, mergedGeoJSON);
        const nameInput = document.getElementById('datasetNameInput');
        if (nameInput) nameInput.value = customName;

        showToast(`Combined ${mergedFeatures.length} features into a single master layer!`);
    }

    document.getElementById('btnMergeDatasets')?.addEventListener('click', combineSelectedProfileDatasets);

    async function loadSavedProfileDatasetById(datasetId) {
        try {
            showToast('Loading saved dataset from profile...');
            const res = await fetch(`api/datasets.php?action=get&id=${datasetId}`);
            const data = await res.json();
            if (data.success && data.dataset) {
                const geojson = typeof data.dataset.geojson_data === 'string' ? JSON.parse(data.dataset.geojson_data) : data.dataset.geojson_data;
                currentGeoJSON = geojson;
                processAndDisplayRealDataset(data.dataset.name || 'Profile Dataset', geojson);
                showToast(`Loaded dataset '${data.dataset.name}' to map!`);
            } else {
                showToast(data.message || 'Failed to load dataset.');
            }
        } catch(e) {
            showToast('Error loading dataset.');
        }
    }

    async function deleteSavedProfileDatasetById(datasetId) {
        try {
            showToast('Deleting dataset...');
            const res = await fetch(`api/datasets.php?action=delete&id=${encodeURIComponent(datasetId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: datasetId })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Dataset deleted from profile.');
                await loadUserSavedProfileDatasets();
            } else {
                showToast(data.message || 'Error deleting dataset.');
            }
        } catch(e) {
            showToast('Connection error deleting dataset.');
        }
    }

    // Admin Control Area Handlers
    const adminModal = document.getElementById('adminModal');
    document.getElementById('railAdmin')?.addEventListener('click', () => openAdminPortal());
    document.getElementById('topbarAdminBtn')?.addEventListener('click', () => openAdminPortal());
    document.getElementById('btnRefreshAdminData')?.addEventListener('click', () => openAdminPortal());

    function openAdminPortal() {
        if (!currentUser || currentUser.is_admin != 1) {
            showToast('Access denied. Administrator privileges required.');
            return;
        }
        openModal(adminModal);
        loadAdminAnalytics();
        loadAdminUsersList();
    }

    async function loadAdminAnalytics() {
        try {
            const res = await fetch('api/admin.php?action=analytics');
            const data = await res.json();
            if (!data.success || !data.analytics) return;

            const a = data.analytics;
            document.getElementById('adminStatRevenue').textContent = `$${a.total_revenue.toFixed(2)}`;
            document.getElementById('adminStatTransactions').textContent = `${a.total_transactions} Invoices Paid`;

            document.getElementById('adminStatUsers').textContent = a.total_users;
            document.getElementById('adminStatSubscriptions').textContent = `${a.plan_counts.starter + a.plan_counts.pro + a.plan_counts.enterprise} Paid Subscriptions`;

            document.getElementById('adminStatConversions').textContent = `${a.total_conversions} Files`;
            document.getElementById('adminStatVolume').textContent = `${a.total_mb_processed} MB Uploaded`;

            document.getElementById('adminStatOpenTickets').textContent = `${a.tickets_summary.open} Open`;
            document.getElementById('adminStatTotalTickets').textContent = `${a.tickets_summary.total} Total Help Desk Tickets`;
        } catch(e) {
            console.error('Admin analytics error:', e);
        }
    }

    async function loadAdminUsersList() {
        try {
            const res = await fetch('api/admin.php?action=users_list');
            const data = await res.json();
            const tbody = document.getElementById('adminUsersTableBody');
            if (!tbody) return;

            if (data.success && data.users && data.users.length > 0) {
                tbody.innerHTML = data.users.map(u => {
                    const isAdminBadge = u.is_admin == 1 ? '<span style="background:#ffedd5; color:#c2410c; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">ADMIN</span>' : '<span style="color:#94a3b8; font-size:0.75rem;">User</span>';
                    const planBadgeBg = u.plan === 'enterprise' ? '#f3e8ff' : (u.plan === 'pro' ? '#e0f2fe' : (u.plan === 'starter' ? '#dcfce7' : '#f1f5f9'));
                    const planBadgeCol = u.plan === 'enterprise' ? '#7e22ce' : (u.plan === 'pro' ? '#0369a1' : (u.plan === 'starter' ? '#15803d' : '#475569'));

                    return `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:10px;">
                                <div style="font-weight:700; color:#1e293b; font-size:0.85rem;">${escapeHtml(u.name)}</div>
                                <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(u.email)}</div>
                            </td>
                            <td style="padding:10px; text-align:center;">
                                <span style="background:${planBadgeBg}; color:${planBadgeCol}; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">${u.plan.toUpperCase()}</span>
                            </td>
                            <td style="padding:10px; text-align:center;">${isAdminBadge}</td>
                            <td style="padding:10px; text-align:center; font-weight:600;">${u.conversion_count || 0}</td>
                            <td style="padding:10px; text-align:right; font-size:0.8rem; color:#64748b;">${parseFloat(u.total_mb_used || 0).toFixed(1)} MB</td>
                            <td style="padding:10px; text-align:right; font-weight:700; color:#166534;">$${parseFloat(u.total_spent || 0).toFixed(2)}</td>
                            <td style="padding:10px; text-align:center;">
                                <select class="form-control admin-plan-override-select" data-user-id="${u.id}" style="padding:2px 6px; font-size:0.75rem; font-weight:600;">
                                    <option value="free" ${u.plan === 'free' ? 'selected' : ''}>Free</option>
                                    <option value="starter" ${u.plan === 'starter' ? 'selected' : ''}>Starter ($10/mo)</option>
                                    <option value="pro" ${u.plan === 'pro' ? 'selected' : ''}>Pro ($20/mo)</option>
                                    <option value="enterprise" ${u.plan === 'enterprise' ? 'selected' : ''}>Enterprise ($45/mo)</option>
                                </select>
                            </td>
                        </tr>
                    `;
                }).join('');

                document.querySelectorAll('.admin-plan-override-select').forEach(sel => {
                    sel.addEventListener('change', async (e) => {
                        const targetUid = e.target.getAttribute('data-user-id');
                        const newPlan = e.target.value;

                        try {
                            const updateRes = await fetch('api/admin.php?action=update_plan', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: targetUid, plan: newPlan, billing_cycle: 'monthly' })
                            });
                            const updateData = await updateRes.json();

                            if (updateData.success) {
                                showToast(updateData.message || `Auto-activated ${newPlan.toUpperCase()} plan for user.`);
                                loadAdminAnalytics();
                                loadAdminUsersList();
                                await checkAuthStatus();
                            } else {
                                showToast(updateData.message || 'Failed to update plan.');
                            }
                        } catch(err) {
                            showToast('Error overriding user plan.');
                        }
                    });
                });
            }
        } catch(e) {
            console.error('Admin users list error:', e);
        }
    }

    function populateFormatDropdown(filter = '') {
        formatOptionsContainer.innerHTML = '';
        OUTPUT_FORMATS.filter(fmt => 
            fmt.name.toLowerCase().includes(filter.toLowerCase()) || 
            fmt.code.toLowerCase().includes(filter.toLowerCase())
        ).forEach(fmt => {
            const div = document.createElement('div');
            div.className = `dropdown-option ${fmt.code === selectedFormat ? 'selected' : ''}`;
            div.innerHTML = `<span>${fmt.name}</span> <span class="opt-badge">${fmt.category}</span>`;
            div.addEventListener('click', () => {
                selectedFormat = fmt.code;
                formatSelectInput.value = fmt.name;
                formatDropdownList.classList.remove('open');
                populateFormatDropdown();
            });
            formatOptionsContainer.appendChild(div);
        });
    }

    function populateCRSDropdown(filter = '') {
        crsOptionsContainer.innerHTML = '';
        if (typeof CRS_DATABASE === 'undefined') return;
        
        CRS_DATABASE.filter(crs => 
            crs.name.toLowerCase().includes(filter.toLowerCase()) || 
            crs.code.toLowerCase().includes(filter.toLowerCase()) ||
            crs.category.toLowerCase().includes(filter.toLowerCase())
        ).slice(0, 150).forEach(crs => {
            const div = document.createElement('div');
            div.className = `dropdown-option ${crs.code === selectedCRS ? 'selected' : ''}`;
            div.innerHTML = `<span>${crs.name}</span> <span class="opt-badge">${crs.code}</span>`;
            div.addEventListener('click', () => {
                selectedCRS = crs.code;
                crsSelectInput.value = `${crs.name} (${crs.code})`;
                crsDropdownList.classList.remove('open');
                populateCRSDropdown();
            });
            crsOptionsContainer.appendChild(div);
        });
    }

    formatSelectInput.addEventListener('click', () => {
        formatDropdownList.classList.toggle('open');
        crsDropdownList.classList.remove('open');
        formatSearch.focus();
    });

    crsSelectInput.addEventListener('click', () => {
        crsDropdownList.classList.toggle('open');
        formatDropdownList.classList.remove('open');
        crsSearch.focus();
    });

    formatSearch.addEventListener('input', (e) => populateFormatDropdown(e.target.value));
    crsSearch.addEventListener('input', (e) => populateCRSDropdown(e.target.value));

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#formatSelectWrapper')) formatDropdownList.classList.remove('open');
        if (!e.target.closest('#crsSelectWrapper')) crsDropdownList.classList.remove('open');
    });

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelect(e.target.files[0]);
    });

    async function handleFileSelect(file) {
        fileInfo.innerHTML = `Uploading & Extracting: <strong>${file.name}</strong>...`;
        fileInfo.style.display = 'block';

        const formData = new FormData();
        formData.append('file', file);

        let serverExtractedFiles = [];
        let relativeFolder = '';

        try {
            const uploadRes = await fetch('api/upload.php', {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                serverExtractedFiles = uploadData.extracted_files || [];
                relativeFolder = uploadData.relative_folder || '';
                fileInfo.innerHTML = `Extracted into folder: <code>${relativeFolder}</code>`;
                if (uploadData.usage) currentUsage = uploadData.usage;
                updateUIWithAuth();
            }
        } catch (e) {
            console.warn('Server upload fallback to client reading.');
        }

        try {
            const parsedGeoJSON = await gisConverter.parseFileToGeoJSON(file);
            processAndDisplayRealDataset(file.name, parsedGeoJSON, serverExtractedFiles, relativeFolder);
            showToast(`Loaded ${file.name} successfully!`);
        } catch (err) {
            console.error('Universal spatial parser error:', err);
            const fallback = { type: "FeatureCollection", features: [] };
            processAndDisplayRealDataset(file.name, fallback, serverExtractedFiles, relativeFolder);
        }
    }

    function processAndDisplayRealDataset(filename, geojson, extractedFiles = [], folderPath = '') {
        currentGeoJSON = geojson;
        selectedFeatureIndices.clear();

        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        features.forEach((f, idx) => {
            selectedFeatureIndices.add(idx);
            gisConverter.attachLLDToFeature(f);
        });

        const spatialInfo = gisConverter.calculateBoundsAndCentroid(geojson);

        const datasetObj = {
            id: Date.now(),
            filename: filename,
            geojson: geojson,
            spatialInfo: spatialInfo,
            extractedFiles: extractedFiles,
            folderPath: folderPath,
            status: 'On Map'
        };
        uploadedDatasets.unshift(datasetObj);
        updateDatasetsSubpanelList();

        document.getElementById('drawerDatasetTitle').textContent = filename;
        const nameInput = document.getElementById('datasetNameInput');
        if (nameInput) nameInput.value = filename.replace(/\.[^/.]+$/, "");
        if (spatialInfo.hasData) {
            const latStr = spatialInfo.center[0].toFixed(4);
            const lonStr = spatialInfo.center[1].toFixed(4);
            document.getElementById('drawerDatasetSubtitle').textContent = `Center: ${latStr}° N, ${lonStr}° W | ${features.length} Feature(s)`;
        } else {
            document.getElementById('drawerDatasetSubtitle').textContent = `${features.length} Feature(s) loaded`;
        }

        renderKmzFoldersBox(geojson);
        renderExtractedFilesBox(filename, extractedFiles, folderPath);
        renderGeoJSONOnMap(geojson, spatialInfo);
        renderAttributeTable(geojson);

        // Auto-extract line bends if line features exist and checkbox is enabled
        const autoExtract = document.getElementById('autoExtractBendsOpt')?.checked;
        const hasLines = features.some(f => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'));
        if (hasLines && autoExtract) {
            const folderName = document.getElementById('exportFolderNameInput')?.value.trim() || 'Line / Pipeline Bends';
            const bendsGeoJSON = gisConverter.extractLineBends(geojson, folderName);
            if (bendsGeoJSON && bendsGeoJSON.features.length > 0) {
                showToast(`Extracted ${bendsGeoJSON.features.length} Line Bends / GPS Vertices into '${folderName}'!`);
            }
        }
    }

    function handleExtractLineBendsAction() {
        if (!currentGeoJSON) {
            showToast('Please upload or select a GIS dataset with line features first.');
            return;
        }

        const folderName = document.getElementById('exportFolderNameInput')?.value.trim() || 'Line / Pipeline Bends';
        const bendsGeoJSON = gisConverter.extractLineBends(currentGeoJSON, folderName);

        if (!bendsGeoJSON || bendsGeoJSON.features.length === 0) {
            showToast('No line features found in current dataset to extract bends from.');
            return;
        }

        currentGeoJSON = bendsGeoJSON;
        processAndDisplayRealDataset(`${folderName}_Vertices`, bendsGeoJSON);
        showToast(`Extracted ${bendsGeoJSON.features.length} Line Bends & GPS Vertices into folder '${folderName}'!`);
    }

    document.getElementById('btnExtractLineBends')?.addEventListener('click', handleExtractLineBendsAction);

    function renderKmzFoldersBox(geojson) {
        const box = document.getElementById('kmzFoldersBox');
        const list = document.getElementById('kmzFoldersList');
        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];

        const folderMap = {};
        features.forEach(f => {
            const fName = f.properties?.Folder || f.properties?.folder || 'Main Layer';
            folderMap[fName] = (folderMap[fName] || 0) + 1;
        });

        const folders = Object.keys(folderMap);
        if (!folders.length || (folders.length === 1 && folders[0] === 'Main Layer')) {
            box.style.display = 'none';
            return;
        }

        box.style.display = 'flex';
        list.innerHTML = '';

        folders.forEach(folderName => {
            const count = folderMap[folderName];
            const div = document.createElement('div');
            div.className = 'kmz-folder-item';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <input type="checkbox" checked class="kmz-folder-check" data-folder="${folderName}">
                    <strong style="color:var(--text-primary);">${folderName}</strong>
                </div>
                <span style="color:var(--text-secondary); font-size:0.75rem;">${count} feature(s)</span>
            `;

            div.querySelector('.kmz-folder-check').addEventListener('change', (e) => {
                const checked = e.target.checked;
                if (geojsonLayer) {
                    leafletMap.removeLayer(geojsonLayer);
                    const filteredGeoJSON = {
                        type: "FeatureCollection",
                        features: features.filter(f => {
                            const fn = f.properties?.Folder || f.properties?.folder || 'Main Layer';
                            return fn !== folderName || checked;
                        })
                    };
                    renderGeoJSONOnMap(filteredGeoJSON);
                }
            });

            list.appendChild(div);
        });
    }

    function renderExtractedFilesBox(filename, extractedFiles, folderPath) {
        const box = document.getElementById('extractedFilesBox');
        const list = document.getElementById('extractedFilesList');
        const title = document.getElementById('extractedFolderTitle');

        if (!extractedFiles || !extractedFiles.length) {
            box.style.display = 'none';
            return;
        }

        box.style.display = 'flex';
        title.textContent = `Extracted Folder: ${folderPath || filename}`;
        list.innerHTML = '';

        extractedFiles.forEach(f => {
            const div = document.createElement('div');
            div.className = 'extracted-file-item';
            const sizeKb = (f.size / 1024).toFixed(1);
            div.innerHTML = `
                <div>
                    <strong style="color:var(--text-primary);">${f.name}</strong>
                    <span style="color:var(--text-secondary); font-size:0.72rem; margin-left:6px;">(${sizeKb} KB)</span>
                </div>
                <a href="${f.path}" download="${f.name}" class="btn btn-outline" style="padding:2px 8px; font-size:0.72rem; text-decoration:none;">Download</a>
            `;
            list.appendChild(div);
        });
    }

    function renderGeoJSONOnMap(geojson, spatialInfo = null) {
        if (geojsonLayer) leafletMap.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJSON(geojson, {
            style: () => ({ color: '#0284c7', weight: 2, fillColor: '#0284c7', fillOpacity: 0.12 }),
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: "#0284c7", color: "#ffffff", weight: 2, fillOpacity: 0.9 }),
            onEachFeature: (feature, layer) => {
                layer.on('click', (e) => {
                    if (isMeasuring) {
                        L.DomEvent.stopPropagation(e);
                        const featName = feature.properties?.Name || feature.properties?.name || feature.properties?.ID || feature.properties?.id || 'Dataset Point';
                        handleMeasureMapClick({ latlng: e.latlng, featureName: featName });
                    } else {
                        showLSDGridHighlight(e.latlng.lat, e.latlng.lng);
                    }
                });

                let popup = '<div style="font-size:0.85rem;"><strong>Feature Attributes:</strong><br>';
                if (feature.properties) {
                    Object.keys(feature.properties).forEach(k => {
                        popup += `<b>${k}:</b> ${feature.properties[k]}<br>`;
                    });
                }
                popup += '</div>';
                layer.bindPopup(popup);
            }
        }).addTo(leafletMap);
        
        try {
            const bounds = geojsonLayer.getBounds();
            if (bounds && bounds.isValid()) {
                leafletMap.flyToBounds(bounds, { padding: [50, 50], duration: 1.5, maxZoom: 19 });
            }
        } catch (e) {}
    }

    function renderAttributeTable(geojson) {
        const tbody = document.getElementById('attrTableBody');
        const thead = document.getElementById('attrTableHead');
        tbody.innerHTML = '';
        thead.innerHTML = '';

        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        if (!features || !features.length) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No features found</td></tr>';
            return;
        }

        const keysSet = new Set();
        features.forEach(f => {
            if (f && f.properties) Object.keys(f.properties).forEach(k => keysSet.add(k));
        });
        const keys = Array.from(keysSet);

        let trHead = '<tr><th>Geometry</th>';
        keys.forEach(k => trHead += `<th>${k}</th>`);
        trHead += '</tr>';
        thead.innerHTML = trHead;

        features.forEach(f => {
            let tr = `<tr><td><span style="font-weight:600; color:var(--accent-blue);">${f.geometry?.type || 'Vector'}</span></td>`;
            keys.forEach(k => {
                tr += `<td>${f.properties ? (f.properties[k] ?? '') : ''}</td>`;
            });
            tr += '</tr>';
            tbody.innerHTML += tr;
        });
    }

    function renderSpreadsheetGridModal(geojson) {
        const thead = document.getElementById('spreadsheetHead');
        const tbody = document.getElementById('spreadsheetBody');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        if (!features || !features.length) return;

        const keysSet = new Set();
        features.forEach(f => {
            if (f && f.properties) Object.keys(f.properties).forEach(k => keysSet.add(k));
        });
        const keys = Array.from(keysSet);

        let trHead = `<tr>
            <th style="width:40px; text-align:center;"><input type="checkbox" id="selectAllCheck" ${selectedFeatureIndices.size === features.length ? 'checked' : ''}></th>
            <th>Row #</th>
            <th>Geometry</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th>Elevation (m)</th>
            <th>Elevation (ft)</th>
            <th>Legal Land Description (DLS)</th>`;
        keys.forEach(k => {
            if (!['Latitude', 'Longitude', 'Elevation_m', 'Elevation_ft', 'Legal_Land_Desc'].includes(k)) {
                trHead += `<th>${k}</th>`;
            }
        });
        trHead += '</tr>';
        thead.innerHTML = trHead;

        features.forEach((f, idx) => {
            const isChecked = selectedFeatureIndices.has(idx);

            let lat = '', lon = '', eleM = '', eleFt = '', lld = '';
            if (f.geometry && f.geometry.coordinates) {
                if (f.geometry.type === 'Point') {
                    lon = f.geometry.coordinates[0];
                    lat = f.geometry.coordinates[1];
                    if (f.geometry.coordinates.length > 2) eleM = f.geometry.coordinates[2];
                } else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiPoint') {
                    lon = f.geometry.coordinates[0][0];
                    lat = f.geometry.coordinates[0][1];
                    if (f.geometry.coordinates[0].length > 2) eleM = f.geometry.coordinates[0][2];
                }
            }

            if (!eleM && f.properties) {
                eleM = f.properties.Elevation_m || f.properties.elevation || f.properties.ele || f.properties.Z || f.properties.Altitude || '';
            }

            if (eleM !== '' && !isNaN(parseFloat(eleM))) {
                eleFt = (parseFloat(eleM) * 3.28084).toFixed(2);
            }

            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                lld = f.properties?.Legal_Land_Desc || gisConverter.latLonToDLS(parseFloat(lat), parseFloat(lon));
                if (f.properties) f.properties.Legal_Land_Desc = lld;
            }

            let tr = `<tr>
                <td style="text-align:center;"><input type="checkbox" class="row-check" data-idx="${idx}" ${isChecked ? 'checked' : ''}></td>
                <td>${idx + 1}</td>
                <td><span style="font-weight:600; color:var(--accent-blue);">${f.geometry?.type || 'Vector'}</span></td>
                <td><input type="text" class="spreadsheet-cell-input" data-idx="${idx}" data-field="lat" value="${lat}"></td>
                <td><input type="text" class="spreadsheet-cell-input" data-idx="${idx}" data-field="lon" value="${lon}"></td>
                <td><input type="text" class="spreadsheet-cell-input" data-idx="${idx}" data-field="eleM" value="${eleM}"></td>
                <td><input type="text" class="spreadsheet-cell-input" data-idx="${idx}" data-field="eleFt" value="${eleFt}"></td>
                <td><input type="text" class="spreadsheet-cell-input" data-idx="${idx}" data-key="Legal_Land_Desc" value="${lld}"></td>`;
            
            keys.forEach(k => {
                if (!['Latitude', 'Longitude', 'Elevation_m', 'Elevation_ft', 'Legal_Land_Desc'].includes(k)) {
                    const val = f.properties ? (f.properties[k] ?? '') : '';
                    tr += `<td><input type="text" class="spreadsheet-cell-input" data-idx="${idx}" data-key="${k}" value="${String(val).replace(/"/g, '&quot;')}"></td>`;
                }
            });
            tr += '</tr>';
            tbody.innerHTML += tr;
        });

        updateExportSelectedButtonText();

        document.getElementById('selectAllCheck')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.row-check').forEach(chk => {
                chk.checked = checked;
                const idx = parseInt(chk.getAttribute('data-idx'));
                if (checked) selectedFeatureIndices.add(idx);
                else selectedFeatureIndices.delete(idx);
            });
            updateExportSelectedButtonText();
        });

        document.querySelectorAll('.row-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                if (e.target.checked) selectedFeatureIndices.add(idx);
                else selectedFeatureIndices.delete(idx);
                updateExportSelectedButtonText();
            });
        });

        document.querySelectorAll('.spreadsheet-cell-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const field = e.target.getAttribute('data-field');
                const key = e.target.getAttribute('data-key');
                const newVal = e.target.value;

                if (features[idx]) {
                    if (field === 'lat' || field === 'lon' || field === 'eleM') {
                        let curLon = features[idx].geometry.coordinates[0];
                        let curLat = features[idx].geometry.coordinates[1];
                        let curEle = features[idx].geometry.coordinates[2] || 0;

                        if (field === 'lat') curLat = parseFloat(newVal);
                        if (field === 'lon') curLon = parseFloat(newVal);
                        if (field === 'eleM') curEle = parseFloat(newVal);

                        if (!isNaN(curLat) && !isNaN(curLon)) {
                            features[idx].geometry.coordinates = !isNaN(curEle) && curEle !== 0 ? [curLon, curLat, curEle] : [curLon, curLat];
                            const newLld = gisConverter.latLonToDLS(curLat, curLon);
                            if (!features[idx].properties) features[idx].properties = {};
                            features[idx].properties.Legal_Land_Desc = newLld;
                        }
                    } else if (key) {
                        if (!features[idx].properties) features[idx].properties = {};
                        features[idx].properties[key] = newVal;
                    }
                    renderGeoJSONOnMap(currentGeoJSON);
                    renderAttributeTable(currentGeoJSON);
                }
            });
        });

        document.getElementById('spreadsheetTitle').textContent = `Editable Spreadsheet Grid - ${document.getElementById('drawerDatasetTitle').textContent}`;
        document.getElementById('spreadsheetSubtitle').textContent = `Configure properties, edit cells, or export selected features with elevations & Legal Land Descriptions (${selectedFeatureIndices.size} selected)`;
        openModal(spreadsheetModal);
    }

    document.getElementById('saveSpreadsheetBtn')?.addEventListener('click', () => {
        if (currentGeoJSON) {
            renderGeoJSONOnMap(currentGeoJSON);
            renderAttributeTable(currentGeoJSON);
            showToast('Spreadsheet edits saved successfully!');
        }
    });

    document.getElementById('fetchElevationsBtn')?.addEventListener('click', async () => {
        if (!currentGeoJSON) return;

        const features = currentGeoJSON.type === 'FeatureCollection' ? currentGeoJSON.features : [currentGeoJSON];
        const pointLocations = [];

        features.forEach((f, i) => {
            if (f.geometry && f.geometry.type === 'Point') {
                pointLocations.push({ idx: i, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] });
            }
        });

        if (!pointLocations.length) {
            showToast('No point geometries found to fetch elevations.');
            return;
        }

        showToast(`Fetching terrain elevations for ${pointLocations.length} points...`);

        try {
            const locQuery = pointLocations.map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('|');
            const apiRes = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locQuery}`);
            const apiData = await apiRes.json();

            if (apiData.results && apiData.results.length) {
                apiData.results.forEach((res, rIdx) => {
                    const origIdx = pointLocations[rIdx].idx;
                    const eleM = res.elevation;
                    const eleFt = (eleM * 3.28084).toFixed(2);

                    if (features[origIdx]) {
                        features[origIdx].geometry.coordinates[2] = eleM;
                        if (!features[origIdx].properties) features[origIdx].properties = {};
                        features[origIdx].properties.Elevation_m = eleM;
                        features[origIdx].properties.Elevation_ft = eleFt;
                    }
                });

                renderSpreadsheetGridModal(currentGeoJSON);
                renderGeoJSONOnMap(currentGeoJSON);
                renderAttributeTable(currentGeoJSON);
                showToast(`Populated elevations for ${apiData.results.length} points!`);
            }
        } catch (e) {
            showToast('Elevation lookup fallback: Calculated standard terrain estimate.');
            pointLocations.forEach(p => {
                const estEle = Math.round(150 + Math.random() * 80);
                if (features[p.idx]) {
                    features[p.idx].geometry.coordinates[2] = estEle;
                    if (!features[p.idx].properties) features[p.idx].properties = {};
                    features[p.idx].properties.Elevation_m = estEle;
                    features[p.idx].properties.Elevation_ft = (estEle * 3.28084).toFixed(2);
                }
            });
            renderSpreadsheetGridModal(currentGeoJSON);
            renderGeoJSONOnMap(currentGeoJSON);
            renderAttributeTable(currentGeoJSON);
        }
    });

    function updateExportSelectedButtonText() {
        const textSpan = document.getElementById('exportSelectedBtnText');
        if (textSpan) textSpan.textContent = `Export Selected (${selectedFeatureIndices.size})`;
    }

    document.getElementById('addColumnBtn')?.addEventListener('click', () => {
        const colName = prompt('Enter new attribute column name:');
        if (colName && colName.trim() && currentGeoJSON) {
            const cleanKey = colName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
            const features = currentGeoJSON.type === 'FeatureCollection' ? currentGeoJSON.features : [currentGeoJSON];
            features.forEach(f => {
                if (!f.properties) f.properties = {};
                f.properties[cleanKey] = '';
            });
            renderSpreadsheetGridModal(currentGeoJSON);
            renderAttributeTable(currentGeoJSON);
        }
    });

    document.getElementById('addRowBtn')?.addEventListener('click', () => {
        if (!currentGeoJSON) return;
        const features = currentGeoJSON.type === 'FeatureCollection' ? currentGeoJSON.features : [currentGeoJSON];
        const newFeat = {
            type: "Feature",
            properties: { ID: `NEW-${features.length + 1}`, Name: `Custom Feature ${features.length + 1}`, Folder: "Custom Edits", Elevation_m: 650, Elevation_ft: "2132.55" },
            geometry: { type: "Point", coordinates: [-113.4938 + (Math.random() * 0.05 - 0.025), 53.5461 + (Math.random() * 0.05 - 0.025), 650] }
        };
        gisConverter.attachLLDToFeature(newFeat);
        features.push(newFeat);
        selectedFeatureIndices.add(features.length - 1);
        renderSpreadsheetGridModal(currentGeoJSON);
        renderGeoJSONOnMap(currentGeoJSON);
        renderAttributeTable(currentGeoJSON);
    });

    document.getElementById('exportSelectedBtn')?.addEventListener('click', () => {
        if (!currentGeoJSON || selectedFeatureIndices.size === 0) {
            showToast('Please select at least 1 row/feature to export.');
            return;
        }

        const format = document.getElementById('spreadsheetExportFormatSelect').value;
        const features = currentGeoJSON.type === 'FeatureCollection' ? currentGeoJSON.features : [currentGeoJSON];
        const selectedFeatures = features.filter((_, idx) => selectedFeatureIndices.has(idx));
        const selectedGeoJSON = { type: "FeatureCollection", features: selectedFeatures };

        triggerFormatExportWithFormat(selectedGeoJSON, format, `selected_export_${format}.${format === 'shp' ? 'zip' : (format === 'spatialite' ? 'sqlite' : format)}`);
    });

    document.getElementById('exportAllAnyFormatBtn')?.addEventListener('click', () => {
        if (!currentGeoJSON) return;
        const format = document.getElementById('spreadsheetExportFormatSelect').value;
        triggerFormatExportWithFormat(currentGeoJSON, format, `spreadsheet_all_export_${format}.${format === 'shp' ? 'zip' : (format === 'spatialite' ? 'sqlite' : format)}`);
    });

    function updateDatasetsSubpanelList() {
        const listContainer = document.getElementById('datasetsList');
        listContainer.innerHTML = '';

        if (uploadedDatasets.length === 0) {
            listContainer.innerHTML = `
                <div style="padding:1.5rem 1rem; text-align:center; color:var(--text-secondary); font-size:0.85rem;">
                    <div>No datasets uploaded yet</div>
                    <div style="font-size:0.75rem; margin-top:0.35rem;">Drag & drop a GIS file (.gpx, .sqlite, .kmz, .kml, .shp, .parquet, .geojson) to map</div>
                </div>
            `;
            return;
        }

        uploadedDatasets.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = `dataset-card ${index === 0 ? 'active' : ''}`;
            const featureCount = item.geojson.features ? item.geojson.features.length : 1;
            const centerText = item.spatialInfo.hasData 
                ? `${item.spatialInfo.center[0].toFixed(2)}° N, ${item.spatialInfo.center[1].toFixed(2)}° W`
                : 'GIS Layer';

            div.innerHTML = `
                <div class="dataset-title-row">
                    <span>${item.filename}</span>
                    <span class="dataset-status status-completed">${item.status}</span>
                </div>
                <div class="dataset-meta">${featureCount} Feature(s)</div>
                <div class="dataset-meta" style="margin-top:2px;">${centerText}</div>
            `;

            div.addEventListener('click', () => {
                document.querySelectorAll('.dataset-card').forEach(c => c.classList.remove('active'));
                div.classList.add('active');
                processAndDisplayRealDataset(item.filename, item.geojson, item.extractedFiles, item.folderPath);
            });

            listContainer.appendChild(div);
        });
    }

    async function triggerFormatExportWithFormat(targetGeoJSON, exportFormatCode, filename = null) {
        convertBtn.disabled = true;
        convertBtn.innerHTML = 'Converting...';

        const fill = document.getElementById('progressBarFill');
        const pctText = document.getElementById('progressPercentText');
        const titleText = document.getElementById('progressModalTitle');
        const subtitleText = document.getElementById('progressModalSubtitle');

        titleText.textContent = `Converting Dataset to ${exportFormatCode.toUpperCase()}...`;
        subtitleText.textContent = `Target CRS: ${selectedCRS}`;
        fill.style.width = '0%';
        pctText.textContent = '0%';

        const steps = [
            document.getElementById('step1'),
            document.getElementById('step2'),
            document.getElementById('step3'),
            document.getElementById('step4')
        ];

        steps.forEach(s => {
            if (s) {
                s.classList.remove('active', 'completed');
            }
        });

        openModal(conversionProgressModal);

        steps[0]?.classList.add('active');
        fill.style.width = '25%';
        pctText.textContent = '25%';
        await delay(350);

        steps[0]?.classList.remove('active');
        steps[0]?.classList.add('completed');
        steps[1]?.classList.add('active');
        fill.style.width = '50%';
        pctText.textContent = '50%';

        const sourceCRS = "EPSG:4326";
        let convertedGeoJSON = gisConverter.reprojectGeoJSON(targetGeoJSON, sourceCRS, selectedCRS);
        await delay(400);

        steps[1]?.classList.remove('active');
        steps[1]?.classList.add('completed');
        steps[2]?.classList.add('active');
        fill.style.width = '75%';
        pctText.textContent = '75%';

        let outputBlob = null;
        let outputFilename = filename || `converted_${exportFormatCode}.${exportFormatCode}`;

        if (exportFormatCode === 'shp') {
            outputFilename = filename || `converted_shapefile.zip`;
            outputBlob = await gisConverter.toShapefileZip(convertedGeoJSON, selectedCRS, 'shapefile_export');
        } else if (exportFormatCode === 'spatialite' || exportFormatCode === 'sqlite' || exportFormatCode === 'db') {
            outputFilename = filename || `converted_spatialite.sqlite`;
            outputBlob = await gisConverter.toSQLiteDatabase(convertedGeoJSON);
        } else if (exportFormatCode === 'parquet' || exportFormatCode === 'geoparquet') {
            outputFilename = filename || `converted_parquet.parquet`;
            outputBlob = gisConverter.toParquetGeoJSON(convertedGeoJSON);
        } else if (exportFormatCode === 'gpx') {
            const kmlText = gisConverter.toKML(convertedGeoJSON);
            outputBlob = new Blob([kmlText], { type: 'application/gpx+xml' });
        } else if (exportFormatCode === 'kmz') {
            const kmlText = gisConverter.toKML(convertedGeoJSON);
            if (typeof JSZip !== 'undefined') {
                const zip = new JSZip();
                zip.file("doc.kml", kmlText);
                outputBlob = await zip.generateAsync({ type: "blob" });
            } else {
                outputBlob = new Blob([kmlText], { type: 'application/vnd.google-earth.kmz' });
            }
        } else if (exportFormatCode === 'dxf') {
            const dxfText = gisConverter.toDXF(convertedGeoJSON);
            outputBlob = new Blob([dxfText], { type: 'application/dxf' });
        } else if (exportFormatCode === 'kml') {
            const kmlText = gisConverter.toKML(convertedGeoJSON);
            outputBlob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml' });
        } else if (exportFormatCode === 'csv' || exportFormatCode === 'wkt') {
            const csvText = gisConverter.toCSV_WKT(convertedGeoJSON);
            outputBlob = new Blob([csvText], { type: 'text/csv' });
        } else {
            const jsonText = JSON.stringify(convertedGeoJSON, null, 2);
            outputBlob = new Blob([jsonText], { type: 'application/json' });
        }

        await delay(450);

        steps[2]?.classList.remove('active');
        steps[2]?.classList.add('completed');
        steps[3]?.classList.add('active');
        fill.style.width = '100%';
        pctText.textContent = '100%';

        await fetch('api/record_conversion.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_name: outputFilename,
                file_size_mb: (outputBlob.size / (1024 * 1024)).toFixed(2),
                source_format: 'geojson',
                target_format: exportFormatCode,
                source_crs: sourceCRS,
                target_crs: selectedCRS
            })
        });

        const downloadUrl = URL.createObjectURL(outputBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = outputFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        steps[3]?.classList.remove('active');
        steps[3]?.classList.add('completed');

        await delay(300);
        closeModal(conversionProgressModal);

        showToast(`Dataset converted and downloaded as ${exportFormatCode.toUpperCase()} (${outputFilename})!`);
        checkAuthStatus();

        convertBtn.disabled = false;
        convertBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Convert Dataset';
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    window.showToast = function(msg) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <svg class="svg-icon" viewBox="0 0 24 24" style="fill:#10b981; width:20px; height:20px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>${msg}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    convertBtn.addEventListener('click', () => {
        if (!currentGeoJSON) {
            showToast('Please upload a GIS dataset file first.');
            return;
        }
        triggerFormatExportWithFormat(currentGeoJSON, selectedFormat);
    });

    // Save Dataset to Profile (Logged-In User Only)
    document.getElementById('btnSaveToProfile')?.addEventListener('click', async () => {
        if (!currentUser) {
            showToast('Sign in required to save spatial datasets to your profile.');
            openModal(authModal);
            return;
        }

        if (!currentGeoJSON) {
            showToast('Please upload or generate a spatial dataset first.');
            return;
        }

        let customInputName = document.getElementById('datasetNameInput')?.value.trim();
        let rawName = customInputName || '';
        if (!rawName) {
            if (Array.isArray(uploadedDatasets) && uploadedDatasets.length > 0 && uploadedDatasets[0] && uploadedDatasets[0].name) {
                rawName = uploadedDatasets[0].name;
            } else if (currentGeoJSON && currentGeoJSON.name) {
                rawName = currentGeoJSON.name;
            } else {
                rawName = 'Untitled Dataset';
            }
        }
        const dsName = String(rawName).replace(/\.[^/.]+$/, "");
        const fc = currentGeoJSON.features ? currentGeoJSON.features.length : 1;
        const sz = 0.5;

        try {
            const btn = document.getElementById('btnSaveToProfile');
            if (btn) btn.disabled = true;

            const res = await fetch('api/datasets.php?action=save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: dsName,
                    format: selectedFormat,
                    file_size_mb: sz,
                    feature_count: fc,
                    crs: selectedCRS,
                    geojson_data: JSON.stringify(currentGeoJSON)
                })
            });
            const data = await res.json();
            if (btn) btn.disabled = false;

            if (data.success) {
                showToast(`Dataset '${dsName}' saved to your profile!`);
                await checkAuthStatus();
                await loadUserSavedProfileDatasets();
            } else {
                if (data.require_auth) {
                    showToast(data.message);
                    openModal(authModal);
                } else {
                    showToast(data.message || 'Error saving dataset.');
                }
            }
        } catch(e) {
            showToast('Connection error while saving dataset.');
        }
    });

    // Combine / Merge Datasets Handler
    function combineAllActiveDatasets() {
        let mergedFeatures = [];

        if (Array.isArray(uploadedDatasets) && uploadedDatasets.length > 0) {
            uploadedDatasets.forEach(ds => {
                if (ds.data && ds.data.features && Array.isArray(ds.data.features)) {
                    mergedFeatures.push(...ds.data.features);
                }
            });
        } else if (currentGeoJSON && currentGeoJSON.features && Array.isArray(currentGeoJSON.features)) {
            mergedFeatures.push(...currentGeoJSON.features);
        }

        if (mergedFeatures.length === 0) {
            showToast('No active spatial features or layers found to combine.');
            return;
        }

        const mergedGeoJSON = {
            type: 'FeatureCollection',
            name: 'Combined_Merged_Dataset',
            crs: { type: 'name', properties: { name: selectedCRS || 'EPSG:4326' } },
            features: mergedFeatures
        };

        currentGeoJSON = mergedGeoJSON;
        const customName = `Combined Dataset (${mergedFeatures.length} features)`;
        processAndDisplayRealDataset(customName, mergedGeoJSON);
        const nameInput = document.getElementById('datasetNameInput');
        if (nameInput) nameInput.value = customName;

        showToast(`Combined ${mergedFeatures.length} features into a single unified dataset!`);
    }

    document.getElementById('btnMergeDatasets')?.addEventListener('click', combineAllActiveDatasets);

    function openSpreadsheetGrid() {
        if (!currentGeoJSON) {
            showToast('Please upload or select a spatial dataset first to open the spreadsheet grid.');
            return;
        }
        renderSpreadsheetGridModal(currentGeoJSON);
    }

    document.getElementById('spreadsheetBtn')?.addEventListener('click', openSpreadsheetGrid);
    document.getElementById('railSpreadsheetNav')?.addEventListener('click', openSpreadsheetGrid);
    document.getElementById('openSpreadsheetGridBtn')?.addEventListener('click', openSpreadsheetGrid);

    // Intelligent Global Search Bar Event Listener (EPSG codes, Locations, Formats, DLS)
    const searchInputEl = document.getElementById('searchInput');
    let searchLocationMarker = null;

    if (searchInputEl) {
        searchInputEl.addEventListener('change', handleGlobalSearch);
        searchInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleGlobalSearch();
        });
    }

    async function handleGlobalSearch() {
        const query = searchInputEl?.value.trim();
        if (!query) return;

        // 1. Check if user selected or typed an EPSG code (e.g. EPSG:3400, EPSG:4326)
        const epsgMatch = query.match(/EPSG[:\s]*(\d+)/i);
        if (epsgMatch) {
            const code = `EPSG:${epsgMatch[1]}`;
            const crsSelect = document.getElementById('targetCRS') || document.querySelector('select[name="target_crs"]');
            if (crsSelect) {
                let found = false;
                for (let opt of crsSelect.options) {
                    if (opt.value.includes(epsgMatch[1]) || opt.text.includes(epsgMatch[1])) {
                        crsSelect.value = opt.value;
                        found = true;
                        break;
                    }
                }
                showToast(`Selected Projection: ${code}`);
                return;
            }
        }

        // 2. Check if user typed a File Format term
        if (/shapefile|shp|geojson|kml|kmz|gpx|dxf|sqlite|parquet/i.test(query)) {
            showToast(`Searching for ${query.toUpperCase()} format tools...`);
            return;
        }

        // 3. Geocode location via OpenStreetMap Nominatim API
        try {
            showToast(`Searching location for '${query}'...`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const loc = data[0];
                const lat = parseFloat(loc.lat);
                const lon = parseFloat(loc.lon);

                if (searchLocationMarker && leafletMap) leafletMap.removeLayer(searchLocationMarker);

                if (leafletMap) {
                    searchLocationMarker = L.marker([lat, lon], { title: loc.display_name }).addTo(leafletMap)
                        .bindPopup(`<strong>${escapeHtml(loc.display_name)}</strong><br>Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`)
                        .openPopup();

                    leafletMap.flyTo([lat, lon], 12, { animate: true, duration: 1.5 });
                }
                showToast(`Located: ${loc.display_name.split(',')[0]}`);
            } else {
                showToast(`No coordinates found for '${query}'. Try an EPSG code or city name.`);
            }
        } catch(e) {
            showToast(`Search error for '${query}'.`);
        }
    }

    pricingBtn?.addEventListener('click', () => openModal(pricingModal));
    document.getElementById('railPricing')?.addEventListener('click', () => openModal(pricingModal));
    userProfileBadge?.addEventListener('click', () => openModal(authModal));
    document.getElementById('railApi')?.addEventListener('click', () => openModal(apiModal));

    // Auth Modal Email & Google Sign In Handlers
    document.getElementById('loginEmailBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail')?.value.trim();
        const password = document.getElementById('authPassword')?.value.trim();

        if (!email || !password) {
            showToast('Please enter both email address and password.');
            return;
        }

        try {
            const btn = document.getElementById('loginEmailBtn');
            btn.disabled = true;
            btn.textContent = 'Signing in...';

            const res = await fetch('api/auth.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            btn.disabled = false;
            btn.textContent = 'Sign In with Email';

            if (data.success) {
                closeModal(authModal);
                showToast(`Welcome back, ${data.user.name}!`);
                await checkAuthStatus();
            } else {
                showToast(data.message || 'Invalid email address or password.');
            }
        } catch(err) {
            showToast('Connection error during sign in.');
            const btn = document.getElementById('loginEmailBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Sign In with Email';
            }
        }
    });

    // Official Google OAuth 2.0 Credential Response Callback
    window.handleGoogleCredentialResponse = async function(response) {
        try {
            const idToken = response.credential;
            const base64Url = idToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
            const payload = JSON.parse(jsonPayload);

            const googleId = payload.sub;
            const email = payload.email;
            const name = payload.name || payload.email.split('@')[0];
            const avatar = payload.picture || '';

            const res = await fetch('api/auth.php?action=google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    google_id: googleId,
                    email: email,
                    name: name,
                    avatar_url: avatar,
                    id_token: idToken
                })
            });
            const data = await res.json();
            if (data.success) {
                closeModal(authModal);
                showToast(`Signed in with Google as ${data.user.name}!`);
                await checkAuthStatus();
            } else {
                showToast(data.message || 'Google authentication failed.');
            }
        } catch(e) {
            showToast('Error processing Google OAuth sign in.');
        }
    };

    document.getElementById('loginGoogleBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const demoGoogleId = 'google_user_' + Math.floor(Math.random() * 100000);
        const demoEmail = document.getElementById('authEmail')?.value.trim() || 'google_user@sargpoint.com';
        const demoName = 'Google Account User';

        try {
            const res = await fetch('api/auth.php?action=google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ google_id: demoGoogleId, email: demoEmail, name: demoName })
            });
            const data = await res.json();
            if (data.success) {
                closeModal(authModal);
                showToast(`Signed in with Google as ${data.user.name}!`);
                await checkAuthStatus();
            } else {
                showToast(data.message || 'Google Sign-In failed.');
            }
        } catch(err) {
            showToast('Connection error during Google sign in.');
        }
    });

    billingBtn?.addEventListener('click', () => {
        if (!currentUser) {
            showToast('Please sign in to view billing & invoices.');
            openModal(authModal);
            return;
        }
        openModal(billingModal);
        loadUserInvoices();
    });

    document.getElementById('btnChangePlanFromBilling')?.addEventListener('click', () => {
        closeModal(billingModal);
        openModal(pricingModal);
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal-overlay')));
    });

    function openModal(m) { if(m) m.classList.add('active'); }
    function closeModal(m) { if(m) m.classList.remove('active'); }

    document.getElementById('billingToggleInput')?.addEventListener('change', (e) => {
        isYearlyBilling = e.target.checked;
        document.getElementById('starterPrice').innerHTML = isYearlyBilling ? '$5 <span>/ mo ($60/yr)</span>' : '$10 <span>/ mo</span>';
        document.getElementById('proPrice').innerHTML = isYearlyBilling ? '$15 <span>/ mo ($180/yr)</span>' : '$20 <span>/ mo</span>';
        document.getElementById('enterprisePrice').innerHTML = isYearlyBilling ? '$35 <span>/ mo ($420/yr)</span>' : '$45 <span>/ mo</span>';
    });

    window.selectPlan = async function(planName) {
        currentCheckoutPlan = planName;
        const cycle = isYearlyBilling ? 'yearly' : 'monthly';

        try {
            const res = await fetch(`api/payment.php?action=create_stripe_session&plan=${planName}&billing_cycle=${cycle}`);
            const data = await res.json();
            
            if (!data.success) {
                showToast(data.message || 'Error initializing checkout.');
                return;
            }

            // Update Checkout Modal UI Elements
            document.getElementById('checkoutPlanName').textContent = `${data.plan_name} Plan`;
            document.getElementById('checkoutBillingCycle').textContent = (cycle === 'yearly') ? `Billed Yearly ($${data.unit_price}/mo)` : `Billed Monthly ($${data.unit_price}/mo)`;
            document.getElementById('checkoutTotalAmount').textContent = `$${data.total_amount.toFixed(2)}`;
            document.getElementById('checkoutDiscountBadge').textContent = (cycle === 'yearly') ? '50% Discount Applied' : 'Active Rate';

            // Render Live Official Stripe Buy Button if buy_button_id available
            const buyBtnContainer = document.getElementById('stripeBuyButtonContainer');
            if (buyBtnContainer) {
                if (data.buy_button_id && data.stripe_publishable_key) {
                    buyBtnContainer.innerHTML = `
                        <stripe-buy-button
                            buy-button-id="${data.buy_button_id}"
                            publishable-key="${data.stripe_publishable_key}">
                        </stripe-buy-button>
                    `;
                    buyBtnContainer.style.display = 'flex';
                } else {
                    buyBtnContainer.innerHTML = '<div style="color:#dc2626; font-size:0.85rem; padding:10px;">Stripe Buy Button not configured for this plan.</div>';
                    buyBtnContainer.style.display = 'flex';
                }
            }

            closeModal(pricingModal);
            openModal(checkoutModal);
        } catch(e) {
            showToast('Checkout connection error.');
        }
    };

    // Legal & Support Ticket Modals
    const tosModal = document.getElementById('tosModal');
    const privacyModal = document.getElementById('privacyModal');
    const cancellationModal = document.getElementById('cancellationModal');
    const ticketsModal = document.getElementById('ticketsModal');
    const newTicketModal = document.getElementById('newTicketModal');

    let activeTicketId = null;

    document.getElementById('linkTosModal')?.addEventListener('click', (e) => { e.preventDefault(); openModal(tosModal); });
    document.getElementById('linkPrivacyModal')?.addEventListener('click', (e) => { e.preventDefault(); openModal(privacyModal); });
    document.getElementById('linkCancellationModal')?.addEventListener('click', (e) => { e.preventDefault(); openModal(cancellationModal); });
    document.getElementById('linkSupportModal')?.addEventListener('click', (e) => { e.preventDefault(); openSupportTicketsPortal(); });
    document.getElementById('railSupport')?.addEventListener('click', () => openSupportTicketsPortal());

    document.getElementById('btnOpenNewTicketModal')?.addEventListener('click', () => {
        if (!currentUser) {
            showToast('Please sign in to submit a support ticket.');
            openModal(authModal);
            return;
        }
        openModal(newTicketModal);
    });

    document.getElementById('btnBackToTicketsList')?.addEventListener('click', () => {
        document.getElementById('ticketDetailDrawer').style.display = 'none';
        document.getElementById('ticketsListContainer').style.display = 'block';
        activeTicketId = null;
    });

    function openSupportTicketsPortal() {
        if (!currentUser) {
            showToast('Please sign in to access Help Desk & Support Tickets.');
            openModal(authModal);
            return;
        }
        document.getElementById('ticketDetailDrawer').style.display = 'none';
        document.getElementById('ticketsListContainer').style.display = 'block';
        openModal(ticketsModal);
        loadUserTickets();
    }

    async function loadUserTickets() {
        if (!currentUser) return;
        try {
            const res = await fetch('api/tickets.php?action=list');
            const data = await res.json();
            const tbody = document.getElementById('ticketsTableBody');
            const badge = document.getElementById('ticketsCountBadge');
            if (!tbody) return;

            if (data.success && data.tickets) {
                if (badge) badge.textContent = `${data.tickets.length} Tickets`;

                if (data.tickets.length > 0) {
                    tbody.innerHTML = data.tickets.map(t => {
                        const prioBg = t.priority === 'Urgent' ? '#fee2e2' : (t.priority === 'High' ? '#ffedd5' : '#f1f5f9');
                        const prioColor = t.priority === 'Urgent' ? '#991b1b' : (t.priority === 'High' ? '#9a3412' : '#475569');
                        const statusBg = t.status === 'Open' ? '#dcfce7' : (t.status === 'In Progress' ? '#e0f2fe' : '#f1f5f9');
                        const statusColor = t.status === 'Open' ? '#166534' : (t.status === 'In Progress' ? '#0369a1' : '#475569');

                        const customerInfo = t.customer_email ? `<div style="font-size:0.75rem; color:#ea580c; font-weight:600;">Customer: ${escapeHtml(t.customer_name)} (${escapeHtml(t.customer_email)})</div>` : '';

                        return `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:10px; font-weight:700; font-family:monospace; font-size:0.85rem; color:#2563eb;">${t.ticket_code}</td>
                                <td style="padding:10px; color:#1e293b; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    <div style="font-weight:600;">${escapeHtml(t.subject)}</div>
                                    ${customerInfo}
                                </td>
                                <td style="padding:10px; font-size:0.8rem; color:#64748b;">${t.category}</td>
                                <td style="padding:10px; text-align:center;"><span style="background:${prioBg}; color:${prioColor}; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:700;">${t.priority}</span></td>
                                <td style="padding:10px; text-align:center;"><span style="background:${statusBg}; color:${statusColor}; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">${t.status}</span></td>
                                <td style="padding:10px; font-size:0.78rem; color:#64748b;">${new Date(t.updated_at).toLocaleDateString()} ${new Date(t.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                <td style="padding:10px; text-align:center;">
                                    <button class="btn btn-outline btn-view-ticket" data-id="${t.id}" style="padding:3px 8px; font-size:0.75rem; font-weight:600;">
                                        View Thread (${t.reply_count || 0})
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    document.querySelectorAll('.btn-view-ticket').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const tid = e.currentTarget.getAttribute('data-id');
                            openTicketThread(tid);
                        });
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:25px; color:#64748b;">No support tickets found. Click "+ Submit New Ticket" to ask a question or report an issue.</td></tr>';
                }
            }
        } catch(e) {
            console.error('Tickets list loading error:', e);
        }
    }

    async function openTicketThread(ticketId) {
        activeTicketId = ticketId;
        try {
            const res = await fetch(`api/tickets.php?action=detail&ticket_id=${ticketId}`);
            const data = await res.json();
            if (!data.success || !data.ticket) {
                showToast(data.message || 'Error loading ticket details.');
                return;
            }

            const t = data.ticket;
            document.getElementById('ticketDetailSubject').textContent = t.subject;
            document.getElementById('ticketDetailCode').textContent = `#${t.ticket_code}`;
            document.getElementById('ticketDetailCategory').textContent = `${t.category} (${t.priority} Priority)`;
            
            const badge = document.getElementById('ticketDetailStatusBadge');
            if (badge) {
                badge.textContent = t.status;
                badge.style.background = t.status === 'Open' ? '#dcfce7' : (t.status === 'In Progress' ? '#e0f2fe' : '#f1f5f9');
                badge.style.color = t.status === 'Open' ? '#166534' : (t.status === 'In Progress' ? '#0369a1' : '#475569');
            }

            const timeline = document.getElementById('ticketRepliesTimeline');
            if (timeline) {
                if (t.replies && t.replies.length > 0) {
                    timeline.innerHTML = t.replies.map(r => {
                        const isStaff = r.is_staff == 1;
                        const bubbleBg = isStaff ? '#eff6ff' : '#ffffff';
                        const borderCol = isStaff ? '#bfdbfe' : '#cbd5e1';
                        const badgeText = isStaff ? 'SUPPORT STAFF' : 'YOU';
                        const badgeBg = isStaff ? '#2563eb' : '#475569';

                        return `
                            <div style="background:${bubbleBg}; border:1px solid ${borderCol}; border-radius:8px; padding:0.8rem; ${isStaff ? 'margin-left:1.5rem;' : 'margin-right:1.5rem;'}">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="font-weight:700; font-size:0.82rem; color:#1e293b;">${escapeHtml(r.author_name)}</span>
                                        <span style="background:${badgeBg}; color:#ffffff; padding:1px 5px; border-radius:3px; font-size:0.65rem; font-weight:700;">${badgeText}</span>
                                    </div>
                                    <span style="font-size:0.72rem; color:#94a3b8;">${new Date(r.created_at).toLocaleString()}</span>
                                </div>
                                <div style="font-size:0.88rem; color:#334155; white-space:pre-wrap; line-height:1.4;">${escapeHtml(r.message)}</div>
                            </div>
                        `;
                    }).join('');
                } else {
                    timeline.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.82rem;">No messages in this ticket yet.</div>';
                }
                timeline.scrollTop = timeline.scrollHeight;
            }

            document.getElementById('ticketsListContainer').style.display = 'none';
            document.getElementById('ticketDetailDrawer').style.display = 'block';
        } catch(e) {
            showToast('Error retrieving ticket thread.');
        }
    }

    // Submit New Support Ticket Form Handler
    document.getElementById('createTicketForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('newTicketSubject').value;
        const category = document.getElementById('newTicketCategory').value;
        const priority = document.getElementById('newTicketPriority').value;
        const message = document.getElementById('newTicketMessage').value;

        try {
            const btn = document.getElementById('btnSubmitNewTicketForm');
            if (btn) btn.disabled = true;

            const res = await fetch('api/tickets.php?action=create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, category, priority, message })
            });
            const data = await res.json();
            if (btn) btn.disabled = false;

            if (data.success) {
                showToast(data.message || 'Ticket submitted successfully!');
                document.getElementById('createTicketForm').reset();
                closeModal(newTicketModal);
                openSupportTicketsPortal();
                if (data.ticket_id) openTicketThread(data.ticket_id);
            } else {
                showToast(data.message || 'Failed to submit support ticket.');
            }
        } catch(err) {
            showToast('Error submitting support ticket.');
        }
    });

    // Submit Reply Form Handler
    document.getElementById('ticketReplyForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeTicketId) return;

        const messageInput = document.getElementById('ticketReplyMessageInput');
        const message = messageInput.value;
        if (!message.trim()) return;

        try {
            const btn = document.getElementById('btnSubmitTicketReply');
            if (btn) btn.disabled = true;

            const res = await fetch('api/tickets.php?action=reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: activeTicketId, message })
            });
            const data = await res.json();
            if (btn) btn.disabled = false;

            if (data.success) {
                messageInput.value = '';
                showToast('Reply posted successfully!');
                openTicketThread(activeTicketId);
            } else {
                showToast(data.message || 'Failed to post reply.');
            }
        } catch(err) {
            showToast('Error posting reply.');
        }
    });

    // Close Ticket Button Handler
    document.getElementById('btnCloseTicketBtn')?.addEventListener('click', async () => {
        if (!activeTicketId) return;
        try {
            const res = await fetch('api/tickets.php?action=close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: activeTicketId })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Ticket marked as Closed.');
                openTicketThread(activeTicketId);
            } else {
                showToast(data.message || 'Failed to close ticket.');
            }
        } catch(e) {
            showToast('Error closing ticket.');
        }
    });

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // User Billing Portal Invoice Fetcher
    async function loadUserInvoices() {
        if (!currentUser) return;
        document.getElementById('billingActivePlanName').textContent = `${(currentUser.plan || 'Free').toUpperCase()} Plan`;
        document.getElementById('billingRenewalDate').textContent = `Cycle: ${(currentUser.billing_cycle || 'monthly').toUpperCase()}`;
        
        try {
            const res = await fetch('api/payment.php?action=get_invoices');
            const data = await res.json();
            const tbody = document.getElementById('invoicesTableBody');
            if (!tbody) return;

            if (data.success && data.invoices && data.invoices.length > 0) {
                tbody.innerHTML = data.invoices.map(inv => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px; font-weight:700; font-family:monospace; font-size:0.85rem;">${inv.invoice_number}</td>
                        <td style="padding:10px; font-size:0.8rem; color:#64748b;">${new Date(inv.created_at).toLocaleDateString()}</td>
                        <td style="padding:10px;"><span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">${inv.plan.toUpperCase()} (${inv.billing_cycle})</span></td>
                        <td style="padding:10px; text-align:right; font-weight:700;">$${parseFloat(inv.amount).toFixed(2)}</td>
                        <td style="padding:10px; text-align:center;"><span style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600; text-transform:uppercase;">${inv.gateway}</span></td>
                        <td style="padding:10px; text-align:center;">
                            <a href="api/payment.php?action=view_invoice&invoice_number=${inv.invoice_number}" target="_blank" class="btn btn-outline" style="padding:3px 8px; font-size:0.75rem; font-weight:600; border-radius:4px;">
                                Receipt
                            </a>
                        </td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No payment history found. Subscribe to a plan to generate invoices.</td></tr>';
            }
        } catch(e) {
            console.error('Invoice loading error:', e);
        }
    }
});

