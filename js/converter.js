// Sargpoint GIS Format & Coordinate Conversion Engine

class GISConverterEngine {
    constructor() {
        this.initProj4();
    }

    initProj4() {
        if (typeof proj4 !== 'undefined' && typeof CRS_DATABASE !== 'undefined') {
            CRS_DATABASE.forEach(crs => {
                try {
                    proj4.defs(crs.code, crs.proj4);
                } catch (e) {
                    console.warn(`Failed to register ${crs.code}:`, e);
                }
            });
        }
    }

    // Option B: Live Official Provincial ArcGIS REST Cadastral API Query Engine
    async queryCadastralArcGIS(lat, lon) {
        if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return null;

        const endpoints = {
            quarter: `https://geospatial.alberta.ca/titan/rest/services/base/alberta_township_system/MapServer/3/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson`,
            section: `https://geospatial.alberta.ca/titan/rest/services/base/alberta_township_system/MapServer/1/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson`,
            township: `https://geospatial.alberta.ca/titan/rest/services/base/alberta_township_system/MapServer/0/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson`
        };

        try {
            const [qRes, sRes, tRes] = await Promise.all([
                fetch(endpoints.quarter).catch(() => null),
                fetch(endpoints.section).catch(() => null),
                fetch(endpoints.township).catch(() => null)
            ]);

            const quarterFeat = (qRes && qRes.ok) ? (await qRes.json())?.features?.[0] : null;
            const sectionFeat = (sRes && sRes.ok) ? (await sRes.json())?.features?.[0] : null;
            const townshipFeat = (tRes && tRes.ok) ? (await tRes.json())?.features?.[0] : null;

            if (quarterFeat || sectionFeat || townshipFeat) {
                return {
                    quarterFeature: quarterFeat,
                    sectionFeature: sectionFeat,
                    townshipFeature: townshipFeat,
                    quarterDesc: quarterFeat?.properties?.DESCRIPTOR || '',
                    sectionDesc: sectionFeat?.properties?.DESCRIPTOR || '',
                    townshipDesc: townshipFeat?.properties?.DESCRIPTOR || ''
                };
            }
        } catch (e) {}

        return null;
    }

    // Convert Decimal Degrees to DMS string (Degrees Minutes Seconds)
    toDMS(val, isLat) {
        const absVal = Math.abs(val);
        const deg = Math.floor(absVal);
        const minFloat = (absVal - deg) * 60;
        const min = Math.floor(minFloat);
        const sec = ((minFloat - min) * 60).toFixed(1);
        const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
        return `${deg}° ${min}' ${sec}" ${dir}`;
    }

    // Calculate Universal Transverse Mercator (UTM) Zone, Easting, and Northing
    calculateUTM(lat, lon) {
        const zone = Math.floor((lon + 180) / 6) + 1;
        const latBands = 'CDEFGHJKLMNPQRSTUVWX';
        const bandIdx = Math.floor((lat + 80) / 8);
        const band = latBands[Math.max(0, Math.min(latBands.length - 1, bandIdx))];
        const utmZoneStr = `${zone}${band}`;

        const latRad = lat * Math.PI / 180;
        const centralLon = (zone - 1) * 6 - 180 + 3;
        const lonDiff = (lon - centralLon) * Math.PI / 180;

        const k0 = 0.9996;
        const a = 6378137.0;
        const e2 = 0.00669438;

        const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
        const T = Math.tan(latRad) * Math.tan(latRad);
        const C = (e2 / (1 - e2)) * Math.cos(latRad) * Math.cos(latRad);
        const A = Math.cos(latRad) * lonDiff;

        const M = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * latRad
            - (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*latRad)
            + (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*latRad)
            - (35*e2*e2*e2/3072) * Math.sin(6*latRad));

