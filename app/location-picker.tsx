import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useLesson } from '../src/contexts/LessonContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { SchoolLocation } from '../src/types';
import {
    getPlaceDetails,
    getPlaceSuggestions,
    GooglePlaceSuggestion,
    reverseGeocode
} from '../src/utils/googleMaps';

export default function LocationPickerScreen() {
    const { colors, fonts, tokens } = useTheme();
    const router = useRouter();
    const { updateSchoolLocation, schools } = useLesson();
    const { schoolId } = useLocalSearchParams<{ schoolId: string }>();

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [selectedLocation, setSelectedLocation] = useState<SchoolLocation | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (schoolId) {
            const school = schools.find(s => s.id === schoolId || s.name === schoolId);
            if (school?.location) {
                setSelectedLocation(school.location);
            }
        }
    }, [schoolId, schools]);

    const handleSearch = useCallback(async (text: string) => {
        setSearchQuery(text);
        if (text.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            const results = await getPlaceSuggestions(text);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 400) as any;
    }, []);

    const handleSelectSuggestion = async (item: GooglePlaceSuggestion) => {
        Keyboard.dismiss();
        setShowSuggestions(false);
        setSearchQuery(item.description);
        setIsSearching(true);
        const details = await getPlaceDetails(item.place_id);
        setIsSearching(false);
        if (details && details.lat && details.lng) {
            setSelectedLocation(details as SchoolLocation);
        }
    };

    const handleUseCurrentLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Allow location access to find your current position.');
            return;
        }
        setIsGeocoding(true);
        try {
            const loc = await Location.getCurrentPositionAsync({});
            const addressInfo = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
            if (addressInfo) {
                setSelectedLocation(addressInfo);
                setSearchQuery('');
            }
        } catch (e: any) {
            Alert.alert('Location Error', 'Failed to get current location.');
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedLocation) {
            Alert.alert('No location selected', 'Search for a place first.');
            return;
        }
        if (!schoolId) {
            Alert.alert('Error', 'No school ID received. Go back and try again.');
            return;
        }

        const locationWithLabel = {
            ...selectedLocation,
            label: schoolId, // school name IS the label
        };

        setIsSaving(true);
        try {
            await updateSchoolLocation(schoolId, locationWithLabel);
            Alert.alert('Location Saved', selectedLocation.address || 'Location updated.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err: any) {
            const msg = err?.message || String(err);
            Alert.alert('Save Failed', `Could not save location:\n\n${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
            <Stack.Screen options={{ headerTitle: 'Select Location', headerBackTitle: 'Back', headerShown: true }} />

            <View style={{ flex: 1, padding: 20 }}>
                {/* Search Bar */}
                <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary, fontFamily: fonts.regular }]}
                        placeholder="Search for address or place..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    />
                    {isSearching && <ActivityIndicator size="small" color={colors.accentPrimary} />}
                    {searchQuery.length > 0 && !isSearching && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {showSuggestions && (
                    <View style={[styles.suggestionsList, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                        <FlatList
                            data={suggestions}
                            keyExtractor={(item) => item.place_id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.suggestionItem, { borderBottomColor: colors.borderSubtle }]}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                                    <View style={styles.suggestionText}>
                                        <Text style={[styles.mainText, { color: colors.textPrimary, fontFamily: fonts.bold }]} numberOfLines={1}>
                                            {item.structured_formatting?.main_text || item.description.split(',')[0]}
                                        </Text>
                                        <Text style={[styles.subText, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                                            {item.structured_formatting?.secondary_text || item.description}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                )}

                {/* Current Location Button */}
                <TouchableOpacity
                    style={[styles.currentLocBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: tokens.radius.large }]}
                    onPress={handleUseCurrentLocation}
                >
                    <Ionicons name="locate" size={24} color={colors.accentPrimary} />
                    <Text style={{ color: colors.accentPrimary, fontFamily: fonts.bold, fontSize: 16, marginLeft: 10 }}>Use My Current Location</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {/* Selected Location Display */}
                <View style={[styles.addressInfo, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: tokens.radius.large }]}>
                    <View style={[styles.iconBox, { backgroundColor: colors.accentPrimary + '15' }]}>
                        <Ionicons name="map" size={24} color={colors.accentPrimary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.addressTitle, { color: colors.textPrimary, fontFamily: fonts.bold }]}>
                            {isGeocoding ? 'Locating...' : (selectedLocation?.placeName || 'Selected Location')}
                        </Text>
                        <Text style={[styles.addressText, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={2}>
                            {isGeocoding ? 'Updating address...' : (selectedLocation?.address || 'Search or use current location.')}
                        </Text>
                    </View>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        { backgroundColor: colors.accentPrimary, borderRadius: tokens.radius.large },
                        (!selectedLocation || isGeocoding) && { opacity: 0.6 }
                    ]}
                    onPress={handleConfirm}
                    disabled={!selectedLocation || isGeocoding || isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.confirmBtnText, { fontFamily: fonts.bold }]}>Confirm Location</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', height: 54,
        borderRadius: 27, paddingHorizontal: 16, borderWidth: 1,
        marginBottom: 16,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16 },
    suggestionsList: {
        position: 'absolute', top: 70, left: 20, right: 20, zIndex: 10,
        borderRadius: 16, borderWidth: 1, maxHeight: 250, overflow: 'hidden',
        elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5,
    },
    suggestionItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 15, borderBottomWidth: 1,
    },
    suggestionText: { marginLeft: 12, flex: 1 },
    mainText: { fontSize: 15 },
    subText: { fontSize: 13, marginTop: 2 },
    currentLocBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderWidth: 1, zIndex: 1,
    },
    addressInfo: {
        flexDirection: 'row', alignItems: 'center', padding: 20,
        borderWidth: 1, marginBottom: 20,
    },
    iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    addressTitle: { fontSize: 18, marginBottom: 4 },
    addressText: { fontSize: 14, lineHeight: 20 },
    confirmBtn: { height: 56, justifyContent: 'center', alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontSize: 18 },
});
