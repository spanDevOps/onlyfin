/**
 * Client-side location detection using browser Geolocation API
 * This is more accurate than IP-based detection as it uses GPS/WiFi
 */

export interface ClientLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface CompleteLocation {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  source: string;
  displayName?: string;
}

// Cache location in sessionStorage
const LOCATION_CACHE_KEY = 'onlyfin_cached_location';
const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached location from sessionStorage
 */
export function getCachedLocation(): CompleteLocation | null {
  try {
    const cached = sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    // Return cached if less than 5 minutes old
    if (age < LOCATION_CACHE_DURATION) {
      console.log('[CLIENT_LOCATION] Using cached location', { age: Math.round(age / 1000) + 's' });
      return data.location;
    }
    
    // Clear expired cache
    sessionStorage.removeItem(LOCATION_CACHE_KEY);
    return null;
  } catch (error) {
    console.error('[CLIENT_LOCATION] Failed to get cached location', error);
    return null;
  }
}

/**
 * Cache location in sessionStorage
 */
export function cacheLocation(location: CompleteLocation) {
  try {
    sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      location,
      timestamp: Date.now()
    }));
    console.log('[CLIENT_LOCATION] Location cached');
  } catch (error) {
    console.error('[CLIENT_LOCATION] Failed to cache location', error);
  }
}

/**
 * Get user's location using browser Geolocation API
 * Requires user permission
 */
export async function getClientLocation(): Promise<ClientLocation | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('[CLIENT_LOCATION] Geolocation not supported');
      resolve(null);
      return;
    }

    console.log('[CLIENT_LOCATION] Requesting browser geolocation...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[CLIENT_LOCATION] Location obtained', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        console.log('[CLIENT_LOCATION] Location error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false, // Don't need GPS precision for city-level
        timeout: 10000,
        maximumAge: 300000 // Cache for 5 minutes
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get city/country
 * Calls our API which uses Nominatim
 */
export async function reverseGeocode(lat: number, lon: number, accuracy: number): Promise<CompleteLocation | null> {
  try {
    console.log('[CLIENT_LOCATION] Reverse geocoding coordinates...');
    
    const response = await fetch('/api/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ latitude: lat, longitude: lon, accuracy })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get location');
    }
    
    console.log('[CLIENT_LOCATION] Reverse geocode success', {
      city: data.location.city,
      country: data.location.country
    });

    return {
      city: data.location.city,
      state: data.location.region,
      country: data.location.country,
      countryCode: data.location.countryCode,
      latitude: lat,
      longitude: lon,
      accuracy: accuracy,
      source: 'browser-geolocation',
      displayName: `${data.location.city}, ${data.location.country}`
    };
  } catch (error) {
    console.error('[CLIENT_LOCATION] Reverse geocode failed', error);
    return null;
  }
}

/**
 * Get complete location information using browser geolocation + reverse geocoding
 * Checks cache first, then gets fresh location if needed
 */
export async function getCompleteClientLocation(): Promise<CompleteLocation | null> {
  // Check cache first
  const cached = getCachedLocation();
  if (cached) {
    return cached;
  }
  
  // Get fresh location
  console.log('[CLIENT_LOCATION] Getting fresh location...');
  const coords = await getClientLocation();
  
  if (!coords) {
    return null;
  }

  const location = await reverseGeocode(coords.latitude, coords.longitude, coords.accuracy);
  
  if (location) {
    // Cache for future use
    cacheLocation(location);
  }
  
  return location;
}