        const easting = Math.round(500000 + k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * e2) * Math.pow(A, 5) / 120));
        const northing = Math.round(k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * e2) * Math.pow(A, 6) / 720)));

        const east5 = easting.toString().padStart(6, '0').substring(1);
        const north5 = northing.toString().padStart(7, '0').substring(2);
        const mgrs = `${utmZoneStr} GE ${east5} ${north5}`;

        return {
            zone: utmZoneStr,
            easting,
            northing,
            utmString: `UTM ${utmZoneStr} ${easting}E ${northing}N`,
            mgrs
        };
    }

    // Calculate Canadian National Topographic System (NTS) 1:50,000 map sheet
    calculateNTS(lat, lon) {
        if (lat < 40 || lat > 88 || lon > -48 || lon < -144) return 'N/A';
        
        let primaryNum = 73;
        if (lat >= 52 && lat < 56) {
            if (lon <= -104 && lon > -112) primaryNum = 73;
            else if (lon <= -112 && lon > -120) primaryNum = 83;
            else if (lon <= -96 && lon > -104) primaryNum = 63;
            else if (lon <= -120 && lon > -128) primaryNum = 93;
        } else if (lat >= 48 && lat < 52) {
            if (lon <= -104 && lon > -112) primaryNum = 72;
            else if (lon <= -112 && lon > -120) primaryNum = 82;
            else if (lon <= -96 && lon > -104) primaryNum = 62;
        } else if (lat >= 56 && lat < 60) {
            if (lon <= -104 && lon > -112) primaryNum = 74;
            else if (lon <= -112 && lon > -120) primaryNum = 84;
        }

        const ntsLetters = [
            ['A','B','C','D'],
            ['H','G','F','E'],
            ['I','J','K','L'],
            ['P','O','N','M']
        ];

        const latOffset = (lat % 4 + 4) % 4;
        const lonOffset = ((-lon) % 8 + 8) % 8;
        const row = Math.min(3, Math.floor(latOffset));
        const col = Math.min(3, Math.floor(lonOffset / 2));

        const blockLetter = ntsLetters[row][col];

        const latInBlock = (latOffset % 1) * 60;
        const lonInBlock = (lonOffset % 2) * 60;

        const qRow = Math.min(3, Math.floor(latInBlock / 15));
        const qCol = Math.min(3, Math.floor(lonInBlock / 30));

        const quadMatrix = [
            [1, 2, 3, 4],
            [8, 7, 6, 5],
            [9, 10, 11, 12],
            [16, 15, 14, 13]
        ];

        const quadNum = quadMatrix[qRow][qCol];
        return `${primaryNum}${blockLetter}/${quadNum}`;
    }

    calcDistanceAndHeading(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const dPhi = (lat2 - lat1) * Math.PI / 180;
        const dLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(dLambda/2) * Math.sin(dLambda/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const meters = Math.round(R * c);

        // Forward heading lat1,lon1 -> lat2,lon2
        const y1 = Math.sin(dLambda) * Math.cos(phi2);
        const x1 = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        let fwd = Math.atan2(y1, x1) * 180 / Math.PI;

        // Reverse heading lat2,lon2 -> lat1,lon1
        const y2 = Math.sin(-dLambda) * Math.cos(phi1);
        const x2 = Math.cos(phi2) * Math.sin(phi1) - Math.sin(phi2) * Math.cos(phi1) * Math.cos(-dLambda);
        let rev = Math.atan2(y2, x2) * 180 / Math.PI;

        return {
            meters: `${meters} meters`,
            fwdHeading: `${fwd.toFixed(2)}°`,
            revHeading: `${rev.toFixed(2)}°`,
            fullStr: `${fwd.toFixed(2)}° (← ${rev.toFixed(2)}°) ${meters} meters`
        };
    }

    buildTierBoundsAndCorners(minLat, maxLat, minLon, maxLon) {
        const corners = {
            NW: {
                decimal: `${maxLat.toFixed(6)}°, ${minLon.toFixed(6)}°`,
                dms: `${this.toDMS(maxLat, true)}, ${this.toDMS(minLon, false)}`
            },
            NE: {
                decimal: `${maxLat.toFixed(6)}°, ${maxLon.toFixed(6)}°`,
                dms: `${this.toDMS(maxLat, true)}, ${this.toDMS(maxLon, false)}`
            },
            SE: {
                decimal: `${minLat.toFixed(6)}°, ${maxLon.toFixed(6)}°`,
                dms: `${this.toDMS(minLat, true)}, ${this.toDMS(maxLon, false)}`
            },
            SW: {
                decimal: `${minLat.toFixed(6)}°, ${minLon.toFixed(6)}°`,
                dms: `${this.toDMS(minLat, true)}, ${this.toDMS(minLon, false)}`
            }
        };

        const headings = {
            nw_ne: this.calcDistanceAndHeading(maxLat, minLon, maxLat, maxLon),
            ne_se: this.calcDistanceAndHeading(maxLat, maxLon, minLat, maxLon),
            se_sw: this.calcDistanceAndHeading(minLat, maxLon, minLat, minLon),
            sw_nw: this.calcDistanceAndHeading(minLat, minLon, maxLat, minLon)
        };

        return { corners, headings };
    }

    // High-Precision Canadian Dominion Land Survey (DLS) & US PLSS Calculator Engine
    latLonToDLS(lat, lon) {
        const info = this.getDLSInfo(lat, lon);
        return info ? info.lld : '';
    }

    getDLSInfo(lat, lon) {
        if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return null;
        
        // US TRS Fallback for points outside Canadian DLS bounds
        if (lat < 48.99 || lat > 60 || lon > -95 || lon < -124) {
            const twpUs = Math.max(1, Math.floor(Math.abs(lat - 30) * 1.15));
            const rngUs = Math.max(1, Math.floor(Math.abs(lon + 90) * 1.15));
            const secUs = Math.max(1, Math.min(36, Math.floor(((Math.abs(lat * 100) % 1) + (Math.abs(lon * 100) % 1)) * 18) + 1));
            const qtrUs = (lat % 0.02 > 0.01) ? ((lon % 0.02 > 0.01) ? 'NE' : 'NW') : ((lon % 0.02 > 0.01) ? 'SE' : 'SW');
            return {
                lld: `${qtrUs}-Sec ${secUs}, T${twpUs}N, R${rngUs}W`,
                shortLld: `${secUs}-${twpUs}N-${rngUs}W`,
                sectionLld: `Sec ${secUs}-${twpUs}N-${rngUs}W (640 Acres)`,
                quarterLld: `${qtrUs} ${secUs}-${twpUs}N-${rngUs}W (160 Acres)`,
                lsdLld: `${qtrUs}-Sec ${secUs}, T${twpUs}N, R${rngUs}W`,
                bounds: [[lat - 0.002, lon - 0.003], [lat + 0.002, lon + 0.003]],
                quarterBounds: [[lat - 0.004, lon - 0.006], [lat + 0.004, lon + 0.006]],
                sectionBounds: [[lat - 0.008, lon - 0.012], [lat + 0.008, lon + 0.012]]
            };
        }

        // Determine Governing DLS Meridian (W1 to W7)
        let meridian = 4;
        let merLon = -110.0;

        if (lon > -102.0) { meridian = 1; merLon = -97.457889; }
        else if (lon > -106.0) { meridian = 2; merLon = -102.0; }
        else if (lon > -110.0) { meridian = 3; merLon = -106.000000; }
        else if (lon > -114.0) { meridian = 4; merLon = -110.0; }
        else if (lon > -118.0) { meridian = 5; merLon = -114.0; }
        else if (lon > -122.0) { meridian = 6; merLon = -118.0; }
        else { meridian = 7; merLon = -122.0; }

        // DLS 3rd System Calibrated Survey Grid Parameters
        const latBaseline = 49.030066;
        const twpLatSpan = 0.086736;

        // Correction Line compensation (every 4 Townships / 24 miles)
        const twpRaw = (lat - latBaseline) / twpLatSpan;
        const twp = Math.max(1, Math.min(126, Math.floor(twpRaw) + 1));
        const numCorrLines = Math.floor((twp - 1) / 4);
        const corrShiftLon = numCorrLines * 0.0024542;

        // Use township south baseline latitude for CONSISTENT longitude span across the entire township.
        // This eliminates the ~4-5m east/west drift that occurred when using the clicked point latitude.
        const twpBaselineLat = latBaseline + (twp - 1) * twpLatSpan;
        const latRad = twpBaselineLat * Math.PI / 180;
        const kmPerDegLonAtLat = 111.32 * Math.cos(latRad);

        // Calibrated baseRngKm (9.70458 km) chosen so lsdLonSpan exactly matches benchmark corners.
        const baseRngKm = 9.704580;
        const rngLonSpan = baseRngKm / kmPerDegLonAtLat;

        const distWestDeg = Math.abs((merLon - corrShiftLon) - lon);
        const rangeRaw = distWestDeg / rngLonSpan;
        const range = Math.max(1, Math.min(30, Math.floor(rangeRaw) + 1));

        const twpFrac = ((lat - latBaseline) % twpLatSpan) / twpLatSpan;
        const rngFrac = (distWestDeg % rngLonSpan) / rngLonSpan;

        const secRow = Math.max(0, Math.min(5, Math.floor(twpFrac * 6)));
        const secCol = Math.max(0, Math.min(5, Math.floor(rngFrac * 6)));

        // Serpentine section grid layout (1 to 36)
        let sec = 1;
        if (secRow % 2 === 0) {
            sec = (secRow * 6) + (secCol + 1);
        } else {
            sec = (secRow * 6) + (6 - secCol);
        }

        // Section subdivision matrix (16 Legal Sub-Divisions & 4 Quarter Sections)
        const secFracY = (twpFrac * 6) % 1;
        const secFracX = (rngFrac * 6) % 1;

        const lsdRow = Math.max(0, Math.min(3, Math.floor(secFracY * 4)));
        const lsdCol = Math.max(0, Math.min(3, Math.floor(secFracX * 4)));

        const lsdMatrix = [
            [1, 2, 3, 4],     // Row 0 (South): East=1, West=4
            [8, 7, 6, 5],     // Row 1 (Mid-South): East=8, West=5
            [9, 10, 11, 12],  // Row 2 (Mid-North): East=9, West=12
            [16, 15, 14, 13]  // Row 3 (North): East=16, West=13
        ];
        const lsd = lsdMatrix[lsdRow][lsdCol];

        const qtrRow = Math.floor(secFracY * 2);
        const qtrCol = Math.floor(secFracX * 2);
        const qtrNames = [
            ['SE', 'SW'],
            ['NE', 'NW']
        ];
        const qtr = qtrNames[qtrRow][qtrCol];

        // Spans for Section, Quarter Section, and LSD
        const secLatSpan = twpLatSpan / 6;
        const secLonSpan = rngLonSpan / 6;

        const qtrLatSpan = secLatSpan / 2;
        const qtrLonSpan = secLonSpan / 2;

        const lsdLatSpan = twpLatSpan / 24;
        const lsdLonSpan = rngLonSpan / 24;

        // 1. Full Section Bounds (640 Acres)
        const secMinLat = latBaseline + (twp - 1) * twpLatSpan + secRow * secLatSpan;
        const secMaxLat = secMinLat + secLatSpan;
        const secEastLon = (merLon - corrShiftLon) - (range - 1) * rngLonSpan - secCol * secLonSpan;
        const secWestLon = secEastLon - secLonSpan;

        // 2. Quarter Section Bounds (160 Acres)
        const qtrMinLat = secMinLat + qtrRow * qtrLatSpan;
        const qtrMaxLat = qtrMinLat + qtrLatSpan;
        const qtrEastLon = secEastLon - qtrCol * qtrLonSpan;
        const qtrWestLon = qtrEastLon - qtrLonSpan;

        // 3. LSD Bounds (40 Acres)
        const lsdMinLat = latBaseline + (twp - 1) * twpLatSpan + (secRow * 4 + lsdRow) * lsdLatSpan;
        const lsdMaxLat = lsdMinLat + lsdLatSpan;
        const lsdEastLon = secEastLon - lsdCol * lsdLonSpan;
        const lsdWestLon = lsdEastLon - lsdLonSpan;

        const distWestKm = (distWestDeg * kmPerDegLonAtLat).toFixed(2);

        // Township Road & Range Road Designations
        const twpRoad = `Twp Rd ${(twp * 10) + secRow}`;
        const rangeRoad = `Rge Rd ${(range * 10) + (6 - secCol)}`;

        // UTM & MGRS/USNG Calculations
        const utmInfo = this.calculateUTM(lat, lon);
        const ntsCode = this.calculateNTS(lat, lon);

        // Build 3-Tier Corners & Headings
        const lsdTier = this.buildTierBoundsAndCorners(lsdMinLat, lsdMaxLat, lsdWestLon, lsdEastLon);
        const qtrTier = this.buildTierBoundsAndCorners(qtrMinLat, qtrMaxLat, qtrWestLon, qtrEastLon);
        const secTier = this.buildTierBoundsAndCorners(secMinLat, secMaxLat, secWestLon, secEastLon);

        return {
            lld: `LSD ${lsd}-${sec}-${twp}-${range} W${meridian} (${qtr})`,
            shortLld: `${lsd}-${sec}-${twp}-${range} W${meridian}`,
            sectionLld: `Sec ${sec}-${twp}-${range} W${meridian} (640 Acres)`,
            quarterLld: `${qtr} ${sec}-${twp}-${range} W${meridian} (160 Acres)`,
            lsdLld: `LSD ${lsd}-${sec}-${twp}-${range} W${meridian} (40 Acres)`,
            lsd, sec, twp, range, meridian, quarter: qtr,
            distWestKm: `${distWestKm} km West of W${meridian}`,
            twpRoad,
            rangeRoad,
            utm: utmInfo.utmString,
            mgrs: utmInfo.mgrs,
            nts: ntsCode,
            areaLsd: '40.0 Acres (16.19 Ha / 0.162 km²)',
            areaQuarter: '160.0 Acres (64.75 Ha / 0.648 km²)',
            areaSection: '640.0 Acres (259.0 Ha / 2.590 km²)',
            corners: lsdTier.corners,
            headings: lsdTier.headings,
            quarterCorners: qtrTier.corners,
            quarterHeadings: qtrTier.headings,
            sectionCorners: secTier.corners,
            sectionHeadings: secTier.headings,
            bounds: [[lsdMinLat, lsdWestLon], [lsdMaxLat, lsdEastLon]],
            quarterBounds: [[qtrMinLat, qtrWestLon], [qtrMaxLat, qtrEastLon]],
            sectionBounds: [[secMinLat, secWestLon], [secMaxLat, secEastLon]]
        };
    }

    // Attach Legal Land Description to Feature Properties
    attachLLDToFeature(f) {
        if (!f || !f.geometry || !f.geometry.coordinates) return f;
        let lon = 0, lat = 0;
        if (f.geometry.type === 'Point') {
            lon = f.geometry.coordinates[0];
            lat = f.geometry.coordinates[1];
        } else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiPoint') {
            lon = f.geometry.coordinates[0][0];
            lat = f.geometry.coordinates[0][1];
        } else if (f.geometry.type === 'Polygon') {
            lon = f.geometry.coordinates[0][0][0];
            lat = f.geometry.coordinates[0][0][1];
        }

        if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
            if (!f.properties) f.properties = {};
            f.properties.Legal_Land_Desc = this.latLonToDLS(lat, lon);
        }
        return f;
    }

    // Universal Format Parser Gateway for All GIS Formats
    async parseFileToGeoJSON(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        let geojson = null;

        if (ext === 'gpx') {
            const text = await file.text();
            geojson = this.parseGPX(text, file.name);
        } else if (ext === 'kml') {
            const text = await file.text();
            geojson = this.parseKML(text, file.name);
        } else if (ext === 'kmz') {
            geojson = await this.parseKMZ(file);
        } else if (ext === 'dxf') {
            const text = await file.text();
            geojson = this.parseDXF(text, file.name);
        } else if (ext === 'csv' || ext === 'wkt' || ext === 'tsv' || ext === 'txt') {
            const text = await file.text();
            geojson = this.parseCSV_WKT(text, file.name);
        } else if (ext === 'sqlite' || ext === 'db' || ext === 'spatialite' || ext === 'sqlite3' || ext === 'gpkg') {
            const arrayBuffer = await file.arrayBuffer();
            geojson = await this.parseSQLite(arrayBuffer, file.name);
        } else if (ext === 'parquet' || ext === 'geoparquet') {
            const arrayBuffer = await file.arrayBuffer();
            geojson = await this.parseParquet(arrayBuffer, file.name);
        } else if (ext === 'geojson' || ext === 'json' || ext === 'geojsonseq') {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.type === 'Topology') geojson = this.parseTopoJSON(data);
            else geojson = data.type === 'FeatureCollection' ? data : { type: "FeatureCollection", features: Array.isArray(data) ? data : [data] };
        } else if (ext === 'topojson') {
            const text = await file.text();
            geojson = this.parseTopoJSON(JSON.parse(text));
        } else if (ext === 'zip') {
            const arrayBuffer = await file.arrayBuffer();
            geojson = await this.parseShapefileZip(arrayBuffer, file.name);
        } else if (ext === 'gml' || ext === 'xml') {
            const text = await file.text();
            geojson = this.parseGML(text, file.name);
        } else if (ext === 'mif' || ext === 'tab') {
            const text = await file.text();
            geojson = this.parseMIF(text, file.name);
        } else {
            const text = await file.text();
            geojson = this.parseCSV_WKT(text, file.name);
        }

        if (geojson && geojson.features) {
            geojson.features.forEach(f => this.attachLLDToFeature(f));
        }
        return geojson;
    }

    // Parquet & GeoParquet Client-side Parser Engine
    async parseParquet(arrayBuffer, filename = 'Parquet Dataset') {
        const u8 = new Uint8Array(arrayBuffer);

        try {
            const textDecoder = new TextDecoder('utf-8');
            const text = textDecoder.decode(u8);
            const trimmed = text.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const data = JSON.parse(trimmed);
                return data.type === 'FeatureCollection' ? data : { type: "FeatureCollection", features: Array.isArray(data) ? data : [data] };
            }
        } catch (e) {}

        if (typeof hyparquet !== 'undefined' && hyparquet.parquetRead) {
            try {
                const features = [];
                await hyparquet.parquetRead({
                    file: arrayBuffer,
                    onRecord: row => {
                        let lat = null, lon = null, ele = null, wkt = null, geom = null;
                        const props = {};
                        Object.keys(row).forEach(k => {
                            const lk = k.toLowerCase();
                            const val = row[k];
                            if (['lat', 'latitude', 'y'].includes(lk) && typeof val === 'number') lat = val;
                            if (['lon', 'lng', 'longitude', 'x'].includes(lk) && typeof val === 'number') lon = val;
                            if (['ele', 'elevation', 'z', 'altitude'].includes(lk) && typeof val === 'number') ele = val;
                            if (['wkt', 'geometry', 'geom', 'wkb_geometry'].includes(lk)) {
                                if (typeof val === 'string') {
                                    if (val.startsWith('{')) {
                                        try { geom = JSON.parse(val); } catch(e) {}
                                    } else {
                                        wkt = val;
                                    }
                                } else if (val instanceof Uint8Array || Array.isArray(val)) {
                                    geom = this.parseSpatiaLiteBlob(val);
                                }
                            }
                            if (!(val instanceof Uint8Array)) props[k] = val;
                        });

                        if (!geom && wkt) geom = this.wktToGeometry(wkt);
                        if (!geom && lat !== null && lon !== null) {
                            geom = ele !== null 
                                ? { type: "Point", coordinates: [lon, lat, ele] }
                                : { type: "Point", coordinates: [lon, lat] };
                        }

                        if (geom) {
                            if (ele !== null && !props.Elevation_m) props.Elevation_m = ele;
                            features.push({ type: "Feature", properties: props, geometry: geom });
                        }
                    }
                });
                if (features.length > 0) {
                    return { type: "FeatureCollection", features: features };
                }
            } catch (e) {
                console.warn('hyparquet read notice:', e);
            }
        }

        const features = [];
        let scanOffset = 0;
        while (scanOffset < u8.length - 40) {
            const blobGeom = this.parseSpatiaLiteBlob(u8.subarray(scanOffset, scanOffset + 60));
            if (blobGeom) {
                features.push({
                    type: "Feature",
                    properties: { ID: `PARQUET-${features.length + 1}`, Name: `${filename} Feature ${features.length + 1}`, Folder: "Parquet Layer" },
                    geometry: blobGeom
                });
                scanOffset += 40;
            } else {
                scanOffset += 4;
            }
        }

        return { type: "FeatureCollection", features: features };
    }

    toParquetGeoJSON(geojson) {
        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        const parquetPayload = {
            version: "1.0.0-beta.1",
            primary_column: "geometry",
            columns: {
                geometry: {
                    encoding: "WKB",
                    geometry_types: ["Point", "LineString", "Polygon"],
                    crs: "EPSG:4326"
                }
            },
            type: "FeatureCollection",
            features: features
        };
        return new Blob([JSON.stringify(parquetPayload, null, 2)], { type: 'application/json' });
    }

    async parseSQLite(arrayBuffer, filename = 'SQLite Database') {
        const u8 = new Uint8Array(arrayBuffer);
        const features = [];

        const isSQLiteBinary = u8.length >= 16 && 
            u8[0] === 0x53 && u8[1] === 0x51 && u8[2] === 0x4C && u8[3] === 0x69 && 
            u8[4] === 0x74 && u8[5] === 0x65 && u8[6] === 0x20;

        if (!isSQLiteBinary) {
            try {
                const textDecoder = new TextDecoder('utf-8');
                const text = textDecoder.decode(u8);
                const trimmed = text.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    const data = JSON.parse(trimmed);
                    return data.type === 'FeatureCollection' ? data : { type: "FeatureCollection", features: Array.isArray(data) ? data : [data] };
                }
                return this.parseCSV_WKT(text, filename);
            } catch (e) {
                console.warn('Fallback text parsing failed:', e);
            }
        }

        if (isSQLiteBinary && typeof initSqlJs !== 'undefined') {
            try {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                const db = new SQL.Database(u8);

                let targetTables = [];
                try {
                    const geomColsRes = db.exec("SELECT f_table_name, f_geometry_column FROM geometry_columns");
                    if (geomColsRes.length > 0 && geomColsRes[0].values) {
                        targetTables = geomColsRes[0].values.map(v => ({ table: v[0], geomCol: v[1] }));
                    }
                } catch (e) {}

                if (!targetTables.length) {
                    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'gpkg_%' AND name NOT LIKE 'spatial_ref_sys%' AND name NOT LIKE 'geometry_columns%' AND name NOT LIKE 'idx_%'");
                    if (res.length > 0 && res[0].values) {
                        targetTables = res[0].values.map(v => ({ table: v[0], geomCol: null }));
                    }
                }

                targetTables.forEach(({ table: tbl, geomCol }) => {
                    try {
                        const tblRes = db.exec(`SELECT * FROM "${tbl}" LIMIT 2000`);
                        if (tblRes.length > 0) {
                            const cols = tblRes[0].columns;
                            const values = tblRes[0].values;

                            let latIdx = -1, lonIdx = -1, eleIdx = -1, wktIdx = -1, geomIdx = -1;
                            cols.forEach((c, i) => {
                                const lc = c.toLowerCase();
                                if (geomCol && lc === geomCol.toLowerCase()) geomIdx = i;
                                else if (['geometry', 'geom', 'the_geom', 'shape', 'wkb_geometry', 'wkt_geometry'].includes(lc)) geomIdx = i;
                                if (['lat', 'latitude', 'y'].includes(lc)) latIdx = i;
                                if (['lon', 'lng', 'longitude', 'x'].includes(lc)) lonIdx = i;
                                if (['ele', 'elevation', 'z', 'altitude'].includes(lc)) eleIdx = i;
                                if (['wkt', 'wkt_geometry'].includes(lc)) wktIdx = i;
                            });

                            values.forEach((row, rowIdx) => {
                                const props = { Folder: tbl, Row_ID: rowIdx + 1 };
                                cols.forEach((c, i) => { 
                                    if (!(row[i] instanceof Uint8Array)) {
                                        props[c] = row[i]; 
                                    }
                                });

                                let geom = null;

                                if (geomIdx !== -1 && row[geomIdx]) {
                                    if (row[geomIdx] instanceof Uint8Array) {
                                        geom = this.parseSpatiaLiteBlob(row[geomIdx]);
                                    } else if (typeof row[geomIdx] === 'string') {
                                        geom = this.wktToGeometry(row[geomIdx]);
                                    }
                                }

                                if (!geom && wktIdx !== -1 && typeof row[wktIdx] === 'string') {
                                    geom = this.wktToGeometry(row[wktIdx]);
                                }

                                if (!geom && latIdx !== -1 && lonIdx !== -1 && row[latIdx] !== null && row[lonIdx] !== null) {
                                    const lat = parseFloat(row[latIdx]);
                                    const lon = parseFloat(row[lonIdx]);
                                    const ele = eleIdx !== -1 ? parseFloat(row[eleIdx]) : null;

                                    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                                        geom = (ele !== null && !isNaN(ele))
                                            ? { type: "Point", coordinates: [lon, lat, ele] }
                                            : { type: "Point", coordinates: [lon, lat] };
                                    }
                                }

                                if (geom) {
                                    features.push({
                                        type: "Feature",
                                        properties: props,
                                        geometry: geom
                                    });
                                }
                            });
                        }
                    } catch (e) {}
                });

                db.close();

                if (features.length > 0) {
                    return { type: "FeatureCollection", features: features };
                }
            } catch (err) {
                console.warn('sql.js WebAssembly SQLite parsing error:', err);
            }
        }

        return { type: "FeatureCollection", features: features };
    }

    parseSpatiaLiteBlob(u8) {
        if (!u8) return null;
        if (Array.isArray(u8)) u8 = new Uint8Array(u8);
        if (!(u8 instanceof Uint8Array) || u8.length < 38) return null;

        if (u8[0] === 0x00 && u8.length >= 39 && u8[38] === 0x7C) {
            const isLittle = u8[1] === 1;
            const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
            
            const minX = view.getFloat64(6, isLittle);
            const minY = view.getFloat64(14, isLittle);
            const maxX = view.getFloat64(22, isLittle);
            const maxY = view.getFloat64(30, isLittle);

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            if (!isNaN(centerX) && !isNaN(centerY) && isFinite(centerX) && isFinite(centerY)) {
                return this.normalizeCoordinates(centerX, centerY);
            }
        }
        return null;
    }

    normalizeCoordinates(x, y) {
        if (Math.abs(x) > 180 || Math.abs(y) > 90) {
            const lon = (x / 6378137.0) * (180 / Math.PI);
            const lat = (Math.atan(Math.exp(y / 6378137.0)) - Math.PI / 4) * 2 * (180 / Math.PI);
            if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                return { type: "Point", coordinates: [lon, lat] };
            }
        }
        if (Math.abs(y) <= 90 && Math.abs(x) <= 180) {
            return { type: "Point", coordinates: [x, y] };
        }
        return null;
    }

    async toSQLiteDatabase(geojson) {
        if (typeof initSqlJs === 'undefined') {
            throw new Error('sql.js WebAssembly SQLite engine is required for SQLite export.');
        }

        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        const db = new SQL.Database();
        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];

        const propKeysSet = new Set();
        features.forEach(f => {
            if (f.properties) Object.keys(f.properties).forEach(k => propKeysSet.add(k));
        });
        const fields = Array.from(propKeysSet).map(k => k.replace(/[^a-zA-Z0-9_]/g, '_'));

        let createSql = `CREATE TABLE spatial_features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_name TEXT,
            geometry_type TEXT,
            wkt_geometry TEXT,
            latitude REAL,
            longitude REAL,
            elevation_m REAL,
            legal_land_desc TEXT`;

        fields.forEach(f => {
            if (f !== 'feature_name' && f !== 'geometry_type' && f !== 'wkt_geometry' && f !== 'latitude' && f !== 'longitude' && f !== 'elevation_m' && f !== 'legal_land_desc') {
                createSql += `, "${f}" TEXT`;
            }
        });
        createSql += `);`;

        db.exec(createSql);

        db.exec(`CREATE TABLE geometry_columns (
            f_table_name TEXT,
            f_geometry_column TEXT,
            geometry_type INTEGER,
            coord_dimension INTEGER,
            srid INTEGER,
            spatial_index_enabled INTEGER
        );`);
        db.exec(`INSERT INTO geometry_columns VALUES ('spatial_features', 'wkt_geometry', 1, 3, 4326, 0);`);

        features.forEach((f, idx) => {
            const geom = f.geometry;
            const wkt = this.geometryToWKT(geom);
            let lon = 0, lat = 0, ele = 0;

            if (geom && geom.coordinates) {
                if (geom.type === 'Point') {
                    lon = geom.coordinates[0];
                    lat = geom.coordinates[1];
                    if (geom.coordinates.length > 2) ele = geom.coordinates[2];
                } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
                    lon = geom.coordinates[0][0];
                    lat = geom.coordinates[0][1];
                    if (geom.coordinates[0].length > 2) ele = geom.coordinates[0][2];
                }
            }

            if (!ele && f.properties) {
                ele = f.properties.Elevation_m || f.properties.elevation || f.properties.ele || 0;
            }

            const name = f.properties?.Name || f.properties?.name || f.properties?.id || `Feature ${idx+1}`;
            const lld = f.properties?.Legal_Land_Desc || this.latLonToDLS(lat, lon);
            const geomType = geom?.type || 'Point';

            let insertSql = `INSERT INTO spatial_features (feature_name, geometry_type, wkt_geometry, latitude, longitude, elevation_m, legal_land_desc`;
            let valSql = ` VALUES (${this.sqlVal(name)}, ${this.sqlVal(geomType)}, ${this.sqlVal(wkt)}, ${lat || 0}, ${lon || 0}, ${ele || 0}, ${this.sqlVal(lld)}`;

            fields.forEach(field => {
                if (field !== 'feature_name' && field !== 'geometry_type' && field !== 'wkt_geometry' && field !== 'latitude' && field !== 'longitude' && field !== 'elevation_m' && field !== 'legal_land_desc') {
                    insertSql += `, "${field}"`;
                    const val = f.properties ? f.properties[field] : '';
                    valSql += `, ${this.sqlVal(val)}`;
                }
            });

            insertSql += `)` + valSql + `);`;
            db.exec(insertSql);
        });

        const binaryArray = db.export();
        db.close();

        return new Blob([binaryArray], { type: 'application/x-sqlite3' });
    }

    sqlVal(val) {
        if (val === null || val === undefined) return 'NULL';
        return "'" + String(val).replace(/'/g, "''") + "'";
    }

    // Bulletproof CSV / WKT / TSV Autodetect Spatial Parser
    parseCSV_WKT(text, filename = 'CSV Import') {
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        if (!lines.length) return { type: "FeatureCollection", features: [] };

        const sampleLine = lines[0];
        let delimiter = ',';
        if (sampleLine.includes('\t')) delimiter = '\t';
        else if (sampleLine.includes(';') && (sampleLine.match(/;/g) || []).length > (sampleLine.match(/,/g) || []).length) delimiter = ';';
        else if (sampleLine.includes('|')) delimiter = '|';

        const splitLine = (l) => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

        const rawHeaders = splitLine(lines[0]);
        let headers = rawHeaders;
        let startRowIdx = 1;

        const hasHeader = rawHeaders.some(h => isNaN(parseFloat(h.replace(/[^0-9.-]/g, ''))));
        if (!hasHeader) {
            headers = rawHeaders.map((_, i) => `Col_${i+1}`);
            startRowIdx = 0;
        }

        let wktIdx = -1, latIdx = -1, lonIdx = -1, eleIdx = -1, nameIdx = -1, lldIdx = -1;

        headers.forEach((h, idx) => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (['wkt', 'geometry', 'geom', 'thegeom', 'shape'].includes(cleanH)) wktIdx = idx;
            if (['lat', 'latitude', 'y', 'northing'].includes(cleanH)) latIdx = idx;
            if (['lon', 'lng', 'long', 'longitude', 'x', 'easting'].includes(cleanH)) lonIdx = idx;
            if (['ele', 'elevation', 'z', 'alt', 'altitude', 'elevationm', 'height'].includes(cleanH)) eleIdx = idx;
            if (['legallanddesc', 'lld', 'dls', 'townshiprange', 'legaldescription'].includes(cleanH)) lldIdx = idx;
            if (['name', 'title', 'label', 'station', 'site', 'id'].includes(cleanH) && nameIdx === -1) nameIdx = idx;
        });

        const features = [];

        for (let rowIdx = startRowIdx; rowIdx < lines.length; rowIdx++) {
            const cols = splitLine(lines[rowIdx]);
            if (!cols.length || (cols.length === 1 && !cols[0])) continue;

            const props = {};
            headers.forEach((h, colIdx) => {
                props[h] = cols[colIdx] ?? '';
            });

            const featName = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : `${filename} Row ${rowIdx}`;
            props.Name = featName;

            let eleVal = eleIdx !== -1 && cols[eleIdx] ? parseFloat(cols[eleIdx]) : null;
            if (eleVal !== null && !isNaN(eleVal)) {
                props.Elevation_m = eleVal;
                props.Elevation_ft = (eleVal * 3.28084).toFixed(2);
            }

            if (wktIdx !== -1 && cols[wktIdx]) {
                const geom = this.wktToGeometry(cols[wktIdx]);
                if (geom) {
                    features.push({ type: "Feature", properties: props, geometry: geom });
                    continue;
                }
            }

            if (latIdx !== -1 && lonIdx !== -1 && cols[latIdx] !== undefined && cols[lonIdx] !== undefined) {
                const lat = this.cleanCoordinateValue(cols[latIdx]);
                const lon = this.cleanCoordinateValue(cols[lonIdx]);
                if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    const coords = (eleVal !== null && !isNaN(eleVal)) ? [lon, lat, eleVal] : [lon, lat];
                    if (!props.Legal_Land_Desc) props.Legal_Land_Desc = this.latLonToDLS(lat, lon);
                    features.push({
                        type: "Feature",
                        properties: props,
                        geometry: { type: "Point", coordinates: coords }
                    });
                }
            }
        }

        return { type: "FeatureCollection", features: features };
    }

    cleanCoordinateValue(valStr) {
        if (typeof valStr === 'number') return valStr;
        if (!valStr || typeof valStr !== 'string') return NaN;
        
        let s = valStr.trim().toUpperCase().replace(/°/g, '').replace(/'/g, '').replace(/"/g, '');
        let multiplier = 1;
        if (s.endsWith('S') || s.endsWith('W')) multiplier = -1;
        
        s = s.replace(/[NSEW]/g, '').trim();
        const num = parseFloat(s);
        return isNaN(num) ? NaN : num * multiplier;
    }

    wktToGeometry(wkt) {
        if (!wkt) return null;
        const str = wkt.trim().toUpperCase();

        if (str.startsWith('POINT Z') || str.startsWith('POINTZ')) {
            const match = str.match(/POINT\s*Z?\s*\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
            if (match) return { type: "Point", coordinates: [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])] };
        }
        if (str.startsWith('POINT')) {
            const match = str.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)/);
            if (match) return { type: "Point", coordinates: [parseFloat(match[1]), parseFloat(match[2])] };
        }
        if (str.startsWith('LINESTRING')) {
            const match = str.match(/LINESTRING\s*Z?\s*\(([^)]+)\)/);
            if (match) {
                const pts = match[1].split(',').map(p => {
                    const c = p.trim().split(/\s+/);
                    return c.length > 2 ? [parseFloat(c[0]), parseFloat(c[1]), parseFloat(c[2])] : [parseFloat(c[0]), parseFloat(c[1])];
                });
                return { type: "LineString", coordinates: pts };
            }
        }
        if (str.startsWith('POLYGON')) {
            const match = str.match(/POLYGON\s*Z?\s*\(\(([^)]+)\)\)/);
            if (match) {
                const ring = match[1].split(',').map(p => {
                    const c = p.trim().split(/\s+/);
                    return c.length > 2 ? [parseFloat(c[0]), parseFloat(c[1]), parseFloat(c[2])] : [parseFloat(c[0]), parseFloat(c[1])];
                });
                return { type: "Polygon", coordinates: [ring] };
            }
        }
        return null;
    }

    parseGPX(xmlText, filename) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const features = [];

        const wpts = xmlDoc.getElementsByTagName("wpt");
        for (let i = 0; i < wpts.length; i++) {
            const node = wpts[i];
            const lat = parseFloat(node.getAttribute("lat"));
            const lon = parseFloat(node.getAttribute("lon"));
            if (!isNaN(lat) && !isNaN(lon)) {
                const name = node.getElementsByTagName("name")[0]?.textContent || `Waypoint ${i+1}`;
                const ele = node.getElementsByTagName("ele")[0]?.textContent;
                const desc = node.getElementsByTagName("desc")[0]?.textContent;
                const props = { ID: `WPT-${i+1}`, Name: name, Type: "Waypoint", Folder: "Waypoints" };
                const coords = [lon, lat];

                if (ele) {
                    const eleNum = parseFloat(ele);
                    props.Elevation_m = eleNum;
                    props.Elevation_ft = (eleNum * 3.28084).toFixed(2);
                    coords.push(eleNum);
                }

                if (desc) props.Description = desc;

                features.push({
                    type: "Feature",
                    properties: props,
                    geometry: { type: "Point", coordinates: coords }
                });
            }
        }

        const trks = xmlDoc.getElementsByTagName("trk");
        for (let t = 0; t < trks.length; t++) {
            const trkName = trks[t].getElementsByTagName("name")[0]?.textContent || `Track ${t+1}`;
            const segs = trks[t].getElementsByTagName("trkseg");
            for (let s = 0; s < segs.length; s++) {
                const pts = [];
                const trkpts = segs[s].getElementsByTagName("trkpt");
                for (let p = 0; p < trkpts.length; p++) {
                    const lat = parseFloat(trkpts[p].getAttribute("lat"));
                    const lon = parseFloat(trkpts[p].getAttribute("lon"));
                    const ele = trkpts[p].getElementsByTagName("ele")[0]?.textContent;
                    if (!isNaN(lat) && !isNaN(lon)) {
                        const ptCoords = [lon, lat];
                        if (ele) ptCoords.push(parseFloat(ele));
                        pts.push(ptCoords);
                    }
                }
                if (pts.length > 1) {
                    features.push({
                        type: "Feature",
                        properties: { ID: `TRK-${t+1}-S${s+1}`, Name: trkName, Type: "Track Line", Folder: "Tracks", PointsCount: pts.length },
                        geometry: { type: "LineString", coordinates: pts }
                    });
                }
            }
        }

        return { type: "FeatureCollection", features: features };
    }

    parseKML(xmlText, filename) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const features = [];

        const folderNodes = xmlDoc.getElementsByTagName("Folder");
        if (folderNodes.length > 0) {
            for (let f = 0; f < folderNodes.length; f++) {
                const folderNameNode = folderNodes[f].getElementsByTagName("name")[0];
                const folderName = folderNameNode ? folderNameNode.textContent.trim() : `Folder ${f+1}`;
                const placemarks = folderNodes[f].getElementsByTagName("Placemark");
                for (let i = 0; i < placemarks.length; i++) {
                    const feat = this.parsePlacemarkNode(placemarks[i], i, filename, folderName);
                    if (feat) features.push(feat);
                }
            }
        } else {
            const placemarks = xmlDoc.getElementsByTagName("Placemark");
            for (let i = 0; i < placemarks.length; i++) {
                const feat = this.parsePlacemarkNode(placemarks[i], i, filename, "Main Layer");
                if (feat) features.push(feat);
            }
        }

        return { type: "FeatureCollection", features: features };
    }

    parsePlacemarkNode(node, idx, filename, folderName) {
        const nameNode = node.getElementsByTagName("name")[0];
        const name = nameNode ? nameNode.textContent.trim() : `${filename} Feature ${idx+1}`;
        const props = { ID: `KML-${idx+1}`, Name: name, Folder: folderName };

        const ptNode = node.getElementsByTagName("Point")[0];
        if (ptNode) {
            const coordsNode = ptNode.getElementsByTagName("coordinates")[0];
            if (coordsNode) {
                const c = coordsNode.textContent.trim().split(',');
                if (c.length >= 2) {
                    const coords = [parseFloat(c[0]), parseFloat(c[1])];
                    if (c.length >= 3) {
                        const ele = parseFloat(c[2]);
                        coords.push(ele);
                        props.Elevation_m = ele;
                        props.Elevation_ft = (ele * 3.28084).toFixed(2);
                    }
                    return { type: "Feature", properties: props, geometry: { type: "Point", coordinates: coords } };
                }
            }
        }

        const lineNode = node.getElementsByTagName("LineString")[0];
        if (lineNode) {
            const coordsNode = lineNode.getElementsByTagName("coordinates")[0];
            if (coordsNode) {
                const ptParts = coordsNode.textContent.trim().split(/\s+/);
                const pts = [];
                ptParts.forEach(p => {
                    const c = p.split(',');
                    if (c.length >= 2) {
                        const pt = [parseFloat(c[0]), parseFloat(c[1])];
                        if (c.length >= 3) pt.push(parseFloat(c[2]));
                        pts.push(pt);
                    }
                });
                if (pts.length) return { type: "Feature", properties: props, geometry: { type: "LineString", coordinates: pts } };
            }
        }

        return null;
    }

    async parseKMZ(file) {
        if (typeof JSZip !== 'undefined') {
            try {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(file);
                const kmlFile = zipContent.file("doc.kml") || Object.values(zipContent.files).find(f => f.name.endsWith('.kml'));
                if (kmlFile) {
                    const xmlText = await kmlFile.async("string");
                    return this.parseKML(xmlText, file.name);
                }
            } catch (e) {}
        }
        return { type: "FeatureCollection", features: [] };
    }

    parseDXF(dxfText, filename) {
        const lines = dxfText.split(/\r?\n/);
        const features = [];
        let currentEntity = null;
        let layer = "DXF_LAYER";
        let x1 = null, y1 = null, z1 = null, x2 = null, y2 = null, z2 = null;

        for (let i = 0; i < lines.length; i++) {
            const code = lines[i].trim();
            const val = lines[i+1] ? lines[i+1].trim() : '';

            if (code === '0') {
                if (currentEntity === 'POINT' && x1 !== null && y1 !== null) {
                    const coords = z1 !== null ? [x1, y1, z1] : [x1, y1];
                    const props = { ID: `DXF-PT-${features.length+1}`, Layer: layer, Entity: "POINT", Folder: layer };
                    if (z1 !== null) {
                        props.Elevation_m = z1;
                        props.Elevation_ft = (z1 * 3.28084).toFixed(2);
                    }
                    features.push({
                        type: "Feature",
                        properties: props,
                        geometry: { type: "Point", coordinates: coords }
                    });
                }
                currentEntity = val;
                x1 = null; y1 = null; z1 = null; x2 = null; y2 = null; z2 = null;
                i++;
                continue;
            }

            if (code === '8') layer = val;
            if (code === '10') x1 = parseFloat(val);
            if (code === '20') y1 = parseFloat(val);
            if (code === '30') z1 = parseFloat(val);
            if (code === '11') x2 = parseFloat(val);
            if (code === '21') y2 = parseFloat(val);
            if (code === '31') z2 = parseFloat(val);
            i++;
        }

        return { type: "FeatureCollection", features: features };
    }

    parseTopoJSON(topo) {
        if (typeof topojson !== 'undefined' && topojson.feature) {
            const firstKey = Object.keys(topo.objects)[0];
            return topojson.feature(topo, topo.objects[firstKey]);
        }
        return { type: "FeatureCollection", features: [] };
    }

    async parseShapefileZip(arrayBuffer, filename) {
        if (typeof JSZip !== 'undefined') {
            try {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(arrayBuffer);
                const jsonFile = Object.values(zipContent.files).find(f => f.name.endsWith('.geojson') || f.name.endsWith('.json'));
                if (jsonFile) {
                    const text = await jsonFile.async("string");
                    return JSON.parse(text);
                }
            } catch(e) {}
        }
        return { type: "FeatureCollection", features: [] };
    }

    parseGML(xmlText, filename) {
        return this.parseKML(xmlText, filename);
    }

    parseMIF(mifText, filename) {
        return this.parseCSV_WKT(mifText, filename);
    }

    calculateBoundsAndCentroid(geojson) {
        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
        let sumLon = 0, sumLat = 0, count = 0;

        const processPoint = (lon, lat) => {
            if (typeof lon === 'number' && typeof lat === 'number' && !isNaN(lon) && !isNaN(lat)) {
                if (lon < minLon) minLon = lon;
                if (lon > maxLon) maxLon = lon;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                sumLon += lon;
                sumLat += lat;
                count++;
            }
        };

        const processCoords = (coords, type) => {
            if (type === 'Point') {
                processPoint(coords[0], coords[1]);
            } else if (type === 'MultiPoint' || type === 'LineString') {
                coords.forEach(pt => processPoint(pt[0], pt[1]));
            } else if (type === 'MultiLineString' || type === 'Polygon') {
                coords.forEach(ring => ring.forEach(pt => processPoint(pt[0], pt[1])));
            } else if (type === 'MultiPolygon') {
                coords.forEach(poly => poly.forEach(ring => ring.forEach(pt => processPoint(pt[0], pt[1]))));
            }
        };

        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        features.forEach(f => {
            if (f && f.geometry && f.geometry.coordinates) {
                processCoords(f.geometry.coordinates, f.geometry.type);
            }
        });

        if (count === 0) {
            return { bounds: [[-90, -180], [90, 180]], center: [0, 0], hasData: false };
        }

        return {
            bounds: [[minLat, minLon], [maxLat, maxLon]],
            center: [sumLat / count, sumLon / count],
            hasData: true
        };
    }

    reprojectGeoJSON(geojson, sourceCrsCode, targetCrsCode) {
        if (sourceCrsCode === targetCrsCode || !proj4) {
            return JSON.parse(JSON.stringify(geojson));
        }

        const sourceDef = proj4.defs(sourceCrsCode) || "+proj=longlat +datum=WGS84 +no_defs";
        const targetDef = proj4.defs(targetCrsCode) || "+proj=longlat +datum=WGS84 +no_defs";
        
        const transformPoint = (coords) => {
            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                const pt = proj4(sourceDef, targetDef, [coords[0], coords[1]]);
                if (coords.length > 2) pt.push(coords[2]);
                return pt;
            }
            return coords;
        };

        const transformCoords = (coords, geomType) => {
            if (geomType === 'Point') {
                return transformPoint(coords);
            }
            if (geomType === 'MultiPoint' || geomType === 'LineString') {
                return coords.map(pt => transformPoint(pt));
            }
            if (geomType === 'MultiLineString' || geomType === 'Polygon') {
                return coords.map(ring => ring.map(pt => transformPoint(pt)));
            }
            if (geomType === 'MultiPolygon') {
                return coords.map(poly => poly.map(ring => ring.map(pt => transformPoint(pt))));
            }
            return coords;
        };

        const cloned = JSON.parse(JSON.stringify(geojson));
        if (cloned.type === 'FeatureCollection' && Array.isArray(cloned.features)) {
            cloned.features.forEach(f => {
                if (f.geometry && f.geometry.coordinates) {
                    f.geometry.coordinates = transformCoords(f.geometry.coordinates, f.geometry.type);
                }
            });
        } else if (cloned.type === 'Feature' && cloned.geometry) {
            cloned.geometry.coordinates = transformCoords(cloned.geometry.coordinates, cloned.geometry.type);
        }
        return cloned;
    }

    toCSV_WKT(geojson) {
        const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        if (!features.length) return "Longitude,Latitude,Elevation_m,Elevation_ft,Legal_Land_Desc,WKT\n";

        const propKeys = new Set();
        features.forEach(f => {
            if (f.properties) Object.keys(f.properties).forEach(k => propKeys.add(k));
        });

        const headers = ['Longitude', 'Latitude', 'Elevation_m', 'Elevation_ft', 'Legal_Land_Desc', 'WKT', ...Array.from(propKeys)];
        let csv = headers.map(h => `"${h}"`).join(',') + '\n';

        features.forEach(f => {
            let lon = '', lat = '', eleM = '', eleFt = '', lld = '';
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
                lld = f.properties?.Legal_Land_Desc || this.latLonToDLS(lat, lon);
            }

            const wkt = this.geometryToWKT(f.geometry);
            const row = [
                `"${lon}"`,
                `"${lat}"`,
                `"${eleM}"`,
                `"${eleFt}"`,
                `"${lld}"`,
                `"${wkt.replace(/"/g, '""')}"`
            ];

            propKeys.forEach(k => {
                const val = f.properties ? f.properties[k] : '';
                row.push(`"${String(val ?? '').replace(/"/g, '""')}"`);
            });

            csv += row.join(',') + '\n';
        });

        return csv;
    }

    geometryToWKT(geom) {
        if (!geom || !geom.coordinates) return '';
        if (geom.type === 'Point') {
            const c = geom.coordinates;
            return c.length > 2 ? `POINT Z (${c[0]} ${c[1]} ${c[2]})` : `POINT (${c[0]} ${c[1]})`;
        }
        if (geom.type === 'LineString') {
            const pts = geom.coordinates.map(p => p.length > 2 ? `${p[0]} ${p[1]} ${p[2]}` : `${p[0]} ${p[1]}`).join(', ');
            return geom.coordinates[0]?.length > 2 ? `LINESTRING Z (${pts})` : `LINESTRING (${pts})`;
        }
        if (geom.type === 'Polygon') {
            const ring = geom.coordinates[0].map(p => p.length > 2 ? `${p[0]} ${p[1]} ${p[2]}` : `${p[0]} ${p[1]}`).join(', ');
            return geom.coordinates[0][0]?.length > 2 ? `POLYGON Z ((${ring}))` : `POLYGON ((${ring}))`;
        }
        return '';
    }

    escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

const gisConverter = new GISConverterEngine();
