import { SchoolLocation } from '../types';

// ─── KEY SPLIT ────────────────────────────────────────────────────────────────
// GOOGLE_MAPS_NATIVE_KEY  → injected into native manifest via app.json config plugin
//                           (used by react-native-maps MapView under the hood)
// GOOGLE_MAPS_REST_KEY    → used for REST API calls (Places Autocomplete, Geocoding)
//                           Must NOT be restricted to Android/iOS app. Should allow
//                           Places API + Geocoding API from any HTTP referrer.
//
// For now both vars point to the same key. If you split them, set both in .env.
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_REST_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_REST_KEY
    || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    || '';

// Simple in-memory cache for geocoding results
const geocodeCache = new Map<string, SchoolLocation>();

export interface GooglePlaceSuggestion {
    description: string;
    place_id: string;
    structured_formatting?: {
        main_text: string;
        secondary_text: string;
    };
}

export interface AutocompleteDebugInfo {
    status: number | null;
    apiStatus: string | null;
    error: string | null;
    keyPresent: boolean;
    rawBody?: string;
}

/** Last debug info from autocomplete — read this in the debug panel */
export let lastAutocompleteDebug: AutocompleteDebugInfo = {
    status: null,
    apiStatus: null,
    error: null,
    keyPresent: !!GOOGLE_MAPS_REST_KEY,
};

/**
 * Fetch place suggestions from Google Places Autocomplete API
 */
export async function getPlaceSuggestions(input: string): Promise<GooglePlaceSuggestion[]> {
    if (!input || input.length < 2) return [];

    console.log('[GoogleMaps] autocomplete fetch START — query:', input, '| keyPresent:', !!GOOGLE_MAPS_REST_KEY);

    const debug: AutocompleteDebugInfo = {
        status: null,
        apiStatus: null,
        error: null,
        keyPresent: !!GOOGLE_MAPS_REST_KEY,
    };

    try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_REST_KEY}`;
        const response = await fetch(url);
        const rawBody = await response.text();
        debug.status = response.status;

        console.log('[GoogleMaps] autocomplete response status:', response.status);

        let data: any;
        try {
            data = JSON.parse(rawBody);
        } catch {
            debug.error = 'JSON parse error: ' + rawBody.slice(0, 200);
            debug.rawBody = rawBody.slice(0, 500);
            console.error('[GoogleMaps] autocomplete JSON parse failed. Body:', rawBody.slice(0, 300));
            lastAutocompleteDebug = debug;
            return [];
        }

        debug.apiStatus = data.status;
        debug.error = data.error_message || null;

        console.log('[GoogleMaps] autocomplete API status:', data.status,
            '| error_message:', data.error_message || 'none',
            '| predictions count:', data.predictions?.length ?? 'n/a');

        lastAutocompleteDebug = debug;

        if (data.status === 'OK') {
            return data.predictions;
        }
        return [];
    } catch (error: any) {
        debug.error = error?.message || String(error);
        console.error('[GoogleMaps] autocomplete network error:', error);
        lastAutocompleteDebug = debug;
        return [];
    }
}

/**
 * Get details for a specific place by placeId
 */
export async function getPlaceDetails(placeId: string): Promise<Partial<SchoolLocation> | null> {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,name,geometry,place_id&key=${GOOGLE_MAPS_REST_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        console.log('[GoogleMaps] place details status:', data.status, '| error_message:', data.error_message || 'none');

        if (data.status === 'OK' && data.result) {
            const { result } = data;
            return {
                address: result.formatted_address,
                placeName: result.name,
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                placeId: result.place_id,
                updatedAt: Date.now()
            };
        }
        return null;
    } catch (error) {
        console.error('[GoogleMaps] place details error:', error);
        return null;
    }
}

/**
 * Reverse geocode coordinates to get an address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<SchoolLocation | null> {
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey)!;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_REST_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        console.log('[GoogleMaps] reverseGeocode status:', data.status, '| error_message:', data.error_message || 'none');

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];

            let placeName = '';
            const poi = data.results.find((r: any) => r.types.includes('point_of_interest') || r.types.includes('premise'));
            if (poi) {
                placeName = poi.address_components[0].long_name;
            }

            const location: SchoolLocation = {
                address: result.formatted_address,
                placeName: placeName || result.address_components[0].long_name,
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                placeId: result.place_id,
                updatedAt: Date.now()
            };

            geocodeCache.set(cacheKey, location);
            return location;
        }
        return null;
    } catch (error) {
        console.error('[GoogleMaps] reverseGeocode error:', error);
        return null;
    }
}
