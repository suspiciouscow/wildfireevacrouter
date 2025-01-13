import axios from 'axios';
import { FireData, Location, RouteData, SafePoint } from '@/types';

export class EvacuationService {
  private static FIRMS_API_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area';
  private static MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving/';
  
  static async getActiveFires(bounds: mapboxgl.LngLatBounds): Promise<FireData[]> {
    const apiKey = process.env.NEXT_PUBLIC_NASA_FIRMS_KEY;
    
    if (!apiKey) {
      console.error('NASA FIRMS API key is missing');
      return [];
    }
    
    try {
      // Use VIIRS data for higher resolution
      const url = `${this.FIRMS_API_URL}/${apiKey}/VIIRS_SNPP_NRT/${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}/1/`;
      const response = await axios.get(url);
      
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
  
      return response.data
        .filter((fire: any) => 
          fire.latitude && 
          fire.longitude && 
          !isNaN(fire.latitude) && 
          !isNaN(fire.longitude)
        )
        .map((fire: any) => ({
          latitude: Number(fire.latitude),
          longitude: Number(fire.longitude),
          confidence: String(fire.confidence || '50'),
          date: fire.acq_date || new Date().toISOString(),
          brightness: fire.bright_ti4 || 350
        }));
  
    } catch (error) {
      console.error('Error fetching fire data:', error);
      return [];
    }
  }
  private static parseFireData(csvData: string): FireData[] {
    // Split CSV into lines and remove header
    const lines = csvData.split('\n');
    const header = lines[0].split(',');
    
    return lines.slice(1)
      .filter(line => line.trim() !== '')
      .map(line => {
        const values = line.split(',');
        return {
          latitude: parseFloat(values[0]),
          longitude: parseFloat(values[1]),
          confidence: values[2],
          date: values[3]
        };
      });
  }

  static async findSafestRoute(
    userLocation: Location,
    safePoints: SafePoint[],
    activeFires: FireData[]
  ): Promise<RouteData | null> {
    if (safePoints.length === 0) {
      console.error('No safe points available');
      return null;
    }

    // Find nearest safe point that avoids fire areas
    const nearest = this.findNearestSafePoint(userLocation, safePoints, activeFires);
    
    if (!nearest) {
      console.error('No safe evacuation points found');
      return null;
    }
    
    try {
      const route = await this.getEvacuationRoute(userLocation, nearest.location);
      return route;
    } catch (error) {
      console.error('Error finding safe route:', error);
      return null;
    }
  }
  
  private static calculateDistance(point1: Location, point2: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.lat * Math.PI) / 180;
    const φ2 = (point2.lat * Math.PI) / 180;
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  private static isRouteSafe(
    location: Location,
    safePoint: SafePoint,
    activeFires: FireData[],
    safetyRadius: number = 5000 // 5km safety radius
  ): boolean {
    // Check if any fires are too close to the route
    return !activeFires.some(fire => {
      const distanceToStart = this.calculateDistance(
        location,
        { lat: fire.latitude, lng: fire.longitude }
      );
      const distanceToEnd = this.calculateDistance(
        safePoint.location,
        { lat: fire.latitude, lng: fire.longitude }
      );
      
      return distanceToStart < safetyRadius || distanceToEnd < safetyRadius;
    });
  }

  static findNearestSafePoint(
    location: Location,
    safePoints: SafePoint[],
    activeFires: FireData[]
  ): SafePoint | null {
    const safeCandidates = safePoints.filter(point => 
      this.isRouteSafe(location, point, activeFires)
    );

    if (safeCandidates.length === 0) return null;

    return safeCandidates.reduce((nearest, point) => {
      const distance = this.calculateDistance(location, point.location);
      const nearestDistance = this.calculateDistance(location, nearest.location);
      return distance < nearestDistance ? point : nearest;
    });
  }

  static async getEvacuationRoute(
    start: Location,
    end: Location
  ): Promise<RouteData | null> {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (!accessToken) {
      console.error('Mapbox access token is missing');
      return null;
    }

    try {
      const response = await axios.get(
        `${this.MAPBOX_DIRECTIONS_URL}${start.lng},${start.lat};${end.lng},${end.lat}`,
        {
          params: {
            access_token: accessToken,
            geometries: 'geojson',
            alternatives: true, // Get alternative routes
            exclude: 'ferry' // Exclude ferry routes
          }
        }
      );
      
      if (!response.data.routes || response.data.routes.length === 0) {
        console.error('No routes found');
        return null;
      }

      const route = response.data.routes[0];
      return {
        geometry: route.geometry,
        duration: route.duration,
        distance: route.distance
      };
    } catch (error) {
      console.error('Error calculating route:', error);
      return null;
    }
  }
}