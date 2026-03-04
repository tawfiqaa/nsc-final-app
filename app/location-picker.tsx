import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useLesson } from '../src/contexts/LessonContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { SchoolLocation } from '../src/types';
import { getPlaceDetails, getPlaceSuggestions, GooglePlaceSuggestion, reverseGeocode } from '../src/utils/googleMaps';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.65;

export default function LocationPickerScreen() {
    const { colors, fonts } = useTheme();
    const router = useRouter();
    const { updateSchoolLocation, schools } = useLesson();

    // Using a ref for schoolId if we passed it in search params
    // Actually, we'll probably use it to save later or return it to previous screen
    // For now, let's assume we pass schoolId via params
    // @ts-ignore
    const { schoolId } = router.useLocalSearchParams();

    const [region, setRegion] = useState<Region>({
        latitude: 32.0853, // Default to Tel Aviv
        longitude: 34.7818,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [selectedLocation, setSelectedLocation] = useState<SchoolLocation | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const mapRef = useRef<MapView>(null);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const geocodeTimeout = useRef<NodeJS.Timeout | null>(null);

    const pinAnim = useRef(new Animated.Value(0)).current;

    // Initial location setup
    useEffect(() => {
        if (schoolId) {
            const school = schools.find(s => s.id === schoolId || s.name === schoolId);
            if (school?.location) {
                const loc = school.location;
                const newRegion = {
                    latitude: loc.lat,
                    longitude: loc.lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                };
                setRegion(newRegion);
                setSelectedLocation(loc);
                mapRef.current?.animateToRegion(newRegion, 1000);
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
            const newRegion = {
                latitude: details.lat,
                longitude: details.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 1000);
            setSelectedLocation(details as SchoolLocation);
        }
    };

    const onRegionChangeStart = () => {
        if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
        Animated.spring(pinAnim, {
            toValue: -15,
            useNativeDriver: true,
        }).start();
    };

    const onRegionChangeComplete = (newRegion: Region) => {
        setRegion(newRegion);
        Animated.spring(pinAnim, {
            toValue: 0,
            useNativeDriver: true,
        }).start();

        if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);

        geocodeTimeout.current = setTimeout(async () => {
            setIsGeocoding(true);
            const addressInfo = await reverseGeocode(newRegion.latitude, newRegion.longitude);
            if (addressInfo) {
                setSelectedLocation(addressInfo);
            }
            setIsGeocoding(false);
        }, 600) as any;
    };

    const handleUseCurrentLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Allow location access to find your current position.');
            return;
        }

        setIsGeocoding(true);
        const location = await Location.getCurrentPositionAsync({});
        const newRegion = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };

        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
        setIsGeocoding(false);
    };

    const handleConfirm = async () => {
        if (!selectedLocation || !schoolId) return;

        setIsSaving(true);
        try {
            await updateSchoolLocation(schoolId, selectedLocation);
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to save school location');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="dark-content" />

            {/* Map Section */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={region}
                    onRegionChange={onRegionChangeStart}
                    onRegionChangeComplete={onRegionChangeComplete}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    showsCompass={false}
                />

                {/* Center Pin Indicator */}
                <View style={styles.pinContainer} pointerEvents="none">
                    <Animated.View style={{ transform: [{ translateY: pinAnim }] }}>
                        <Ionicons name="location" size={40} color={colors.primary} />
                        <View style={styles.pinShadow} />
                    </Animated.View>
                </View>

                {/* Header/Back Button */}
                <SafeAreaView style={styles.header}>
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: colors.card }]}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </SafeAreaView>

                {/* Floating Search Bar */}
                <View style={[styles.searchWrapper, { top: Platform.OS === 'ios' ? 100 : 60 }]}>
                    <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="search" size={20} color={colors.secondaryText} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
                            placeholder="Search for address or place..."
                            placeholderTextColor={colors.secondaryText}
                            value={searchQuery}
                            onChangeText={handleSearch}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        />
                        {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
                        {searchQuery.length > 0 && !isSearching && (
                            <TouchableOpacity onPress={() => handleSearch('')}>
                                <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {showSuggestions && (
                        <View style={[styles.suggestionsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <FlatList
                                data={suggestions}
                                keyExtractor={(item) => item.place_id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                        onPress={() => handleSelectSuggestion(item)}
                                    >
                                        <Ionicons name="location-outline" size={20} color={colors.secondaryText} />
                                        <View style={styles.suggestionText}>
                                            <Text style={[styles.mainText, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
                                                {item.structured_formatting?.main_text || item.description.split(',')[0]}
                                            </Text>
                                            <Text style={[styles.subText, { color: colors.secondaryText, fontFamily: fonts.regular }]} numberOfLines={1}>
                                                {item.structured_formatting?.secondary_text || item.description}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                keyboardShouldPersistTaps="handled"
                            />
                        </View>
                    )}
                </View>

                {/* Current Location Button */}
                <TouchableOpacity
                    style={[styles.currentLocBtn, { backgroundColor: colors.card }]}
                    onPress={handleUseCurrentLocation}
                >
                    <Ionicons name="locate" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Bottom Card */}
            <View style={[styles.bottomCard, { backgroundColor: colors.card }]}>
                <View style={styles.dragHandle} />
                <View style={styles.addressInfo}>
                    <View style={styles.addressHeader}>
                        <View style={[styles.iconBox, { backgroundColor: colors.primary + '10' }]}>
                            <Ionicons name="map" size={24} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.addressTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                                {isGeocoding ? 'Locating...' : (selectedLocation?.placeName || 'Selected Location')}
                            </Text>
                            <Text style={[styles.addressText, { color: colors.secondaryText, fontFamily: fonts.regular }]} numberOfLines={2}>
                                {isGeocoding ? 'Updating address...' : (selectedLocation?.address || 'Pan the map to pick a location')}
                            </Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        { backgroundColor: colors.primary },
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
    container: {
        flex: 1,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 20,
        zIndex: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    pinContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    pinShadow: {
        width: 4,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: -2,
    },
    searchWrapper: {
        position: 'absolute',
        left: 20,
        right: 20,
        zIndex: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 54,
        borderRadius: 27,
        paddingHorizontal: 16,
        borderWidth: 1,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    suggestionsList: {
        marginTop: 8,
        borderRadius: 16,
        borderWidth: 1,
        maxHeight: 250,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        overflow: 'hidden',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
    },
    suggestionText: {
        marginLeft: 12,
        flex: 1,
    },
    mainText: {
        fontSize: 15,
    },
    subText: {
        fontSize: 13,
        marginTop: 2,
    },
    currentLocBtn: {
        position: 'absolute',
        right: 20,
        bottom: 250,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    bottomCard: {
        height: 230,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#E0E0E0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    addressInfo: {
        marginBottom: 25,
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        lineHeight: 20,
    },
    confirmBtn: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
