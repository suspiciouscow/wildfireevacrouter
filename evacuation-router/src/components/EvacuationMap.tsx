import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Location, FireData, SafePoint, RouteData } from '@/types';
import { EvacuationService } from '@/services/evacuationService';

if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  throw new Error('Mapbox token is required');
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Define safe points - in production, this should come from a database
const SAFE_POINTS: SafePoint[] = [
  {
    id: "shelter-dodger",
    name: "Dodger Stadium Emergency Shelter",
    location: { lat: 34.0739, lng: -118.2400 },
    type: "shelter",
    capacity: 1000,
    isOpen: true,
    lastUpdated: new Date().toISOString(),
    facilities: ["parking", "medical", "food", "water"],
    contact: {
      phone: "213-555-0123",
    }
  },
  {
    id: "shelter-convention",
    name: "LA Convention Center Shelter",
    location: { lat: 34.0403, lng: -118.2696 },
    type: "shelter",
    capacity: 2000,
    isOpen: true,
    lastUpdated: new Date().toISOString(),
    facilities: ["parking", "medical", "food", "water", "wifi"],
    contact: {
      phone: "213-555-0124",
    }
  }
];

interface MapMarker {
  marker: mapboxgl.Marker;
  type: 'fire' | 'user' | 'safe-point';
}

