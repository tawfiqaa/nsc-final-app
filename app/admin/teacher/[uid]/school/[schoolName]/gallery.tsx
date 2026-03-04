import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useOrg } from '../../../../../../src/contexts/OrgContext';
import { useTheme } from '../../../../../../src/contexts/ThemeContext';
import { db } from '../../../../../../src/lib/firebase';
import { TeacherData } from '../../../../../../src/types';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - (40) - (IMAGE_MARGIN * 2 * COLUMN_COUNT)) / COLUMN_COUNT;

export default function AdminSchoolGalleryScreen() {
    const { uid, schoolName } = useLocalSearchParams<{ uid: string, schoolName: string }>();
    const { colors } = useTheme();
    const { activeOrgId } = useOrg();
    const router = useRouter();

    const [photos, setPhotos] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const decodedSchoolName = schoolName ? decodeURIComponent(schoolName) : '';

    useEffect(() => {
        if (uid && decodedSchoolName) {
            fetchGallery(uid, decodedSchoolName);
        }
    }, [uid, decodedSchoolName]);

    const fetchGallery = async (targetUid: string, targetSchool: string) => {
        try {
            setLoading(true);

            if (activeOrgId) {
                // --- ORG MODE ---
                const schoolSnap = await getDoc(doc(db, 'orgs', activeOrgId, 'schools', targetSchool));
                if (schoolSnap.exists()) {
                    setPhotos(schoolSnap.data().gallery || []);
                }
            } else {
                // --- LEGACY or V2 ---
                const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
                const isMigrated = targetUserSnap.exists() && targetUserSnap.data()?.migratedToV2;

                if (isMigrated) {
                    const schoolSnap = await getDoc(doc(db, 'users', targetUid, 'schools', targetSchool));
                    if (schoolSnap.exists()) {
                        setPhotos(schoolSnap.data().gallery || []);
                    }
                } else {
                    const dataSnap = await getDoc(doc(db, 'teacherData', targetUid));
                    if (dataSnap.exists()) {
                        const data = dataSnap.data() as TeacherData;
                        const galleries = data.schoolGalleries || {};
                        setPhotos(galleries[targetSchool] || []);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>{decodedSchoolName} Gallery</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {photos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="images-outline" size={64} color={colors.secondaryText} />
                        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                            No photos in this gallery yet.
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
        alignItems: 'center',
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
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
