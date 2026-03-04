import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';

interface MapProps {
    mapRef: any;
    region: Region;
    onRegionChange: () => void;
    onRegionChangeComplete: (region: Region) => void;
    colors: any;
}

const LocationPickerMap = ({ mapRef, region, onRegionChange, onRegionChangeComplete, colors }: MapProps) => {
    return (
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
        />
    );
};

export default LocationPickerMap;
