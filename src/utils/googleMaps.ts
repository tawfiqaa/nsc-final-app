import { SchoolLocation } from '../types';

const GOOGLE_MAPS_API_KEY = "AIzaSyCwR7GW4ir-PayHXp1IqcUW3DOEEbXgRBY";

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

/**
 * Fetch place suggestions from Google Places Autocomplete API
 */
export async function getPlaceSuggestions(input: string): Promise<GooglePlaceSuggestion[]> {
    if (!input || input.length < 2) return [];

    try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK') {
            return data.predictions;
        }
        return [];
    } catch (error) {
        console.error('Error fetching place suggestions:', error);
        return [];
    }
}

/**
 * Get details for a specific place by placeId
 */
export async function getPlaceDetails(placeId: string): Promise<Partial<SchoolLocation> | null> {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,name,geometry,place_id&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

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
        console.error('Error fetching place details:', error);
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
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];

            // Try to find a "premise" or "point_of_interest" for placeName
            let placeName = '';
            const poi = data.results.find((r: any) => r.types.includes('point_of_interest') || r.types.includes('premise'));
            if (poi) {
                // Usually the first part of the address or a specific property
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
        console.error('Error reverse geocoding:', error);
        return null;
    }
}
