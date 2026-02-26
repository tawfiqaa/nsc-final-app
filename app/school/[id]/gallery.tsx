import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLesson } from '../../../src/contexts/LessonContext';
import { useTheme } from '../../../src/contexts/ThemeContext';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - (40) - (IMAGE_MARGIN * 2 * COLUMN_COUNT)) / COLUMN_COUNT; // 40 is padding of container

export default function SchoolGalleryScreen() {
    const { id } = useLocalSearchParams();
    const schoolName = Array.isArray(id) ? id[0] : id;
    const { colors } = useTheme();
    const { schoolGalleries, addSchoolPhoto } = useLesson();

    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const photos = schoolGalleries[schoolName] || [];

    const handleAddPhoto = async () => {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "You need to grant permission to access your photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], // Updated line to use string[] instead of MediaTypeOptions enum
            allowsEditing: true,
            quality: 0.8, // Compress slightly
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            setUploading(true);
            try {
                await addSchoolPhoto(schoolName, uri);
            } catch (error) {
                Alert.alert("Upload Failed", "There was an error uploading your photo.");
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.text }]}>{schoolName} Gallery</Text>
                <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddPhoto}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons name="add" size={20} color="#fff" />
                            <Text style={styles.addButtonText}>Add Photo</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {photos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="images-outline" size={64} color={colors.secondaryText} />
                        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                            No photos in this gallery yet.
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.secondaryText }]}>
                            Add schedules, maps, or whiteboard notes.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {photos.map((url, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => setSelectedImage(url)}
                                style={styles.imageContainer}
                            >
                                <Image
                                    source={{ uri: url }}
                                    style={styles.thumbnail}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={!!selectedImage}
                transparent={true}
                onRequestClose={() => setSelectedImage(null)}
                animationType="fade"
            >
                <View style={styles.fullScreenModal}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setSelectedImage(null)}
                    >
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: 60, // Safe area ish
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    content: {
        padding: 20,
        minHeight: '100%',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    imageContainer: {
        margin: IMAGE_MARGIN,
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        marginTop: 8,
        textAlign: 'center',
    },
    fullScreenModal: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
});
