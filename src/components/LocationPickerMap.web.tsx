import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MapProps {
    mapRef: any;
    region: any;
    onRegionChange: () => void;
    onRegionChangeComplete: (region: any) => void;
    colors: any;
}

const LocationPickerMap = ({ mapRef, region, onRegionChange, onRegionChangeComplete, colors }: MapProps) => {
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.placeholder}>
                <Text style={{ color: colors.secondaryText }}>
                    Interactive Map is only available on Mobile Apps.
                </Text>
                <Text style={{ color: colors.secondaryText, marginTop: 8, fontSize: 12 }}>
                    (Search and address geocoding still work on Web)
                </Text>
            </View>
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
        borderColor: '#ccc',
    },
    placeholder: {
        alignItems: 'center',
        padding: 20,
    }
});

export default LocationPickerMap;
