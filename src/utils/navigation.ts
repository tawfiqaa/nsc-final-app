/**
 * navigation.ts
 * Shared helper to open a school location in the user's preferred maps app.
 * Uses placeId when available (most accurate), falls back to coords + label.
 */
import { Alert, Linking, Platform } from 'react-native';
import { SchoolLocation } from '../types';

/**
 * Open system map chooser (Google Maps / Waze / Apple Maps) for `loc`.
 * `label` should be the SCHOOL NAME — it becomes the pin label in the map app.
 */
export async function openNavigation(
    loc: SchoolLocation | null | undefined,
    label: string,
    noLocationMessage = 'No location has been set for this school.'
): Promise<void> {
    if (!loc?.lat || !loc?.lng) {
        Alert.alert('No Location', noLocationMessage);
        return;
    }

    const lat = loc.lat;
    const lng = loc.lng;
    const encodedLabel = encodeURIComponent(label);
    const latLng = `${lat},${lng}`;

    // ── Google Maps URL (best cross-platform) ──────────────────────────────
    // Prefer placeId if present — Google Maps resolves it to the exact place.
    const googleUrl = loc.placeId
        ? `https://www.google.com/maps/search/?api=1&query=${encodedLabel}&query_place_id=${loc.placeId}`
        : `https://www.google.com/maps/search/?api=1&query=${encodedLabel}&query=${latLng}`;

    // ── Native deep links ──────────────────────────────────────────────────
    const nativeUrl = Platform.select({
        // Apple Maps: label@lat,lng
        ios: `maps:0,0?q=${encodedLabel}@${latLng}`,
        // Android geo URI with label
        android: `geo:0,0?q=${latLng}(${encodedLabel})`,
    });

    try {
        if (nativeUrl) {
            const supported = await Linking.canOpenURL(nativeUrl);
            if (supported) {
                await Linking.openURL(nativeUrl);
                return;
            }
        }
        // Fallback: open Google Maps in browser / Google Maps app
        await Linking.openURL(googleUrl);
    } catch {
        try {
            await Linking.openURL(googleUrl);
        } catch {
            Alert.alert('Error', 'Could not open maps. Please try again.');
        }
    }
}
