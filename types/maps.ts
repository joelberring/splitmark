/**
 * Map file format types for OCAD and OpenOrienteering Mapper
 */

// ============= OCAD Types =============

export interface OCADMap {
    version: number;
    scale: number;
    georeferencing?: OCADGeoreferencing;
    symbols: OCADSymbol[];
    objects: OCADObject[];
}

export interface OCADGeoreferencing {
    epsgCode?: number; // E.g., 3006 for SWEREF 99 TM
    projectionName?: string;
    gridNorth?: number; // Degrees
    realWorldOffset?: {
        x: number;
        y: number;
    };
    convergence?: number;
    declination?: number;
}

export interface OCADSymbol {
    number: number;
    name: string;
    type: OCADSymbolType;
    color?: string;
}

export type OCADSymbolType =
    | 'Point'
    | 'Line'
    | 'Area'
    | 'Text'
    | 'Rectangle';

export interface OCADObject {
    symbol: number;
    type: OCADObjectType;
    coordinates: OCADCoordinate[];
    text?: string;
}

export type OCADObjectType = 'Point' | 'Line' | 'Area' | 'UnformattedText' | 'FormattedText' | 'Rectangle';

export interface OCADCoordinate {
    x: number; // Paper coordinates (mm * 100)
    y: number; // Paper coordinates (mm * 100)
}

// ============= OpenOrienteering Mapper (.omap) Types =============

export interface OMAPMap {
    version: string;
    georeferencing: OMAPGeoreferencing;
    colors: OMAPColor[];
    symbols: OMAPSymbol[];
    parts: OMAPPart[];
}

export interface OMAPGeoreferencing {
    scale: number;
    auxiliary_scale_factor?: number;
    declination?: number;
    grivation?: number;
    projected_crs?: {
        id: string; // E.g., "EPSG:3006"
        spec: string;
    };
    ref_point?: {
        x: number;
        y: number;
    };
    ref_point_deg?: {
        lat: number;
        lon: number;
    };
}

export interface OMAPColor {
    priority: number;
    name: string;
    c: number; // Cyan (0-1)
    m: number; // Magenta (0-1)
    y: number; // Yellow (0-1)
    k: number; // Black (0-1)
    opacity?: number;
}

export interface OMAPSymbol {
    type: number;
    code: string; // ISOM code
    name: string;
    colors?: number[];
}

export interface OMAPPart {
    name: string;
    objects: OMAPObject[];
}

export interface OMAPObject {
    type: number; // 0=Point, 1=Path, 2=Area, 4=Text
    symbol: number;
    coords?: OMAPCoords;
    text?: string;
    pattern?: number[];
}

export interface OMAPCoords {
    count: number;
    data: number[]; // [x1, y1, flags1, x2, y2, flags2, ...]
}

// ============= Imported Map (Unified Format) =============

export interface ImportedMap {
    name: string;
    source: MapSource;
    scale: number;
    georeferencing: MapGeoreferencing;
    bounds?: MapBounds;
    tiles?: MapTiles;
    rawData?: ArrayBuffer | string;
}

export type MapSource = 'OCAD' | 'OMAP' | 'MBTiles' | 'GeoTIFF' | 'Image';

export interface MapGeoreferencing {
    crs: string; // Coordinate Reference System (e.g., "EPSG:3006")
    scale: number;
    declination?: number; // Magnetic declination (degrees)
    grivation?: number; // Grid north deviation (degrees)
    bounds?: {
        topLeft: GeoPoint;
        bottomRight: GeoPoint;
    };
    transformation?: TransformationMatrix;
}

export interface TransformationMatrix {
    // Affine transformation: [a, b, c, d, e, f]
    // x' = a*x + b*y + c
    // y' = d*x + e*y + f
    matrix: [number, number, number, number, number, number];
}

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface MapPoint {
    x: number; // Map coordinates (meters or paper units)
    y: number;
}

export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export interface MapTiles {
    format: 'png' | 'jpg' | 'webp';
    minZoom: number;
    maxZoom: number;
    tileSize?: number;
    tiles: string[]; // URL template array e.g. ['https://example.com/{z}/{x}/{y}.png']
}

// ============= MBTiles Format =============

export interface MBTilesMetadata {
    name: string;
    format: 'png' | 'jpg' | 'webp';
    bounds: [number, number, number, number]; // [west, south, east, north]
    center: [number, number, number]; // [lng, lat, zoom]
    minzoom: number;
    maxzoom: number;
    attribution?: string;
}

// ============= Course File Import =============

export interface ImportedCourse {
    name: string;
    length?: number; // meters
    climb?: number; // meters
    controls: ImportedControl[];
    startPoint?: ImportedControl;
    finishPoint?: ImportedControl;
}

export interface ImportedControl {
    code: string;
    position: MapPoint;
    geoPosition?: GeoPoint;
    description?: string;
    type?: 'Start' | 'Control' | 'Finish';
}

// ============= Manual Georeferencing =============

export interface GeorefPoint {
    id: string;
    mapPosition: MapPoint;
    geoPosition: GeoPoint;
    name?: string;
}

export interface ManualGeoreferencing {
    points: GeorefPoint[]; // Minimum 3 points
    transformation?: TransformationMatrix;
    rmsError?: number; // Root mean square error (meters)
}
