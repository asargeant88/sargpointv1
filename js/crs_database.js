// Sargpoint GIS Projection & CRS Database (EPSG Definitions & Proj4 Strings)

const CRS_DATABASE = [
    { code: "EPSG:4326", name: "WGS 84 (Geographic Lat/Lon)", category: "Global", proj4: "+proj=longlat +datum=WGS84 +no_defs" },
    { code: "EPSG:3857", name: "WGS 84 / Pseudo-Mercator (Web Mercator)", category: "Global", proj4: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs" },
    
    // ETRS89 & Europe
    { code: "EPSG:4258", name: "ETRS89", category: "Europe", proj4: "+proj=longlat +ellps=GRS80 +no_defs" },
    { code: "EPSG:3035", name: "ETRS89 / LAEA Europe", category: "Europe", proj4: "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:3067", name: "ETRS89 / TM35FIN(E,N)", category: "Europe", proj4: "+proj=utm +zone=35 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:3763", name: "ETRS89 / Portugal TM06", category: "Europe", proj4: "+proj=tmerc +lat_0=39.66825833333333 +lon_0=-8.133108333333334 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25828", name: "ETRS89 / UTM zone 28N", category: "Europe", proj4: "+proj=utm +zone=28 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25829", name: "ETRS89 / UTM zone 29N", category: "Europe", proj4: "+proj=utm +zone=29 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25830", name: "ETRS89 / UTM zone 30N", category: "Europe", proj4: "+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25831", name: "ETRS89 / UTM zone 31N", category: "Europe", proj4: "+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25832", name: "ETRS89 / UTM zone 32N", category: "Europe", proj4: "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25833", name: "ETRS89 / UTM zone 33N", category: "Europe", proj4: "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25834", name: "ETRS89 / UTM zone 34N", category: "Europe", proj4: "+proj=utm +zone=34 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25835", name: "ETRS89 / UTM zone 35N", category: "Europe", proj4: "+proj=utm +zone=35 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25836", name: "ETRS89 / UTM zone 36N", category: "Europe", proj4: "+proj=utm +zone=36 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:25837", name: "ETRS89 / UTM zone 37N", category: "Europe", proj4: "+proj=utm +zone=37 +ellps=GRS80 +units=m +no_defs" },

    // North America (NAD83 / NAD27)
    { code: "EPSG:4269", name: "NAD83", category: "North America", proj4: "+proj=longlat +datum=NAD83 +no_defs" },
    { code: "EPSG:2272", name: "NAD83 / Pennsylvania South (ftUS)", category: "North America", proj4: "+proj=lcc +lat_1=40.96666666666667 +lat_2=39.93333333333333 +lat_0=39.33333333333334 +lon_0=-77.75 +x_0=600000 +y_0=0 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs" },
    { code: "EPSG:3674", name: "NAD83(NSRS2007) / Texas South Central (ftUS)", category: "North America", proj4: "+proj=lcc +lat_1=30.28333333333333 +lat_2=28.38333333333333 +lat_0=27.83333333333333 +lon_0=-99 +x_0=600000.0000000001 +y_0=4000000 +ellps=GRS80 +to_meter=0.3048006096012192 +no_defs" },
    { code: "EPSG:4267", name: "NAD27", category: "North America", proj4: "+proj=longlat +datum=NAD27 +no_defs" },
    { code: "EPSG:26747", name: "NAD27 / California zone VII", category: "North America", proj4: "+proj=coordinate +datum=NAD27 +no_defs" },

    // Australia & New Zealand (GDA94, GDA2020, NZGD2000)
    { code: "EPSG:4283", name: "GDA94", category: "Oceania", proj4: "+proj=longlat +ellps=GRS80 +no_defs" },
    { code: "EPSG:7844", name: "GDA2020", category: "Oceania", proj4: "+proj=longlat +ellps=GRS80 +no_defs" },
    { code: "EPSG:2193", name: "NZGD2000 / New Zealand Transverse Mercator 2000", category: "Oceania", proj4: "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs" },
    
    // Country Specific Grid Systems
    { code: "EPSG:28992", name: "Amersfoort / RD New (Netherlands)", category: "National Grids", proj4: "+proj=sterea +lat_0=52.15616055555556 +lon_0=5.387638888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs" },
    { code: "EPSG:27700", name: "OSGB36 / British National Grid (UK)", category: "National Grids", proj4: "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs" },
    { code: "EPSG:26191", name: "Merchich / Nord Maroc", category: "Africa", proj4: "+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=-5.4 +k_0=0.999625769 +x_0=500000 +y_0=300000 +ellps=clark80 +units=m +no_defs" },
    { code: "EPSG:26192", name: "Merchich / Sud Maroc", category: "Africa", proj4: "+proj=lcc +lat_1=29.7 +lat_0=29.7 +lon_0=-5.4 +k_0=0.999615596 +x_0=500000 +y_0=300000 +ellps=clark80 +units=m +no_defs" },
    { code: "EPSG:5514", name: "S-JTSK / Krovak East North (Czech / Slovakia)", category: "Europe", proj4: "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28837916666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +units=m +no_defs" },
    { code: "EPSG:2039", name: "Israel 1993 / Israeli TM Grid", category: "Middle East", proj4: "+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:2100", name: "GGRS87 / Greek Grid", category: "Europe", proj4: "+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:31370", name: "BD72 / Belgian Lambert 72", category: "Europe", proj4: "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367485833333333 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +units=m +no_defs" },
    { code: "EPSG:3844", name: "Dealul Piscului 1970 / Stereo 70 (Romania)", category: "Europe", proj4: "+proj=sterea +lat_0=46 +lon_0=25 +k=0.99975 +x_0=500000 +y_0=500000 +ellps=krass +units=m +no_defs" },
    { code: "EPSG:4674", name: "SIRGAS 2000", category: "South America", proj4: "+proj=longlat +ellps=GRS80 +no_defs" },
    { code: "EPSG:31983", name: "SIRGAS 2000 / UTM zone 23S", category: "South America", proj4: "+proj=utm +zone=23 +south +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:3116", name: "MAGNA-SIRGAS / Colombia Bogota zone", category: "South America", proj4: "+proj=tmerc +lat_0=4.596200416666666 +lon_0=-74.07750791666666 +k=1 +x_0=1000000 +y_0=1000000 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:2154", name: "RGF93 / Lambert-93 (France)", category: "Europe", proj4: "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:2178", name: "ETRF2000-PL / CS92 (Poland)", category: "Europe", proj4: "+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:23700", name: "HD72 / EOV (Hungary)", category: "Europe", proj4: "+proj=somerc +lat_0=47.14439372222222 +lon_0=19.04857177777778 +alpha=90 +k=0.99993 +x_0=650000 +y_0=200000 +ellps=GRS67 +units=m +no_defs" },
    { code: "EPSG:3765", name: "HTRS96 / Croatia TM", category: "Europe", proj4: "+proj=tmerc +lat_0=0 +lon_0=16.5 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:3006", name: "SWEREF99 TM (Sweden)", category: "Europe", proj4: "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs" },
    { code: "EPSG:29182", name: "SAD69 / UTM zone 22S", category: "South America", proj4: "+proj=utm +zone=22 +south +ellps=aust_SA +units=m +no_defs" },
    { code: "EPSG:29183", name: "SAD69 / UTM zone 23S", category: "South America", proj4: "+proj=utm +zone=23 +south +ellps=aust_SA +units=m +no_defs" },
    { code: "EPSG:3003", name: "Monte Mario / Italy zone 1", category: "Europe", proj4: "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +units=m +no_defs" },
    { code: "EPSG:31467", name: "DHDN / 3-degree Gauss-Kruger zone 3 (Germany)", category: "Europe", proj4: "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +units=m +no_defs" },
    { code: "EPSG:31287", name: "MGI / Austria Lambert", category: "Europe", proj4: "+proj=lcc +lat_1=49 +lat_2=46 +lat_0=47.5 +lon_0=13.33333333333333 +x_0=400000 +y_0=400000 +ellps=bessel +units=m +no_defs" },
    { code: "EPSG:2525", name: "Pulkovo 1942 / Gauss-Kruger", category: "Europe", proj4: "+proj=tmerc +lat_0=0 +lon_0=15 +k=1 +x_0=500000 +y_0=0 +ellps=krass +units=m +no_defs" }
];

// Dynamically generate WGS84 UTM Zones 1-60 N & S
for (let z = 1; z <= 60; z++) {
    // UTM North
    const codeN = `EPSG:${32600 + z}`;
    CRS_DATABASE.push({
        code: codeN,
        name: `WGS 84 / UTM zone ${z}N`,
        category: "UTM (WGS84)",
        proj4: `+proj=utm +zone=${z} +datum=WGS84 +units=m +no_defs`
    });

    // UTM South
    const codeS = `EPSG:${32700 + z}`;
    CRS_DATABASE.push({
        code: codeS,
        name: `WGS 84 / UTM zone ${z}S`,
        category: "UTM (WGS84)",
        proj4: `+proj=utm +zone=${z} +south +datum=WGS84 +units=m +no_defs`
    });
}

// Dynamically generate GDA94 MGA Zones 41-59 & GDA2020 MGA Zones 46-59
for (let z = 41; z <= 59; z++) {
    CRS_DATABASE.push({
        code: `EPSG:${28300 + z}`,
        name: `GDA94 / MGA zone ${z}`,
        category: "Oceania",
        proj4: `+proj=utm +zone=${z} +south +ellps=GRS80 +units=m +no_defs`
    });
}
for (let z = 46; z <= 59; z++) {
    CRS_DATABASE.push({
        code: `EPSG:${7800 + z}`,
        name: `GDA2020 / MGA zone ${z}`,
        category: "Oceania",
        proj4: `+proj=utm +zone=${z} +south +ellps=GRS80 +units=m +no_defs`
    });
}
