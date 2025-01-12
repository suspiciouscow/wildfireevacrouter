export interface Location {
    lat: number;
    lng: number;
  }
  
  export interface FireData {
    latitude: number;
    longitude: number;
    confidence: string;
    date: string;
    brightness?: number;  // Optional fire intensity metric
    scan?: number;       // Optional scan size
    track?: number;      // Optional track information
    satellite?: string;  // Optional satellite identifier
  }
  
  export interface RouteData {
    geometry: GeoJSON.LineString;
    duration: number;    // Duration in seconds
    distance: number;    // Distance in meters
    warnings?: string[]; // Optional warnings about the route
    alternatives?: {     // Optional alternative routes
      geometry: GeoJSON.LineString;
      duration: number;
      distance: number;
    }[];
  }
  
  export interface SafePoint {
    id: string;          // Unique identifier
    name: string;
    location: Location;
    type: 'shelter' | 'hospital' | 'police' | 'fire_station';
    capacity?: number;   // Optional capacity information
    contact?: {         // Optional contact information
      phone?: string;
      email?: string;
    };
    facilities?: string[]; // Optional list of available facilities
    isOpen: boolean;      // Whether the safe point is currently accepting people
    lastUpdated: string;  // Timestamp of last status update
  }
  
  // Additional utility types
  export interface BoundingBox {
    north: number;
    south: number;
    east: number;
    west: number;
  }
  
  export interface RouteOptions {
    alternatives?: boolean;
    excludeFireAreas?: boolean;
    excludeHighTraffic?: boolean;
    preferHighways?: boolean;
  }