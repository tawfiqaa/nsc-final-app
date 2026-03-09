/**
 * LocationPickerMap — Web platform stub.
 * react-native-maps does not run on web.
 * This file is automatically selected by the bundler instead of
 * LocationPickerMap.tsx when targeting the web platform.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MapProps {
    mapRef?: any;
    region?: any;
    onRegionChange?: () => void;
    onRegionChangeComplete?: (region: any) => void;
    colors: any;
    onMapReady?: () => void;
    onMapError?: (error: string) => void;
}

const LocationPickerMap = ({ colors }: MapProps) => {
    return (
        <View style={[styles.container, { backgroundColor: colors?.background ?? '#f5f5f5', borderColor: colors?.border ?? '#ccc' }]}>
            <Text style={styles.icon}>🗺️</Text>
            <Text style={[styles.title, { color: colors?.text ?? '#333' }]}>
                Map not available on web
            </Text>
            <Text style={[styles.sub, { color: colors?.secondaryText ?? '#777' }]}>
                Use the search bar above to find and save any address.{'\n'}
                Geocoding and location saving still work on web.
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        padding: 24,
    },
    icon: { fontSize: 40, marginBottom: 12 },
    title: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
    sub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

export default LocationPickerMap;
