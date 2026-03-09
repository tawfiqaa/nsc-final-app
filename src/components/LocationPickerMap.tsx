/**
 * LocationPickerMap
 *
 * Native  → Renders MapView with PROVIDER_GOOGLE.
 *            If onMapReady never fires within MAP_TIMEOUT_MS,
 *            a visible fallback banner is shown so the screen
 *            is NEVER left as a blank beige box.
 *
 * Web     → Returns a lightweight placeholder (MapView does not
 *            exist on web; importing it would crash the bundle).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Inline Region type to avoid a top-level import of react-native-maps
// (which would be processed by the web bundler and crash)
type Region = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

// Only import MapView on native to avoid a web crash
let MapView: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
    // Dynamic require keeps web bundlers from trying to process react-native-maps
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
}

// How long to wait for onMapReady before showing the fallback banner (ms)
const MAP_TIMEOUT_MS = 8000;

interface MapProps {
    mapRef: any;
    region: Region;
    onRegionChange: () => void;
    onRegionChangeComplete: (region: Region) => void;
    colors: any;
    onMapReady?: () => void;
    onMapError?: (error: string) => void;
}

const LocationPickerMap = ({
    mapRef,
    region,
    onRegionChange,
    onRegionChangeComplete,
    colors,
    onMapReady,
    onMapError,
}: MapProps) => {

    const [timedOut, setTimedOut] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Web fallback ─────────────────────────────────────────────────────────
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.fallback, { backgroundColor: colors?.card ?? '#f0f0f0' }]}>
                <Text style={[styles.fallbackTitle, { color: colors?.text ?? '#333' }]}>
                    🗺 Map not available on web
                </Text>
                <Text style={[styles.fallbackSub, { color: colors?.secondaryText ?? '#777' }]}>
                    Use the search bar above to find and save any address.
                </Text>
            </View>
        );
    }

    // ── Native rendering ─────────────────────────────────────────────────────
    // Start a timeout; if onMapReady hasn't fired, show fallback banner
    useEffect(() => {
        timeoutRef.current = setTimeout(() => {
            setTimedOut(true);
            const msg = `Map tiles did not load within ${MAP_TIMEOUT_MS / 1000}s. ` +
                `This usually means the Google Maps SDK key is invalid, ` +
                `or the app is running in Expo Go (native build required).`;
            console.warn('[LocationPickerMap] timeout — tiles not ready:', msg);
            onMapError?.(msg);
        }, MAP_TIMEOUT_MS);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleMapReady = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setTimedOut(false);
        console.log('[LocationPickerMap] onMapReady ✅ — tiles visible');
        onMapReady?.();
    };

    const handleMapLoaded = () => {
        console.log('[LocationPickerMap] onMapLoaded ✅ — all tiles rendered');
    };

    return (
        <>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_GOOGLE}
                initialRegion={region}
                onRegionChange={onRegionChange}
                onRegionChangeComplete={onRegionChangeComplete}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={false}
                onMapReady={handleMapReady}
                onMapLoaded={handleMapLoaded}
            />

            {/* Fallback banner — only shown if tiles timed-out */}
            {timedOut && (
                <View style={styles.timeoutBanner}>
                    <Text style={styles.timeoutTitle}>⚠️ Map unavailable</Text>
                    <Text style={styles.timeoutSub}>
                        You can still search and save a location using the bar above.
                    </Text>
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    // Web placeholder
    fallback: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    fallbackTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    fallbackSub: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Native timeout warning banner
    timeoutBanner: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    timeoutTitle: {
        color: '#ffcc00',
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    timeoutSub: {
        color: '#cccccc',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default LocationPickerMap;
