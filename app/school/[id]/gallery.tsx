import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useLesson } from '../../../src/contexts/LessonContext';
import { useOrg } from '../../../src/contexts/OrgContext';
import { useTheme } from '../../../src/contexts/ThemeContext';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - (40) - (IMAGE_MARGIN * 2 * COLUMN_COUNT)) / COLUMN_COUNT;

export default function SchoolGalleryScreen() {
    const { id } = useLocalSearchParams();
    const schoolName = Array.isArray(id) ? id[0] : id;
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { membershipRole } = useOrg();
    const { schoolGalleries, addSchoolPhoto, deleteSchoolPhoto } = useLesson();
    const { t } = useTranslation();
    const router = useRouter();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const photos = schoolGalleries[schoolName] || [];

    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    if (isRestrictedAdmin) return null;

    const handleAddPhoto = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert(t('gallery.permissionRequired'), t('gallery.permissionMsg'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            setUploading(true);
            try {
                await addSchoolPhoto(schoolName, uri);
            } catch (error) {
                console.error(error);
                Alert.alert(t('gallery.uploadFailed'), t('gallery.uploadError'));
            } finally {
                setUploading(false);
            }
        }
    };

    const handleDeletePhoto = (url: string) => {
        Alert.alert(
            t('gallery.deletePhoto'),
            t('gallery.deletePhotoConfirm'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('schools.deleteSchool'), // Reuse deleteSchool text or common.delete if exists
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setUploading(true);
                            await deleteSchoolPhoto(schoolName, url);
                            setSelectedImage(null);
                        } catch (error) {
                            Alert.alert(t('common.error'), t('common.error'));
                        } finally {
                            setUploading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, boldStyle]} numberOfLines={1}>
                        {t('gallery.title', { schoolName })}
                    </Text>
                </View>
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
                            <Text style={[styles.addButtonText, { fontFamily: fonts.bold }]}>{t('gallery.addPhoto')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {photos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="images-outline" size={64} color={colors.secondaryText} />
                        <Text style={[styles.emptyText, { color: colors.secondaryText, fontFamily: fonts.bold }]}>
                            {t('gallery.noPhotos')}
                        </Text>
                        <Text style={[styles.emptySubtext, secondaryStyle]}>
                            {t('gallery.emptySubtext')}
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
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeletePhoto(selectedImage)}
                        >
                            <Ionicons name="trash" size={30} color="#ff4444" />
                        </TouchableOpacity>
                    )}
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
        paddingTop: 60,
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
    deleteButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
});
