import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
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
        if (!uid || !decodedSchoolName) return;

        setLoading(true);
        let unsubscribe: (() => void) | undefined;

        if (activeOrgId) {
            // --- ORG MODE: listen to the school doc inside the org ---
            const schoolRef = doc(db, 'orgs', activeOrgId, 'schools', decodedSchoolName);
            unsubscribe = onSnapshot(schoolRef, (snap) => {
                setPhotos(snap.exists() ? (snap.data().gallery || []) : []);
                setLoading(false);
            }, (error) => {
                console.error(error);
                setLoading(false);
            });
        } else {
            // --- LEGACY / V2: first resolve migration status, then subscribe ---
            const userRef = doc(db, 'users', uid);
            unsubscribe = onSnapshot(userRef, (userSnap) => {
                const isMigrated = userSnap.exists() && userSnap.data()?.migratedToV2;

                if (isMigrated) {
                    // V2 — school subcollection doc
                    const schoolRef = doc(db, 'users', uid, 'schools', decodedSchoolName);
                    onSnapshot(schoolRef, (snap) => {
                        setPhotos(snap.exists() ? (snap.data().gallery || []) : []);
                        setLoading(false);
                    }, (error) => {
                        console.error(error);
                        setLoading(false);
                    });
                } else {
                    // V1 — teacherData doc, schoolGalleries map
                    const dataRef = doc(db, 'teacherData', uid);
                    onSnapshot(dataRef, (snap) => {
                        if (snap.exists()) {
                            const data = snap.data() as TeacherData;
                            setPhotos((data.schoolGalleries || {})[decodedSchoolName] || []);
                        } else {
                            setPhotos([]);
                        }
                        setLoading(false);
                    }, (error) => {
                        console.error(error);
                        setLoading(false);
                    });
                }
            }, (error) => {
                console.error(error);
                setLoading(false);
            });
        }

        return () => unsubscribe?.();
    }, [uid, decodedSchoolName, activeOrgId]);

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