export default function EvacuationMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<MapMarker[]>([]);
  
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [activeFires, setActiveFires] = useState<FireData[]>([]);
  const [error, setError] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedSafePoint, setSelectedSafePoint] = useState<SafePoint | null>(null);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-118.2437, 34.0522], // Los Angeles coordinates
        zoom: 10
      });
    
      map.current.on('load', () => {
        initializeMapLayers();
        addMapControls();
        addSafePoints();
      });
    } catch (err) {
      setError('Failed to initialize map');
      console.error('Map initialization error:', err);
    }
    
    return () => {
      if (map.current) {
        cleanup();
      }
    };
  }, [clearMarkers]);

  const initializeMapLayers = () => {
    if (!map.current) return;
  
    // Remove existing layers if they exist
    if (map.current.getLayer('fires-heat')) {
      map.current.removeLayer('fires-heat');
    }
    if (map.current.getLayer('fire-points')) {
      map.current.removeLayer('fire-points');
    }
    if (map.current.getSource('fires')) {
      map.current.removeSource('fires');
    }
  
    // Add fire data source
    map.current.addSource('fires', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
  
    // Add heatmap layer
    map.current.addLayer({
      id: 'fires-heat',
      type: 'heatmap',
      source: 'fires',
      maxzoom: 18,
      paint: {
        // Increase weight based on confidence
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'confidence'],
          0, 0.1,
          100, 1.5  // Increased maximum weight
        ],
        // Adjust intensity for better visibility
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.5,
          9, 2,
          15, 3
        ],
        // More prominent red color scheme
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(255,255,255,0)',
          0.2, 'rgba(255,225,225,0.8)',
          0.4, 'rgba(255,175,175,0.9)',
          0.6, 'rgba(255,125,125,0.95)',
          0.8, 'rgba(255,75,75,0.98)',
          1, 'rgba(255,0,0,1)'
        ],
        // Increased radius for better coverage
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 15,    // Larger base radius
          9, 35,    // Larger medium zoom radius
          15, 50    // Larger maximum radius
        ],
        // Higher base opacity
        'heatmap-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.9,
          15, 0.8
        ]
      }
    });
  
    // Add circle layer for fire points
    map.current.addLayer({
      id: 'fire-points',
      type: 'circle',
      source: 'fires',
      minzoom: 10,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 4,
          15, 8
        ],
        'circle-color': '#ff4d4d',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9
      }
    });
  };
  
  // Add map controls
  const addMapControls = () => {
    if (!map.current) return;
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showAccuracyCircle: true
      })
    );
  };

  // Add safe points to map
  const addSafePoints = () => {
    if (!map.current) return;
    SAFE_POINTS.forEach(point => {
      const markerColor = point.isOpen ? '#008000' : '#808080';
      const marker = new mapboxgl.Marker({ color: markerColor })
        .setLngLat([point.location.lng, point.location.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<div class="p-2">
              <h3 class="font-bold">${point.name}</h3>
              <p>Status: ${point.isOpen ? 'Open' : 'Closed'}</p>
              ${point.capacity ? `<p>Capacity: ${point.capacity} people</p>` : ''}
              ${point.contact?.phone ? `<p>Phone: ${point.contact.phone}</p>` : ''}
              <p class="text-sm mt-1">Type: ${point.type}</p>
            </div>`
          )
        )
        .addTo(map.current);
      
      markersRef.current.push({ marker, type: 'safe-point' });
    });
  };

  // Cleanup function for map resources
  const cleanup = () => {
    if (!map.current) return;
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }
    map.current.remove();
    clearMarkers();
  };

  const fetchAndDisplayFires = useCallback(async () => {
    if (!map.current) return;

    try {
      const bounds = map.current.getBounds();
      const expandedBounds = new mapboxgl.LngLatBounds(
        [bounds.getWest() - 2.0, bounds.getSouth() - 2.0],
        [bounds.getEast() + 2.0, bounds.getNorth() + 2.0]
      );
      
      const fires = await EvacuationService.getActiveFires(expandedBounds);
      setActiveFires(fires);

      // Clear existing fire markers
      markersRef.current = markersRef.current.filter(({ type, marker }) => {
        if (type === 'fire') {
          marker.remove();
          return false;
        }
        return true;
      });

      // Update heatmap data
      if (map.current.getSource('fires')) {
        const geoJson = {
          type: 'FeatureCollection',
          features: fires.filter(fire => 
            fire && !isNaN(fire.latitude) && !isNaN(fire.longitude) &&
            fire.latitude !== null && fire.longitude !== null
          ).map(fire => ({
            type: 'Feature',
            properties: {
              confidence: parseFloat(fire.confidence) || 50,
              date: fire.date,
              brightness: fire.brightness || 350
            },
            geometry: {
              type: 'Point',
              coordinates: [fire.longitude, fire.latitude]
            }
          }))
        };

        (map.current.getSource('fires') as mapboxgl.GeoJSONSource).setData(geoJson);
      }

      // Add individual fire markers
      fires.forEach(fire => {
        if (!isNaN(fire.longitude) && !isNaN(fire.latitude) && 
            fire.longitude !== null && fire.latitude !== null) {
          const marker = new mapboxgl.Marker({ color: '#FFA500', scale: 1.0 })
            .setLngLat([fire.longitude, fire.latitude])
            .setPopup(
              new mapboxgl.Popup().setHTML(
                `<div>
                  <p>Fire detected on: ${fire.date}</p>
                  <p>Confidence: ${fire.confidence}</p>
                </div>`
              )
            )
            .addTo(map.current!);
      
          markersRef.current.push({ marker, type: 'fire' });
        }
      });
    } catch (err) {
      console.error('Error fetching fire data:', err);
      setError('Failed to fetch fire data');
    }
  }, []);

  // Set up fire data fetching
  useEffect(() => {
    if (map.current) {
      const fetchInitialData = () => {
        console.log('Map loaded, fetching initial fire data');
        fetchAndDisplayFires();
      };

      map.current.on('load', fetchInitialData);
      const interval = setInterval(fetchAndDisplayFires, 300000); // 5 minutes
      
      return () => clearInterval(interval);
    }
  }, [fetchAndDisplayFires]);

  // Handle online/offline status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const getUserLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(newLocation);
        
        if (map.current) {
          map.current.flyTo({
            center: [newLocation.lng, newLocation.lat],
            zoom: 14
          });

          // Update user marker
          markersRef.current = markersRef.current.filter(({ type, marker }) => {
            if (type === 'user') {
              marker.remove();
              return false;
            }
            return true;
          });

          const marker = new mapboxgl.Marker({ color: '#FF0000' })
            .setLngLat([newLocation.lng, newLocation.lat])
            .addTo(map.current);

          markersRef.current.push({ marker, type: 'user' });
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Unable to get your location. Please enter it manually.');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }, []);

  const calculateEvacuationRoute = useCallback(async () => {
    if (!userLocation || !map.current) return;
    
    setRouteLoading(true);
    try {
      const bounds = map.current.getBounds();
      const fires = await EvacuationService.getActiveFires(bounds);
      const route = await EvacuationService.findSafestRoute(
        userLocation,
        SAFE_POINTS,
        fires
      );
      
      if (route) {
        // Remove existing route
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
        }
        if (map.current.getSource('route')) {
          map.current.removeSource('route');
        }
        
        // Add new route
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          }
        });
        
        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 4,
            'line-opacity': 0.75
          }
        });
        
        setCurrentRoute(route);
        
        // Fit map to route bounds
        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord as [number, number]);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
      }
    } catch (err) {
      console.error('Error calculating evacuation route:', err);
      setError('Failed to calculate evacuation route');
    } finally {
      setRouteLoading(false);
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-full">
      {error && (
        <div className="m-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded absolute top-0 left-0 right-0 z-10">
          <span className="block sm:inline">{error}</span>
          <button
            className="absolute top-0 right-0 px-4 py-3"
            onClick={() => setError('')}
          >
            ✕
          </button>
        </div>
      )}
  
      {/* Live Updates Panel */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded shadow-lg z-10">
        <h2 className="text-lg font-bold mb-2">Live Updates</h2>
        <div className="space-y-2">
          {!isOnline && (
            <p className="text-yellow-600">
              ⚠️ You're currently offline - Please reconnect for real-time updates
            </p>
          )}
          {activeFires.length > 0 && (
            <div className="text-red-600">
              <p className="font-semibold">🔥 Active Fires</p>
              <p className="text-sm">Detected {activeFires.length} active fires in your area</p>
            </div>
          )}
          {userLocation && (
            <div>
              <p className="font-semibold">📍 Your Position</p>
              <p className="text-sm">Latitude: {userLocation.lat.toFixed(4)}</p>
              <p className="text-sm">Longitude: {userLocation.lng.toFixed(4)}</p>
            </div>
          )}
          {currentRoute && (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-bold">🚗 Evacuation Route Details</h3>
              <p className="text-sm mt-2">Distance to shelter: {(currentRoute.distance / 1000).toFixed(1)} km</p>
              <p className="text-sm">Estimated travel time: {Math.round(currentRoute.duration / 60)} minutes</p>
              {currentRoute.warnings?.length > 0 && (
                <div className="mt-2">
                  <p className="text-yellow-600 font-semibold">⚠️ Important Notes:</p>
                  <ul className="list-disc list-inside">
                    {currentRoute.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {!userLocation && (
            <p className="text-sm text-gray-600">
              Click "Get My Location" to start receiving updates about fires and evacuation routes in your area
            </p>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4 p-4 absolute top-4 right-4 z-10">
        <button 
          onClick={getUserLocation}
          disabled={!isOnline}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-gray-400"
        >
          Get My Location
        </button>
        <button 
          onClick={() => fetchAndDisplayFires()}
          disabled={!isOnline}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-gray-400"
        >
          Refresh Fire Data
        </button>
        <button 
          onClick={calculateEvacuationRoute}
          disabled={!isOnline || !userLocation || routeLoading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 
                     transition-colors disabled:bg-gray-400 flex items-center gap-2"
        >
          {routeLoading ? (
            <>
              <span className="animate-spin">⏳</span>
              Calculating...
            </>
          ) : (
            'Find Evacuation Route'
          )}
        </button>
      </div>
      
      <div ref={mapContainer} className="absolute inset-0" style={{ height: '100%' }} />
    </div>
  );
}