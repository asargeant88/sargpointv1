<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/auth.php';
$currentUser = getCurrentUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sargpoint GIS Workspace & Projection Converter</title>
    <meta name="description" content="SaaS GIS Data Workspace & Projection Converter for ArcGIS, QGIS, Tableau, AutoCAD Civil 3D, and Global Mapper.">
    
    <!-- Stylesheets & Leaflet -->
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    
    <!-- JS Dependencies (Leaflet, Proj4, JSZip, sql.js WebAssembly, hyparquet Parquet Engine) -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script type="module">
        try {
            import('https://cdn.jsdelivr.net/npm/hyparquet@0.17.1/+esm').then(m => {
                window.hyparquet = m;
            }).catch(() => {});
        } catch(e) {}
    <!-- Stripe JS SDK v3 -->
    <script src="https://js.stripe.com/v3/"></script>
</head>
<body>

    <div class="app-container">
        <!-- 1. Leftmost Icon Rail Bar -->
        <div class="icon-rail">
            <div class="rail-logo" title="Sargpoint GIS">
                <svg viewBox="0 0 24 24"><path d="M20.5 3l-6 2.25L9 3 3.5 5.25v15.5l5.5-2.25 5.5 2.25 6-2.25V3zM9 5.14l4.5 1.8v11.92l-4.5-1.8V5.14zM5 6.78l2.5-.96v11.97l-2.5.96V6.78zm14 10.44l-3 .96V6.21l3-.96v11.97z"/></svg>
            </div>
            
            <div class="rail-menu">
                <button class="rail-item active" id="railConverter" title="GIS Converter">
                    <svg viewBox="0 0 24 24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13H19v6h-2.8z"/></svg>
                </button>

                <button class="rail-item" id="railMeasure" title="Measure Distance">
                    <svg viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v2h2V8h2v4h2V8h2v2h2V8h3v8z"/></svg>
                </button>

                <button class="rail-item" id="railDatasets" title="Spatial Datasets">
                    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                </button>

                <button class="rail-item" id="railSpreadsheetNav" title="Spreadsheet Data View">
                    <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H5v-4h4v4zm0-6H5V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4zm5 6h-4v-4h1v-2h-1V7h4v10z"/></svg>
                </button>

                <button class="rail-item" id="railApi" title="Developer API Key">
                    <svg viewBox="0 0 24 24"><path d="M7 14c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm13-7h-9.17C10.4 5.16 8.37 4 6 4c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.37 0 4.4-1.16 5.43-3H14v3h3v-3h3V7zM6 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                </button>

                <button class="rail-item" id="railPricing" title="Pricing & Quota Plans">
                    <svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                </button>
            </div>
        </div>

        <!-- 2. Subpanel Drawer (Spatial Layer Management) -->
        <div class="subpanel">
            <div class="subpanel-header">
                <h3>Sargpoint GIS Workspace</h3>
                <div class="subpanel-actions">
                    <span class="btn-icon" title="Workspace Layers"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/></svg></span>
                </div>
            </div>

            <!-- Search Filter Bar -->
            <div class="search-box">
                <input type="text" placeholder="Search for Datasets..." id="datasetSearchInput">
            </div>

            <!-- Dataset Categories / Format Quick Filter -->
            <div class="filter-pills">
                <button class="pill active">All</button>
                <button class="pill">SHP</button>
                <button class="pill">KMZ</button>
                <button class="pill">KML</button>
                <button class="pill">SQLite</button>
                <button class="pill">Parquet</button>
            </div>

            <!-- Uploaded Datasets List -->
            <div class="datasets-list" id="datasetsList">
                <div style="padding:1.5rem 1rem; text-align:center; color:var(--text-secondary); font-size:0.85rem;">
                    <div>No datasets uploaded yet</div>
                    <div style="font-size:0.75rem; margin-top:0.35rem;">Drag & drop a GIS file (.gpx, .sqlite, .kmz, .kml, .shp, .parquet, .geojson) to map</div>
                </div>
            </div>
        </div>

        <!-- 3. Main Center Panel (Leaflet Map Workspace) -->
        <div class="main-content">
            <!-- Top Floating Header Bar -->
            <div class="top-nav-bar">
                <div class="search-location-group">
                    <input type="text" class="search-input" placeholder="Global search datasets, EPSG codes, formats...">
                </div>

                <div class="top-actions">
                    <button class="btn btn-outline active" id="btnToggleDLSGrid" title="Toggle Meridian, Township & Section Gridlines">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/></svg>
                        DLS Gridlines
                    </button>
                    <button class="btn btn-outline" id="measureBtn">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v2h2V8h2v4h2V8h2v2h2V8h3v8z"/></svg>
                        Measure Distance
                    </button>
                    <button class="btn btn-outline" id="spreadsheetBtn">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H5v-4h4v4zm0-6H5V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4zm5 6h-4v-4h1v-2h-1V7h4v10z"/></svg>
                        Spreadsheet View
                    </button>
                    <div class="plan-usage-badge" id="usageBadge">
                        Plan: <strong>Free Guest</strong> | Used: <strong>0 MB</strong>
                    </div>
                    <button class="btn btn-outline" id="pricingBtn">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                        Pricing & Plans
                    </button>
                    <button class="btn btn-outline" id="billingBtn" title="Billing History & Download Invoices">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                        Billing & Invoices
                    </button>
                    <div class="user-profile-badge" id="userProfileBadge">
                        <div class="avatar-icon">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <span id="userName" style="font-weight:600; line-height:1.2;">Sign In / Register</span>
                            <span id="userRole" style="font-size:0.7rem; color:var(--text-secondary);">Free Guest</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Leaflet Interactive Canvas Container -->
            <div id="mapCanvas"></div>

            <!-- Floating Distance Measurement Control Panel -->
            <div class="measure-floating-panel" id="measureFloatingPanel" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:0.6rem;">
                    <div style="font-weight:700; font-size:0.88rem; display:flex; align-items:center; gap:6px;">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="fill:var(--accent-red);"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v2h2V8h2v4h2V8h2v2h2V8h3v8z"/></svg>
                        Distance Measure Tool
                    </div>
                    <span id="closeMeasureToolBtn" style="cursor:pointer; color:var(--text-secondary); font-size:1.1rem; font-weight:700;">&times;</span>
                </div>
                
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.5rem;" id="measureInstructionText">
                    Click points on the map to measure line distances.
                </div>

                <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:6px; padding:0.6rem; margin-bottom:0.75rem;">
                    <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-secondary); font-weight:700;">Total Distance</div>
                    <div style="font-size:1.3rem; font-weight:800; color:var(--accent-blue);" id="measureTotalDistance">0 m / 0 ft</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;" id="measurePointsCount">0 Point(s) clicked</div>
                </div>

                <div style="display:flex; gap:0.4rem;">
                    <button class="btn btn-outline" id="clearMeasurePointsBtn" style="flex:1; padding:0.35rem 0.6rem; font-size:0.78rem;">Clear Points</button>
                    <button class="btn btn-primary" id="finishMeasureBtn" style="flex:1; padding:0.35rem 0.6rem; font-size:0.78rem;">Done</button>
                </div>
            </div>

            <!-- Floating Satellite & Topo Basemap Switcher Control Bar -->
            <div class="basemap-switcher-bar">
                <button class="basemap-btn active" id="btnStreets">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M20.5 3l-6 2.25L9 3 3.5 5.25v15.5l5.5-2.25 5.5 2.25 6-2.25V3z"/></svg>
                    Streets
                </button>
                <button class="basemap-btn" id="btnSatellite">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                    Satellite View
                </button>
                <button class="basemap-btn" id="btnTopo">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>
                    Topo View
                </button>
            </div>
        </div>

        <!-- 4. Right Utility Panel (Converter Tooling & Attribute Inspector) -->
        <div class="right-drawer">
            <div class="drawer-header">
                <div>
                    <h3 id="drawerDatasetTitle">GIS Dataset Inspector</h3>
                    <p class="drawer-subtitle" id="drawerDatasetSubtitle">Upload a file (.gpx, .sqlite, .kmz, .kml, .shp, .parquet, .geojson) to locate on map</p>
                </div>
                <span class="btn-icon modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>

            <div class="drawer-body">
                <!-- Action Controls -->
                <div class="action-bar-top">
                    <button class="btn btn-primary" id="convertBtn">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Convert Dataset
                    </button>
                    <button class="btn btn-outline" id="downloadBtn">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                        Download
                    </button>
                </div>

                <!-- Drag & Drop Zone -->
                <div class="dropzone" id="dropzone">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width:36px; height:36px; fill:var(--accent-blue); margin-bottom:8px;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
                    <div style="font-weight:600;">Drag & drop GIS dataset</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">.gpx, .sqlite (.db), .kmz, .kml, .shp (.zip), .parquet, .geojson, .dxf, .csv</div>
                    <input type="file" id="fileInput" style="display:none;" accept=".gpx,.kml,.kmz,.dxf,.csv,.wkt,.sqlite,.db,.spatialite,.gpkg,.geojson,.parquet,.geoparquet,.zip,.gml,.mif,.tab">
                </div>
                <div class="file-info-badge" id="fileInfo"></div>

                <!-- KMZ / Archive Folders Box -->
                <div class="kmz-folders-box" id="kmzFoldersBox">
                    <div class="kmz-folders-title">KMZ Layer Folders</div>
                    <div class="kmz-folders-list" id="kmzFoldersList"></div>
                </div>

                <!-- Extracted Dataset Individual Files Manager Box -->
                <div class="extracted-files-box" id="extractedFilesBox">
                    <div class="extracted-files-title" id="extractedFolderTitle">Extracted Dataset Files</div>
                    <div class="extracted-files-list" id="extractedFilesList"></div>
                </div>

                <!-- Required Format Dropdown -->
                <div class="form-group" style="margin-top:1.2rem;">
                    <label>Required output format:</label>
                    <div class="select-custom-wrapper" id="formatSelectWrapper">
                        <input type="text" id="formatSelectInput" class="form-control select-custom-input" readonly value="GPX - GPS Exchange Format">
                        <svg class="dropdown-chevron svg-icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                        
                        <div class="select-dropdown-list" id="formatDropdownList">
                            <div class="dropdown-search-box">
                                <input type="text" id="formatSearch" placeholder="Search format (e.g. SHP, KML, DXF, GeoJSON)...">
                            </div>
                            <div class="dropdown-options" id="formatOptionsContainer"></div>
                        </div>
                    </div>
                </div>

                <!-- Target CRS Dropdown -->
                <div class="form-group">
                    <label>Target Projection / CRS:</label>
                    <div class="select-custom-wrapper" id="crsSelectWrapper">
                        <input type="text" id="crsSelectInput" class="form-control select-custom-input" readonly value="WGS 84 (Geographic Lat/Lon) (EPSG:4326)">
                        <svg class="dropdown-chevron svg-icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                        
                        <div class="select-dropdown-list" id="crsDropdownList">
                            <div class="dropdown-search-box">
                                <input type="text" id="crsSearch" placeholder="Search EPSG code, region, state plane (e.g. 27700, 3857, OSGB36)...">
                            </div>
                            <div class="dropdown-options" id="crsOptionsContainer"></div>
                        </div>
                    </div>
                </div>

                <div class="checkbox-option">
                    <input type="checkbox" id="cleanDbfOpt" checked>
                    <label for="cleanDbfOpt">Clean SHP 10-char DBF attributes & embed .prj</label>
                </div>

                <!-- Attribute Inspector Table -->
                <div class="spatial-attribute-inspector">
                    <div class="inspector-header">
                        <h4>Spatial Attribute Inspector</h4>
                        <button class="btn btn-outline" id="openSpreadsheetGridBtn" style="padding:2px 8px; font-size:0.75rem;">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H5v-4h4v4zm0-6H5V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4zm5 6h-4v-4h1v-2h-1V7h4v10z"/></svg>
                            Config Spreadsheet
                        </button>
                    </div>

                    <div class="table-responsive">
                        <table class="attr-table">
                            <thead id="attrTableHead">
                                <tr><th>Geometry</th><th>ID</th><th>Name</th><th>Latitude</th><th>Longitude</th></tr>
                            </thead>
                            <tbody id="attrTableBody">
                                <tr><td colspan="5" style="text-align:center;">No features found</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL 1: Account Access / Google Auth Modal -->
    <div class="modal-overlay" id="authModal">
        <div class="modal-container" style="max-width:440px;">
            <div class="modal-header">
                <h3>Account Access & Quotas</h3>
                <span class="modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>
            <div class="modal-body" style="padding:1.5rem;">
                <div style="text-align:center; margin-bottom:1.5rem;">
                    <div style="font-weight:700; font-size:1.1rem; color:var(--text-primary);">Sargpoint GIS Workspace</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">Sign in to access your plan limits and API keys</div>
                </div>

                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="authEmail" class="form-control" placeholder="user@domain.com" value="demo@sargpoint.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="authPassword" class="form-control" placeholder="••••••••" value="password123">
                </div>

                <button class="btn btn-primary" id="loginEmailBtn" style="width:100%; margin-top:1rem; padding:0.75rem;">
                    Sign In with Email
                </button>

                <div style="text-align:center; margin:1rem 0; color:var(--text-secondary); font-size:0.8rem;">OR</div>

                <button class="btn btn-outline" id="loginGoogleBtn" style="width:100%; padding:0.7rem; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <svg viewBox="0 0 24 24" style="width:18px; height:18px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Continue with Google OAuth
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL 2: Pricing & Quota Plans Modal -->
    <div class="modal-overlay" id="pricingModal">
        <div class="modal-container" style="max-width:960px;">
            <div class="modal-header">
                <h3>Pricing & Subscription Quotas</h3>
                <span class="modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>
            <div class="modal-body" style="padding:1.5rem 2rem;">
                <div style="display:flex; align-items:center; justify-content:center; gap:0.75rem; margin-bottom:1.8rem;">
                    <span style="font-weight:600;">Monthly Billing</span>
                    <label class="switch">
                        <input type="checkbox" id="billingToggleInput" checked>
                        <span class="slider"></span>
                    </label>
                    <span style="font-weight:600;">Yearly Billing <span style="background:var(--accent-blue-light); color:var(--accent-blue); padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">SAVE 50%</span></span>
                </div>

                <div class="pricing-grid">
                    <!-- Starter Plan Card -->
                    <div class="pricing-card">
                        <div class="plan-name">Starter Plan</div>
                        <div class="plan-price" id="starterPrice">$5 <span>/ mo ($60/yr)</span></div>
                        <ul class="plan-features">
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 100 MB monthly upload quota</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 30 files / month</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> All standard GIS formats</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 100+ EPSG projections</li>
                        </ul>
                        <button class="btn btn-outline" onclick="selectPlan('starter')">Choose Starter</button>
                    </div>

                    <!-- Pro Plan Card -->
                    <div class="pricing-card popular">
                        <div class="popular-tag">MOST POPULAR</div>
                        <div class="plan-name">Pro Plan</div>
                        <div class="plan-price" id="proPrice">$15 <span>/ mo ($180/yr)</span></div>
                        <ul class="plan-features">
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 2 GB monthly upload quota</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 500 files / month</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Developer API Access</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Batch conversion tools</li>
                        </ul>
                        <button class="btn btn-primary" onclick="selectPlan('pro')">Upgrade to Pro</button>
                    </div>

                    <!-- Enterprise Plan Card -->
                    <div class="pricing-card">
                        <div class="plan-name">Enterprise</div>
                        <div class="plan-price" id="enterprisePrice">$35 <span>/ mo ($420/yr)</span></div>
                        <ul class="plan-features">
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 100 GB monthly upload quota</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Unlimited files / month</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Dedicated REST API</li>
                            <li><svg class="svg-icon feature-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Priority support</li>
                        </ul>
                        <button class="btn btn-outline" onclick="selectPlan('enterprise')">Choose Enterprise</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL 3: Developer API Key Modal -->
    <div class="modal-overlay" id="apiModal">
        <div class="modal-container" style="max-width:540px;">
            <div class="modal-header">
                <h3>Developer API Key</h3>
                <span class="modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>
            <div class="modal-body" style="padding:1.5rem;">
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:1rem;">
                    Use your API key to automate GIS projection conversions in Python, QGIS plugins, or Node.js.
                </p>
                <div class="form-group">
                    <label>Your Secret API Key:</label>
                    <input type="text" class="form-control" readonly value="sp_live_99f3a8b277e104cd829a" id="apiKeyDisplay">
                </div>
                <button class="btn btn-outline" onclick="navigator.clipboard.writeText('sp_live_99f3a8b277e104cd829a'); showToast('API Key copied to clipboard!');">
                    Copy Key
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL 4: Configurable Spreadsheet Data Grid Modal -->
    <div class="modal-overlay" id="spreadsheetModal">
        <div class="modal-container" style="max-width:1150px;">
            <div class="modal-header">
                <div>
                    <h3 id="spreadsheetTitle">Editable Spreadsheet Data Grid</h3>
                    <p class="drawer-subtitle" id="spreadsheetSubtitle">Configure properties, edit cells, or export selected features with elevations & Legal Land Descriptions</p>
                </div>
                <span class="modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>

            <div class="modal-body" style="padding:1.2rem 1.5rem;">
                <!-- Spreadsheet Grid Toolbar Controls -->
                <div class="spreadsheet-toolbar">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn btn-primary" id="saveSpreadsheetBtn">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                            Save Changes
                        </button>
                        <button class="btn btn-outline" id="fetchElevationsBtn">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>
                            Fetch Terrain Elevations
                        </button>
                        <button class="btn btn-outline" id="addColumnBtn">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                            Add Column
                        </button>
                        <button class="btn btn-outline" id="addRowBtn">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                            Add Row
                        </button>
                    </div>

                    <!-- Multi-Format Export Options for Spreadsheet Rows -->
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <select id="spreadsheetExportFormatSelect" class="form-control" style="width:160px; padding:0.4rem;">
                            <option value="csv">CSV Spreadsheet (Elevations & LLD)</option>
                            <option value="shp">Shapefile (.shp zip)</option>
                            <option value="kmz">KMZ (Google Earth 3D)</option>
                            <option value="kml">KML (Google Earth 3D)</option>
                            <option value="gpx">GPX (GPS Track & Ele)</option>
                            <option value="spatialite">SQLite / SpatiaLite</option>
                            <option value="parquet">Parquet / GeoParquet</option>
                            <option value="geojson">GeoJSON (.geojson)</option>
                            <option value="dxf">DXF (AutoCAD 3D)</option>
                            <option value="gpkg">GPKG (GeoPackage)</option>
                            <option value="wkt">WKT 3D Text</option>
                        </select>
                        <button class="btn btn-primary" id="exportSelectedBtn">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            <span id="exportSelectedBtnText">Export Selected</span>
                        </button>
                        <button class="btn btn-outline" id="exportAllAnyFormatBtn">Export All</button>
                    </div>
                </div>

                <!-- Spreadsheet Grid Table Container -->
                <div class="spreadsheet-grid-wrapper">
                    <table class="spreadsheet-table">
                        <thead id="spreadsheetHead"></thead>
                        <tbody id="spreadsheetBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL 6: Subscription Checkout Modal (Stripe Checkout & Card Gateway) -->
    <div class="modal-overlay" id="checkoutModal">
        <div class="modal-container" style="max-width:650px;">
            <div class="modal-header">
                <h3>Stripe Subscription Checkout</h3>
                <span class="modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>
            <div class="modal-body" style="padding:1.5rem 2rem;">
                <!-- Order Summary Box -->
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:1rem; margin-bottom:1.2rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:700; font-size:1.05rem; color:#1e293b;" id="checkoutPlanName">Pro Plan</div>
                        <div style="font-size:0.8rem; color:#64748b;" id="checkoutBillingCycle">Billed Monthly ($20.00 / mo)</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.3rem; font-weight:800; color:#2563eb;" id="checkoutTotalAmount">$20.00</div>
                        <div style="font-size:0.72rem; color:#166534; font-weight:600; background:#dcfce7; padding:2px 6px; border-radius:10px; display:inline-block;" id="checkoutDiscountBadge">Active Rate</div>
                    </div>
                </div>

                <!-- Stripe Hosted Checkout Redirect Button (if live API key configured) -->
                <div id="stripeHostedCheckoutBox" style="display:none; margin-bottom:1.2rem;">
                    <button class="btn btn-primary" id="btnStripeHostedCheckout" style="width:100%; padding:0.85rem; font-size:1rem; font-weight:700; background:#635bff; border-color:#635bff; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff"><path d="M13.98 11.07c-1.3-.32-2.31-.62-2.31-1.32 0-.6.53-.98 1.48-.98 1.5 0 2.87.6 3.66 1.13l.83-2.12c-.93-.65-2.52-1.12-4.49-1.12-3.1 0-5.18 1.6-5.18 4.09 0 3.84 5.3 3.25 5.3 4.93 0 .76-.69 1.08-1.74 1.08-1.75 0-3.32-.77-4.27-1.42l-.84 2.18c1.12.78 3.12 1.34 5.11 1.34 3.26 0 5.46-1.55 5.46-4.14 0-4.04-5.3-3.32-5.3-4.83z"/></svg>
                        Proceed to Official Stripe Checkout
                    </button>
                </div>

                <!-- Credit/Debit Card Form (Stripe Card Gateway) -->
                <form id="customCardForm">
                    <div style="font-weight:700; font-size:0.88rem; color:#334155; margin-bottom:0.75rem; display:flex; align-items:center; gap:6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#635bff"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                        Stripe Card Payment Details
                    </div>
                    <div class="form-group" style="margin-bottom:0.8rem;">
                        <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block;">Cardholder Name</label>
                        <input type="text" class="form-control" id="cardNameInput" placeholder="John Doe" required style="padding:0.55rem; width:100%;">
                    </div>
                    <div class="form-group" style="margin-bottom:0.8rem;">
                        <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block;">Card Number</label>
                        <input type="text" class="form-control" id="cardNumberInput" placeholder="4242 •••• •••• 4242" maxlength="19" required style="padding:0.55rem; width:100%;">
                    </div>
                    <div style="display:flex; gap:0.8rem; margin-bottom:1.2rem;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block;">Expiry (MM/YY)</label>
                            <input type="text" class="form-control" id="cardExpiryInput" placeholder="12/28" maxlength="5" required style="padding:0.55rem; width:100%;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block;">CVC / CVV</label>
                            <input type="text" class="form-control" id="cardCvcInput" placeholder="382" maxlength="4" required style="padding:0.55rem; width:100%;">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" id="btnSubmitCardPayment" style="width:100%; padding:0.75rem; font-size:0.95rem; font-weight:700; background:#635bff; border-color:#635bff;">
                        Pay <span id="cardPayAmount">$20.00</span> & Activate Plan
                    </button>
                    <div style="font-size:0.72rem; color:#94a3b8; text-align:center; margin-top:0.6rem; display:flex; align-items:center; justify-content:center; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#94a3b8"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                        Encrypted 256-Bit SSL Stripe Security
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- MODAL 7: User Billing & Invoices Portal Modal -->
    <div class="modal-overlay" id="billingModal">
        <div class="modal-container" style="max-width:850px;">
            <div class="modal-header">
                <h3>Billing & Subscription Invoices</h3>
                <span class="modal-close"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
            </div>
            <div class="modal-body" style="padding:1.5rem 2rem;">
                <!-- Current Subscription Status Banner -->
                <div style="background:linear-gradient(135deg, #1e40af, #2563eb); color:#ffffff; padding:1.2rem; border-radius:8px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 12px rgba(37,99,235,0.2);">
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; opacity:0.9;">Active Subscription</div>
                        <div style="font-size:1.3rem; font-weight:800; margin-top:2px;" id="billingActivePlanName">Pro Plan</div>
                        <div style="font-size:0.8rem; opacity:0.85; margin-top:2px;" id="billingRenewalDate">Renews: Active</div>
                    </div>
                    <button class="btn btn-outline" style="background:rgba(255,255,255,0.15); color:#ffffff; border-color:rgba(255,255,255,0.4);" id="btnChangePlanFromBilling">
                        Change Plan
                    </button>
                </div>

                <!-- Invoices Table -->
                <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem; color:#334155;">Payment & Invoice History</h4>
                <div style="overflow-x:auto;">
                    <table class="spreadsheet-table" style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f1f5f9;">
                                <th style="padding:10px; text-align:left;">Invoice #</th>
                                <th style="padding:10px; text-align:left;">Date</th>
                                <th style="padding:10px; text-align:left;">Plan & Cycle</th>
                                <th style="padding:10px; text-align:right;">Amount</th>
                                <th style="padding:10px; text-align:center;">Gateway</th>
                                <th style="padding:10px; text-align:center;">Receipt</th>
                            </tr>
                        </thead>
                        <tbody id="invoicesTableBody">
                            <tr>
                                <td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No payment history found.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL 5: Real-Time Conversion & Export Progress Overlay Modal -->
    <div class="modal-overlay" id="conversionProgressModal">
        <div class="conversion-progress-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="progress-spinner"></div>
                    <div>
                        <h3 style="font-size:1.1rem; font-weight:700;" id="progressModalTitle">Converting Spatial Dataset...</h3>
                        <p style="font-size:0.8rem; color:var(--text-secondary);" id="progressModalSubtitle">Processing geometry features & CRS projections</p>
                    </div>
                </div>
                <div style="font-size:1.4rem; font-weight:800; color:var(--accent-blue);" id="progressPercentText">0%</div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-bar-track">
                <div class="progress-bar-fill" id="progressBarFill" style="width:0%;"></div>
            </div>

            <!-- Step-by-Step Progress List -->
            <div class="progress-steps-list">
                <div class="progress-step-item active" id="step1">
                    <svg class="svg-icon step-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    <span>Step 1: Reading and parsing spatial features & attributes...</span>
                </div>
                <div class="progress-step-item" id="step2">
                    <svg class="svg-icon step-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    <span>Step 2: Reprojecting coordinates to target CRS projection...</span>
                </div>
                <div class="progress-step-item" id="step3">
                    <svg class="svg-icon step-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    <span>Step 3: Compiling output format geometry structures & binary encoding...</span>
                </div>
                <div class="progress-step-item" id="step4">
                    <svg class="svg-icon step-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    <span>Step 4: Finalizing package bundle & launching download...</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Sleek Toast Notification Container -->
    <div id="toastContainer"></div>

    <!-- Application Controller Scripts -->
    <script src="js/converter.js?v=1.3.1"></script>
    <script src="js/app.js?v=1.3.1"></script>
</body>
</html>
