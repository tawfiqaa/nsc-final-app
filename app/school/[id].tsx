import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { LogCard } from '../../src/components/LogCard';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLesson } from '../../src/contexts/LessonContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { db } from '../../src/lib/firebase';
import { Student } from '../../src/types';

const { width } = Dimensions.get('window');
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - 40 - (IMAGE_MARGIN * 6)) / 3;

type TabType = 'overview' | 'students' | 'gallery';

const DAY_MAP: Record<number, string> = {
    0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
};

export default function SchoolDetailsScreen() {
    const { id: schoolIdParam } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const { activeOrgId, membershipRole, membershipStatus } = useOrg();
    const { colors, fonts } = useTheme();
    const {
        schedules,
        logs,
        schools,
        schoolGalleries,
        deleteSchedule,
        deleteLog,
        updateLogNotes,
        deleteSchool,
        updateSchoolLocation,
        deleteStudent,
        addSchoolPhoto,
        deleteSchoolPhoto
    } = useLesson();
    const { t } = useTranslation();
    const router = useRouter();

    const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
    const isRestrictedAdmin = isOrgAdmin && !isSuperAdmin;

    // No role-based redirect here to match previous state
    if (!schoolIdParam) return null;

    const orgMode = useMemo(() => !!activeOrgId && membershipStatus === 'approved', [activeOrgId, membershipStatus]);

    // UI States
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Overview states
    const [editingLog, setEditingLog] = useState<any>(null);
    const [notesInput, setNotesInput] = useState('');

    // Students states
    const [students, setStudents] = useState<Student[]>([]);
    const [newStudentName, setNewStudentName] = useState('');
    const [isSavingStudent, setIsSavingStudent] = useState(false);

    // Gallery states
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const schoolName = schoolIdParam;

    const stats = useMemo(() => {
        const schoolLogs = logs
            .filter(l => l.school === schoolName)
            .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

        const schoolDoc = schools.find(s => s.name === schoolName || s.id === schoolIdParam);
        const attendedCount = schoolLogs.filter(l => l.status === 'present').length;

        return {
            schoolLogs,
            schoolDoc,
            attendedCount,
            schoolSchedules: schedules.filter(s => s.school === schoolName)
        };
    }, [logs, schools, schedules, schoolName, schoolIdParam]);

    useEffect(() => {
        if (!user || !schoolIdParam) return;

        const studentsCol = orgMode && activeOrgId
            ? collection(db, 'orgs', activeOrgId, 'schools', schoolIdParam, 'students')
            : collection(db, 'users', user.uid, 'schools', schoolIdParam, 'students');

        const unsubscribe = onSnapshot(studentsCol, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
            setStudents(list.sort((a, b) => a.fullName.localeCompare(b.fullName)));
        });

        return () => unsubscribe();
    }, [user, schoolIdParam, orgMode, activeOrgId]);

    const handleOpenEditLocation = () => {
        setShowMoreMenu(false);
        const schoolId = stats.schoolDoc?.id || schoolIdParam!;
        router.push({
            pathname: '/location-picker' as any,
            params: { schoolId }
        });
    };

    const handleNavigate = () => {
        const school = stats.schoolDoc;
        const location = school?.location;
        const fallbackLabel = school?.locationLabel || school?.addressLabel;

        let url = '';
        if (location?.lat && location?.lng) {
            url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
        } else if (fallbackLabel) {
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackLabel)}`;
        }

        if (!url) {
            Alert.alert(t('schoolDetails.noLocationSet'), t('schoolDetails.noLocationSet'));
            return;
        }

        Linking.openURL(url).catch(() => {
            Alert.alert(t('common.error'), "Could not open maps");
        });
    };

    const handleDeleteSchoolConfirm = () => {
        setShowMoreMenu(false);
        Alert.alert(
            t('schools.deleteSchool'),
            t('schoolDetails.deleteSchoolConfirmLong', { schoolName }),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('schoolDetails.deleteEverything'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteSchool(schoolName!);
                            router.replace('/(tabs)/schools');
                        } catch (e) {
                            Alert.alert(t('common.error'), t('common.deleteFailed'));
                        }
                    }
                }
            ]
        );
    };

    const handleAddStudent = async () => {
        const name = newStudentName.trim();
        if (!name || !user || !schoolIdParam) return;
        setIsSavingStudent(true);
        try {
            const studentsCol = orgMode && activeOrgId
                ? collection(db, 'orgs', activeOrgId, 'schools', schoolIdParam, 'students')
                : collection(db, 'users', user.uid, 'schools', schoolIdParam, 'students');
            const studentRef = doc(studentsCol);
            await setDoc(studentRef, { id: studentRef.id, fullName: name, isActive: true, createdAt: Date.now() });
            setNewStudentName('');
        } catch (error) {
            Alert.alert(t('common.error'), t('students.addFailed'));
        } finally {
            setIsSavingStudent(false);
        }
    };

    const handleAddPhoto = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert(t('common.error'), t('gallery.permissionDenied'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
        if (!result.canceled) {
            setUploadingPhoto(true);
            try {
                await addSchoolPhoto(schoolName!, result.assets[0].uri);
            } catch (e) {
                Alert.alert(t('common.error'), t('gallery.uploadFailed'));
            } finally {
                setUploadingPhoto(false);
            }
        }
    };

    const handleDeletePhotoConfirm = (url: string) => {
        Alert.alert(t('common.confirm'), t('gallery.deleteConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteSchoolPhoto(schoolName!, url);
                        setSelectedImage(null);
                    } catch (e) {
                        Alert.alert(t('common.error'), t('gallery.deleteFailed'));
                    }
                }
            }
        ]);
    };

    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    const renderOverview = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            {/* Stat Card */}
            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, boldStyle]}>{stats.attendedCount}</Text>
                <Text style={secondaryStyle}>{t('schoolDetails.attendedLessons')}</Text>
            </View>

            {/* Location Card */}
            <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.locationHeader}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary + '10' }]}>
                        <Ionicons name="location" size={24} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.sectionTitle, boldStyle, { marginBottom: 2, fontSize: 16 }]}>
                            {t('schoolDetails.location')}
                        </Text>
                        <Text style={[textStyle, { fontSize: 14 }]} numberOfLines={2}>
                            {stats.schoolDoc?.location?.address || stats.schoolDoc?.locationLabel || stats.schoolDoc?.addressLabel || t('schoolDetails.noLocationSet')}
                        </Text>
                    </View>

                    {(stats.schoolDoc?.location || stats.schoolDoc?.locationLabel || stats.schoolDoc?.addressLabel) ? (
                        <TouchableOpacity
                            style={[styles.navigateBtn, { backgroundColor: colors.primary }]}
                            onPress={handleNavigate}
                        >
                            <Ionicons name="paper-plane" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        !isRestrictedAdmin && (
                            <TouchableOpacity
                                style={[styles.setBtnCompact, { backgroundColor: colors.primary }]}
                                onPress={handleOpenEditLocation}
                            >
                                <Ionicons name="add" size={24} color="#fff" />
                            </TouchableOpacity>
                        )
                    )}
                </View>

                {(!isRestrictedAdmin && (stats.schoolDoc?.location || stats.schoolDoc?.locationLabel || stats.schoolDoc?.addressLabel)) && (
                    <TouchableOpacity
                        style={[styles.editBtnSimple, { borderTopColor: colors.border }]}
                        onPress={handleOpenEditLocation}
                    >
                        <Ionicons name="create-outline" size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontFamily: fonts.bold, marginLeft: 6, fontSize: 13 }}>
                            {t('schoolDetails.editLocation')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Schedule Section */}
            <Text style={[styles.sectionTitle, boldStyle]}>{t('schoolDetails.weeklySchedule')}</Text>
            {stats.schoolSchedules.length === 0 ? (
                <Text style={[secondaryStyle, styles.empty]}>{t('schoolDetails.noSchedule')}</Text>
            ) : (
                stats.schoolSchedules.map(sch => (
                    <View key={sch.id} style={[styles.scheduleItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View>
                            <Text style={[boldStyle, { fontSize: 16 }]}>{t(`days.${DAY_MAP[sch.dayOfWeek]}`)}</Text>
                            <Text style={secondaryStyle}>{sch.startTime} - {sch.duration}h</Text>
                        </View>
                        {!isRestrictedAdmin && (
                            <TouchableOpacity onPress={() => deleteSchedule(sch.id)}>
                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))
            )}

            {/* History Section */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <Text style={[styles.sectionTitle, boldStyle, { marginBottom: 0 }]}>{t('schoolDetails.recentHistory')}</Text>
                {stats.schoolLogs.length > 5 && (
                    <TouchableOpacity onPress={() => router.push({ pathname: '/school-history' as any, params: { school: schoolName } })}>
                        <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>{t('common.viewAll')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {stats.schoolLogs.length === 0 ? (
                <Text style={[secondaryStyle, { textAlign: 'center', marginTop: 10 }]}>{t('schoolDetails.noHistoryYet')}</Text>
            ) : (
                stats.schoolLogs.slice(0, 5).map(log => (
                    <LogCard
                        key={log.id}
                        log={log}
                        onDelete={() => deleteLog(log.id)}
                        onEditNote={() => { setEditingLog(log); setNotesInput(log.notes || ''); }}
                        readOnly={isRestrictedAdmin}
                    />
                ))
            )}
        </ScrollView>
    );

    const renderStudents = () => (
        <View style={{ flex: 1 }}>
            {!isRestrictedAdmin && (
                <View style={styles.addSection}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]}
                        placeholder={t('students.newName')}
                        placeholderTextColor={colors.secondaryText}
                        value={newStudentName}
                        onChangeText={setNewStudentName}
                    />
                    <TouchableOpacity
                        style={[styles.addBtn, { backgroundColor: colors.primary }]}
                        onPress={handleAddStudent}
                        disabled={isSavingStudent}
                    >
                        {isSavingStudent ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={24} color="#fff" />}
                    </TouchableOpacity>
                </View>
            )}
            <FlatList
                data={students.filter(s => s.isActive)}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.studentName, { color: colors.text, fontFamily: fonts.bold }]}>{item.fullName}</Text>
                        {!isRestrictedAdmin && (
                            <TouchableOpacity onPress={() => deleteStudent(schoolIdParam!, item.id)}>
                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                ListEmptyComponent={<Text style={[secondaryStyle, { textAlign: 'center', marginTop: 40 }]}>{t('students.noStudents')}</Text>}
            />
        </View>
    );

    const renderGallery = () => {
        const photos = schoolGalleries[schoolName!] || [];
        return (
            <ScrollView contentContainerStyle={styles.tabContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={[styles.sectionTitle, boldStyle, { marginBottom: 0 }]}>{t('schoolDetails.gallery')}</Text>
                    <TouchableOpacity
                        style={[styles.miniAddBtn, { backgroundColor: colors.primary }]}
                        onPress={handleAddPhoto}
                        disabled={uploadingPhoto}
                    >
                        {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
                    </TouchableOpacity>
                </View>
                {photos.length === 0 ? (
                    <View style={styles.emptyGallery}>
                        <Ionicons name="images-outline" size={64} color={colors.secondaryText} />
                        <Text style={[secondaryStyle, { marginTop: 12, textAlign: 'center' }]}>{t('gallery.noPhotos')}</Text>
                    </View>
                ) : (
                    <View style={styles.galleryGrid}>
                        {photos.map((url, index) => (
                            <TouchableOpacity key={index} onPress={() => setSelectedImage(url)} style={styles.imageContainer}>
                                <Image source={{ uri: url }} style={styles.thumbnail} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[boldStyle, { fontSize: 20, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{schoolName}</Text>
                <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={styles.headerIcon}>
                    <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                {(['overview', 'students', 'gallery'] as TabType[]).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tabItem, activeTab === tab && { borderBottomColor: colors.primary }]}
                    >
                        <Text style={[
                            styles.tabText,
                            { fontFamily: activeTab === tab ? fonts.bold : fonts.regular },
                            { color: activeTab === tab ? colors.primary : colors.secondaryText }
                        ]}>
                            {t(`schoolDetails.${tab}`)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ flex: 1 }}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'students' && renderStudents()}
                {activeTab === 'gallery' && renderGallery()}
            </View>

            {activeTab === 'overview' && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={() => router.push({ pathname: '/add-lesson', params: { school: schoolName, mode: 'log' } })}
                >
                    <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>
            )}

            {/* Modals */}
            <Modal visible={showMoreMenu} transparent animationType="fade" onRequestClose={() => setShowMoreMenu(false)}>
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMoreMenu(false)}>
                    <View style={[styles.menuContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={handleOpenEditLocation}>
                            <Ionicons name="create-outline" size={20} color={colors.text} />
                            <Text style={[textStyle, { fontSize: 16 }]}>{t('schoolDetails.editLocation')}</Text>
                        </TouchableOpacity>
                        {(isOrgAdmin || isSuperAdmin) && (
                            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteSchoolConfirm}>
                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                                <Text style={[textStyle, { fontSize: 16, color: colors.error }]}>{t('schools.deleteSchool')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>


            <Modal visible={!!editingLog} transparent animationType="fade" onRequestClose={() => setEditingLog(null)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, boldStyle]}>{t('dashboard.editNote')}</Text>
                        <TextInput
                            style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }]}
                            placeholder={t('dashboard.notesPlaceholder')}
                            placeholderTextColor={colors.secondaryText}
                            value={notesInput}
                            onChangeText={setNotesInput}
                            multiline
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalBtn} onPress={() => setEditingLog(null)}>
                                <Text style={boldStyle}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={async () => {
                                if (editingLog) await updateLogNotes(editingLog.id, notesInput.trim());
                                setEditingLog(null);
                            }}>
                                <Text style={{ color: '#fff', fontFamily: fonts.bold }}>{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!selectedImage} transparent onRequestClose={() => setSelectedImage(null)} animationType="fade">
                <View style={styles.fullScreenModal}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <TouchableOpacity style={styles.deletePicButton} onPress={() => handleDeletePhotoConfirm(selectedImage)}>
                            <Ionicons name="trash" size={30} color="#ff4444" />
                        </TouchableOpacity>
                    )}
                    {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingBottom: 15, borderBottomWidth: 1 },
    headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 15, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: 14 },
    tabContent: { padding: 20, paddingBottom: 100 },
    statBox: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
    statValue: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    locationCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
    locationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    navigateBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    setBtnCompact: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    editBtnSimple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
    mapPreviewContainer: { height: 150, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    scheduleItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
    empty: { fontStyle: 'italic' },
    fab: { position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 100 : 60, paddingRight: 20 },
    menuContent: { width: 220, borderRadius: 12, borderWidth: 1, padding: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    textInput: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 100, fontSize: 16, marginBottom: 20 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, minWidth: 80, alignItems: 'center' },
    addSection: { flexDirection: 'row', padding: 20, gap: 12, alignItems: 'center' },
    input: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
    addBtn: { height: 50, width: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    studentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 8, borderWidth: 1, marginHorizontal: 20, marginBottom: 8 },
    studentName: { fontSize: 16 },
    miniAddBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    galleryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    imageContainer: { margin: IMAGE_MARGIN, width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 8, overflow: 'hidden' },
    thumbnail: { width: '100%', height: '100%' },
    emptyGallery: { paddingVertical: 60, alignItems: 'center' },
    fullScreenModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
    deletePicButton: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 },
    fullImage: { width: '100%', height: '80%' },
    mapModalContainer: { flex: 1 },
    mapModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, borderBottomWidth: 1 },
    locationLabelInput: { padding: 15, margin: 15, borderRadius: 10, borderWidth: 1, fontSize: 16 },
    mapInstruction: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 20 },
});
