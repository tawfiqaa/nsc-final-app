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
import { buildGoogleMapsUrl, openWaze } from '../../src/utils/navigationLinks';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - 40 - IMAGE_MARGIN * 2 * COLUMN_COUNT) / COLUMN_COUNT;

const DAYS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

type TabType = 'overview' | 'students' | 'gallery';

export default function SchoolDetailsScreen() {
    const { id } = useLocalSearchParams();
    const schoolIdParam = Array.isArray(id) ? id[0] : id;
    const { colors, fonts } = useTheme();
    const { user } = useAuth();
    const { membershipRole, activeOrgId, membershipStatus } = useOrg();
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

    useEffect(() => {
        if (isRestrictedAdmin) {
            router.replace('/(tabs)/admin');
        }
    }, [isRestrictedAdmin, router]);

    const orgMode = useMemo(() => !!activeOrgId && membershipStatus === 'approved', [activeOrgId, membershipStatus]);

    // UI States
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Overview states
    const [editingLog, setEditingLog] = useState<typeof logs[0] | null>(null);
    const [notesInput, setNotesInput] = useState('');
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [addrInput, setAddrInput] = useState('');
    const [latInput, setLatInput] = useState('');
    const [lngInput, setLngInput] = useState('');
    const [savingLocation, setSavingLocation] = useState(false);

    // Students states
    const [students, setStudents] = useState<Student[]>([]);
    const [newStudentName, setNewStudentName] = useState('');
    const [isSavingStudent, setIsSavingStudent] = useState(false);

    // Gallery states
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const schoolName = schoolIdParam; // Use param as name for identification

    const stats = useMemo(() => {
        const schoolSchedules = schedules.filter(s => s.school === schoolName);
        const schoolLogs = logs
            .filter(l => l.school === schoolName)
            .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

        const schoolDoc = schools.find(s => s.name === schoolName || s.id === schoolIdParam);

        const attendedCount = schoolLogs.filter(l => l.status === 'present').length;

        return {
            attendedCount,
            schoolSchedules,
            schoolLogs,
            schoolDoc
        };
    }, [schedules, logs, schools, schoolName, schoolIdParam]);

    // Fetch Students
    useEffect(() => {
        if (!user || !schoolIdParam || isRestrictedAdmin || activeTab !== 'students') return;

        let studentsRef;
        if (orgMode && activeOrgId) {
            studentsRef = collection(db, 'orgs', activeOrgId, 'schools', schoolIdParam, 'students');
        } else if (user.migratedToV2) {
            studentsRef = collection(db, 'users', user.uid, 'schools', schoolIdParam, 'students');
        } else {
            return;
        }

        const unsub = onSnapshot(studentsRef, (snap) => {
            const loadedStudents: Student[] = [];
            snap.forEach(d => {
                loadedStudents.push(d.data() as Student);
            });
            loadedStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
            setStudents(loadedStudents);
        });

        return () => unsub();
    }, [user, schoolIdParam, orgMode, activeOrgId, isRestrictedAdmin, activeTab]);

    if (isRestrictedAdmin) return null;

    const boldStyle = { fontFamily: fonts.bold, color: colors.text };
    const textStyle = { fontFamily: fonts.regular, color: colors.text };
    const secondaryStyle = { fontFamily: fonts.regular, color: colors.secondaryText };

    // Handlers
    const handleEditNote = (log: typeof logs[0]) => {
        setEditingLog(log);
        setNotesInput(log.notes || '');
    };

    const confirmEditNote = async () => {
        if (!editingLog) return;
        await updateLogNotes(editingLog.id, notesInput.trim());
        setEditingLog(null);
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
                            Alert.alert(t('common.error'), t('common.deleteFailed') || "Failed");
                        }
                    }
                }
            ]
        );
    };

    const handleOpenEditLocation = () => {
        setShowMoreMenu(false);
        setAddrInput(stats.schoolDoc?.addressLabel || '');
        setLatInput(stats.schoolDoc?.location?.lat?.toString() || '');
        setLngInput(stats.schoolDoc?.location?.lng?.toString() || '');
        setShowLocationModal(true);
    };

    const handleSaveLocation = async () => {
        if (!addrInput.trim()) {
            Alert.alert(t('common.error'), t('addLesson.schoolRequired'));
            return;
        }

        let location = null;
        if (latInput.trim() || lngInput.trim()) {
            const lat = parseFloat(latInput);
            const lng = parseFloat(lngInput);
            if (isNaN(lat) || isNaN(lng)) {
                Alert.alert(t('common.error'), t('schoolDetails.invalidCoordinates'));
                return;
            }
            location = { lat, lng };
        }

        setSavingLocation(true);
        try {
            const schoolId = stats.schoolDoc?.id || schoolIdParam!;
            await updateSchoolLocation(schoolId, { addressLabel: addrInput.trim(), location });
            setShowLocationModal(false);
        } catch (e) {
            Alert.alert(t('common.error'), "Failed to save location");
        } finally {
            setSavingLocation(false);
        }
    };

    const handleAddStudent = async () => {
        const name = newStudentName.trim();
        if (!name) return;
        if (!user || !schoolIdParam) return;
        if (!orgMode && !user.migratedToV2) return;

        setIsSavingStudent(true);
        try {
            const studentsCol = orgMode && activeOrgId
                ? collection(db, 'orgs', activeOrgId, 'schools', schoolIdParam, 'students')
                : collection(db, 'users', user.uid, 'schools', schoolIdParam, 'students');
            const studentRef = doc(studentsCol);
            const newStudent: Student = {
                id: studentRef.id,
                fullName: name,
                isActive: true,
                createdAt: Date.now(),
            };
            await setDoc(studentRef, newStudent);
            setNewStudentName('');
        } catch (error) {
            console.error('Failed to add student', error);
            Alert.alert(t('common.error'), t('students.addFailed'));
        } finally {
            setIsSavingStudent(false);
        }
    };

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
            setUploadingPhoto(true);
            try {
                await addSchoolPhoto(schoolName!, uri);
            } catch (error) {
                console.error(error);
                Alert.alert(t('gallery.uploadFailed'), t('gallery.uploadError'));
            } finally {
                setUploadingPhoto(false);
            }
        }
    };

    const handleDeletePhotoConfirm = (url: string) => {
        Alert.alert(
            t('gallery.deletePhoto'),
            t('gallery.deletePhotoConfirm'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('common.delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setUploadingPhoto(true);
                            await deleteSchoolPhoto(schoolName!, url);
                            setSelectedImage(null);
                        } catch (error) {
                            Alert.alert(t('common.error'), t('common.error'));
                        } finally {
                            setUploadingPhoto(false);
                        }
                    }
                }
            ]
        );
    };

    // Render Components
    const renderOverview = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            {/* Lessons count card */}
            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.primary, fontFamily: fonts.bold }]}>{stats.attendedCount}</Text>
                <Text style={[secondaryStyle, { fontSize: 12 }]}>{t('history.lessons')}</Text>
            </View>

            {/* Location Card */}
            <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.locationHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionTitle, boldStyle, { marginBottom: 4 }]}>{t('schoolDetails.location')}</Text>
                        <Text style={[textStyle, { fontSize: 14 }]} numberOfLines={2}>
                            {stats.schoolDoc?.addressLabel || t('schoolDetails.noLocationSet')}
                        </Text>
                    </View>
                </View>

                <View style={styles.navButtons}>
                    <TouchableOpacity
                        style={[styles.navBtn, { borderColor: colors.border }]}
                        onPress={() => {
                            const url = buildGoogleMapsUrl({
                                addressLabel: stats.schoolDoc?.addressLabel,
                                location: stats.schoolDoc?.location
                            });
                            if (url) Linking.openURL(url);
                        }}
                    >
                        <Ionicons name="map-outline" size={18} color={colors.text} />
                        <Text style={[textStyle, { fontSize: 13 }]}>{t('schoolDetails.openInGoogleMaps')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navBtn, { borderColor: colors.border }]}
                        onPress={() => openWaze({
                            addressLabel: stats.schoolDoc?.addressLabel,
                            location: stats.schoolDoc?.location
                        })}
                    >
                        <Ionicons name="navigate-outline" size={18} color={colors.text} />
                        <Text style={[textStyle, { fontSize: 13 }]}>{t('schoolDetails.openInWaze')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Weekly Schedule */}
            <Text style={[boldStyle, { fontSize: 18, marginBottom: 16 }]}>{t('schoolDetails.weeklySchedule')}</Text>
            {stats.schoolSchedules.length === 0 ? (
                <Text style={[styles.empty, secondaryStyle, { marginBottom: 24 }]}>{t('schoolDetails.noRecurringSchedules')}</Text>
            ) : (
                <View style={{ marginBottom: 24 }}>
                    {stats.schoolSchedules.map(sched => (
                        <View key={sched.id} style={[styles.scheduleItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[boldStyle]}>
                                    {t(`days.${DAYS_KEYS[sched.dayOfWeek]}`)}
                                    {sched.isActive === false && <Text style={{ color: colors.error, fontFamily: fonts.bold }}> ({t('schoolDetails.inactive')})</Text>}
                                </Text>
                                <Text style={textStyle}>{sched.startTime} ({sched.duration}h)</Text>
                                <Text style={secondaryStyle}>{sched.distance}km</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <TouchableOpacity onPress={() => router.push({ pathname: '/add-lesson', params: { scheduleId: sched.id } })}>
                                    <Ionicons name="pencil" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    Alert.alert(
                                        t('editLesson.deleteSchedule'),
                                        t('editLesson.deleteScheduleConfirm'),
                                        [
                                            { text: t('common.cancel'), style: "cancel" },
                                            { text: t('common.delete'), style: "destructive", onPress: () => deleteSchedule(sched.id) }
                                        ]
                                    );
                                }}>
                                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Recent History */}
            <Text style={[boldStyle, { fontSize: 18, marginBottom: 16 }]}>{t('schoolDetails.recentHistory')}</Text>
            {stats.schoolLogs.length === 0 ? (
                <Text style={[styles.empty, secondaryStyle]}>{t('schoolDetails.noHistoryYet')}</Text>
            ) : (
                stats.schoolLogs.map(log => (
                    <LogCard
                        key={log.id}
                        log={log}
                        onDelete={() => {
                            Alert.alert(t('schoolDetails.confirmDeletion'), t('schoolDetails.deleteLogConfirm'), [
                                { text: t('common.cancel'), style: "cancel" },
                                { text: t('common.delete'), style: "destructive", onPress: () => deleteLog(log.id) }
                            ]);
                        }}
                        onEditNote={() => handleEditNote(log)}
                        deleteType="icon"
                    />
                ))
            )}
        </ScrollView>
    );

    const renderStudents = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.addSection}>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, fontFamily: fonts.regular }]}
                    placeholder={t('students.newName')}
                    placeholderTextColor={colors.secondaryText}
                    value={newStudentName}
                    onChangeText={setNewStudentName}
                    onSubmitEditing={handleAddStudent}
                />
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary }, (!newStudentName.trim() || isSavingStudent) && { opacity: 0.5 }]}
                    onPress={handleAddStudent}
                    disabled={!newStudentName.trim() || isSavingStudent}
                >
                    {isSavingStudent ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="add" size={24} color="#fff" />}
                </TouchableOpacity>
            </View>

            <FlatList
                data={students.filter(s => s.isActive)}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.studentName, { color: colors.text, fontFamily: fonts.bold }]}>{item.fullName}</Text>
                        <TouchableOpacity onPress={async () => {
                            Alert.alert(
                                t('students.deleteStudent'),
                                t('students.deleteStudentConfirm', { studentName: item.fullName }),
                                [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                        text: t('common.delete'), style: 'destructive', onPress: async () => {
                                            try {
                                                await deleteStudent(schoolIdParam!, item.id);
                                            } catch (error) {
                                                Alert.alert(t('common.error'), t('students.deleteFailed'));
                                            }
                                        }
                                    }
                                ]
                            );
                        }}>
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                    </View>
                )}
                ListHeaderComponent={<Text style={[styles.sectionTitle, boldStyle, { marginHorizontal: 20 }]}>{t('students.activeRoster')}</Text>}
                ListEmptyComponent={<Text style={[styles.empty, secondaryStyle, { marginHorizontal: 20 }]}>{t('students.noActive')}</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListFooterComponent={
                    students.filter(s => !s.isActive).length > 0 ? (
                        <View style={{ marginTop: 24, marginHorizontal: 20 }}>
                            <Text style={[styles.sectionTitle, { color: colors.secondaryText, fontFamily: fonts.bold }]}>{t('students.archived')}</Text>
                            {students.filter(s => !s.isActive).map(student => (
                                <View key={student.id} style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.7 }]}>
                                    <Text style={[styles.studentName, { color: colors.text, fontFamily: fonts.bold }]}>{student.fullName}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null
                }
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
                            <TouchableOpacity
                                key={index}
                                onPress={() => setSelectedImage(url)}
                                style={styles.imageContainer}
                            >
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
            {/* Custom Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[boldStyle, { fontSize: 20, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{schoolName}</Text>
                <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={styles.headerIcon}>
                    <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                {(['overview', 'students', 'gallery'] as TabType[]).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[
                            styles.tabItem,
                            activeTab === tab && { borderBottomColor: colors.primary }
                        ]}
                    >
                        <Text style={[
                            styles.tabText,
                            { fontFamily: activeTab === tab ? fonts.bold : fonts.regular },
                            { color: activeTab === tab ? colors.primary : colors.secondaryText }
                        ]}>
                            {t(`schoolDetails.${tab}`) || t(`tabs.${tab}`) || tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab Content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'students' && renderStudents()}
                {activeTab === 'gallery' && renderGallery()}
            </View>

            {/* FAB */}
            {activeTab === 'overview' && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={() => router.push({ pathname: '/add-lesson', params: { school: schoolName, mode: 'log' } })}
                >
                    <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>
            )}

            {/* More Menu Modal */}
            <Modal
                visible={showMoreMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMoreMenu(false)}
            >
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMoreMenu(false)}
                >
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

            {/* Edit Location Modal */}
            <Modal
                visible={showLocationModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowLocationModal(false)}
            >
                <View style={[styles.modalOverlay, { padding: 20 }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, boldStyle]}>{t('schoolDetails.editLocation')}</Text>

                        <Text style={[secondaryStyle, { marginBottom: 4, fontSize: 12 }]}>{t('schoolDetails.addressLabel')}</Text>
                        <TextInput
                            style={[
                                styles.textInputSingle,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                            ]}
                            placeholder="e.g. 123 Main St, Haifa"
                            placeholderTextColor={colors.secondaryText}
                            value={addrInput}
                            onChangeText={setAddrInput}
                        />

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[secondaryStyle, { marginBottom: 4, fontSize: 12 }]}>{t('schoolDetails.latitude')}</Text>
                                <TextInput
                                    style={[
                                        styles.textInputSingle,
                                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                                    ]}
                                    placeholder="32.1234"
                                    placeholderTextColor={colors.secondaryText}
                                    value={latInput}
                                    onChangeText={setLatInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[secondaryStyle, { marginBottom: 4, fontSize: 12 }]}>{t('schoolDetails.longitude')}</Text>
                                <TextInput
                                    style={[
                                        styles.textInputSingle,
                                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                                    ]}
                                    placeholder="34.1234"
                                    placeholderTextColor={colors.secondaryText}
                                    value={lngInput}
                                    onChangeText={setLngInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                                onPress={() => setShowLocationModal(false)}
                            >
                                <Text style={[boldStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={handleSaveLocation}
                                disabled={savingLocation}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600', fontFamily: fonts.bold }}>
                                    {savingLocation ? t('common.saving') : t('common.save')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Note Edit Modal */}
            <Modal
                visible={!!editingLog}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEditingLog(null)}
            >
                <View style={[styles.modalOverlay, { padding: 20 }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, boldStyle]}>{editingLog?.notes ? t('dashboard.editNote') : t('dashboard.addNote')}</Text>

                        <TextInput
                            style={[
                                styles.textInput,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.regular }
                            ]}
                            placeholder={t('dashboard.notesPlaceholder')}
                            placeholderTextColor={colors.secondaryText}
                            value={notesInput}
                            onChangeText={setNotesInput}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                                onPress={() => setEditingLog(null)}
                            >
                                <Text style={[boldStyle, { fontWeight: '600' }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={confirmEditNote}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600', fontFamily: fonts.bold }}>{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full Screen Image Modal */}
            <Modal
                visible={!!selectedImage}
                transparent={true}
                onRequestClose={() => setSelectedImage(null)}
                animationType="fade"
            >
                <View style={styles.fullScreenModal}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <TouchableOpacity style={styles.deletePicButton} onPress={() => handleDeletePhotoConfirm(selectedImage)}>
                            <Ionicons name="trash" size={30} color="#ff4444" />
                        </TouchableOpacity>
                    )}
                    {selectedImage && (
                        <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
    },
    headerIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 14,
    },
    tabContent: {
        padding: 20,
        paddingBottom: 100,
    },
    statBox: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 20,
    },
    statValue: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    locationCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginBottom: 24,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    navButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    navBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    scheduleItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 8,
    },
    empty: {
        fontStyle: 'italic',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    // Menu
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: Platform.OS === 'ios' ? 100 : 60,
        paddingRight: 20,
    },
    menuContent: {
        width: 200,
        borderRadius: 12,
        borderWidth: 1,
        padding: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        minHeight: 100,
        fontSize: 16,
        marginBottom: 20,
    },
    textInputSingle: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    // Students
    addSection: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 50,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    addBtn: {
        height: 50,
        width: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    studentCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        marginHorizontal: 20,
        marginBottom: 8,
    },
    studentName: {
        fontSize: 16,
    },
    // Gallery
    miniAddBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryGrid: {
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
    emptyGallery: {
        paddingVertical: 60,
        alignItems: 'center',
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
    deletePicButton: {
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
