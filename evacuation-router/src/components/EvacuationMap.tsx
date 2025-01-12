import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Location, FireData, SafePoint } from '@/types';
import { EvacuationService } from '@/services/evacuationService';

if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  throw new Error('Mapbox token is required');
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Define safe points - in production, this should come from a database
const SAFE_POINTS: SafePoint[] = [
  {
    name: "Emergency Shelter A",
    location: { lat: 34.0522, lng: -118.2437 },
    type: "shelter"
  },
  {
    name: "Emergency Shelter B",
    location: { lat: 34.0622, lng: -118.2537 },
    type: "shelter"
  }
  // Add more safe points as needed
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
  const [isOnline, setIsOnline] = useState(true); // Default to true

  // Clear existing markers
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

      // Add navigation controls
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

      // Add safe points to map
      SAFE_POINTS.forEach(point => {
        const marker = new mapboxgl.Marker({ color: '#008000' })
          .setLngLat([point.location.lng, point.location.lat])
          .setPopup(
            new mapboxgl.Popup().setHTML(
              `<div>
                <h3>${point.name}</h3>
                <p>Type: ${point.type}</p>
              </div>`
            )
          )
          .addTo(map.current!);

        markersRef.current.push({ marker, type: 'safe-point' });
      });

    } catch (err) {
      setError('Failed to initialize map');
      console.error('Map initialization error:', err);
    }

    return () => {
      map.current?.remove();
      clearMarkers();
    };
  }, [clearMarkers]);

  // Fetch and display fires
  const fetchAndDisplayFires = useCallback(async () => {
    if (!map.current) return;

    try {
      const bounds = map.current.getBounds();
      const fires = await EvacuationService.getActiveFires(bounds);
      setActiveFires(fires);

      // Clear existing fire markers
      markersRef.current = markersRef.current.filter(({ type, marker }) => {
        if (type === 'fire') {
          marker.remove();
          return false;
        }
        return true;
      });

      // Add new fire markers
      fires.forEach(fire => {
        // Validate coordinates before creating marker
        if (!isNaN(fire.longitude) && !isNaN(fire.latitude) && 
            fire.longitude !== null && fire.latitude !== null) {
          const marker = new mapboxgl.Marker({ color: '#FFA500' })
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
        } else {
          console.warn('Invalid fire coordinates:', fire);
        }
      });
      
    } catch (err) {
      console.error('Error fetching fire data:', err);
      setError('Failed to fetch fire data');
    }
  }, []);

  // Update fires periodically
  useEffect(() => {
    if (userLocation) {
      fetchAndDisplayFires();
      const interval = setInterval(fetchAndDisplayFires, 300000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [fetchAndDisplayFires, userLocation]);

  // Handle online/offline status
  useEffect(() => {
    // Update initial online status
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

          // Clear existing user marker
          markersRef.current = markersRef.current.filter(({ type, marker }) => {
            if (type === 'user') {
              marker.remove();
              return false;
            }
            return true;
          });

          // Add new user marker
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

  return (
    <div className="w-full h-screen flex flex-col relative">
      {/* Error display */}
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

      {/* Status panel */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded shadow-lg z-10">
        <h2 className="text-lg font-bold mb-2">Status</h2>
        <div className="space-y-2">
          {!isOnline && (
            <p className="text-yellow-600">
              Offline mode - some features may be limited
            </p>
          )}
          {activeFires.length > 0 && (
            <p className="text-red-600">
              {activeFires.length} active fires in area
            </p>
          )}
          {userLocation && (
            <p>
              Your location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>
      
      {/* Controls */}
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
      </div>
      
      {/* Map container */}
      <div ref={mapContainer} className="flex-1 min-h-0" />
    </div>
  );
}