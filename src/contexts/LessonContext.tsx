import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, doc as firestoreDoc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
import { AttendanceLog, AttendanceStatus, LessonContextType, Schedule, TeacherData } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { useAuth } from './AuthContext';

const LessonContext = createContext<LessonContextType | undefined>(undefined);

export const useLesson = () => {
    const context = useContext(LessonContext);
    if (!context) {
        throw new Error('useLesson must be used within a LessonProvider');
    }
    return context;
};

export const LessonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [schoolGalleries, setSchoolGalleries] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [targetUid, setTargetUid] = useState<string | null>(null);
    const [isTargetMigrated, setIsTargetMigrated] = useState<boolean>(false);

    // Initial load logic
    useEffect(() => {
        if (!user) {
            setSchedules([]);
            setLogs([]);
            setSchoolGalleries({});
            setLoading(false);
            return;
        }

        // Default to current user
        setTargetUid(user.uid);
    }, [user]);

    // Load data when targetUid or user changes
    useEffect(() => {
        if (!user || !targetUid) return;

        const isOwnData = user.uid === targetUid;
        const unsubs: (() => void)[] = [];
        let isMounted = true;

        const loadData = async () => {
            setLoading(true);

            // 1. Load from cache if viewing own data
            if (isOwnData && !user.migratedToV2) {
                try {
                    const cached = await AsyncStorage.getItem(STORAGE_KEYS.TEACHER_DATA);
                    if (cached) {
                        const data: TeacherData = JSON.parse(cached);
                        if (isMounted) {
                            setSchedules(data.schedules || []);
                            setLogs(data.attendanceLogs || []);
                            setSchoolGalleries(data.schoolGalleries || {});
                        }
                    }
                } catch (e) {
                    console.error('Failed to load cached teacher data', e);
                }
            }

            // 2. Subscribe to Firestore
            try {
                let targetMigrated = user.migratedToV2;
                if (!isOwnData) {
                    const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
                    if (targetUserSnap.exists()) {
                        targetMigrated = targetUserSnap.data().migratedToV2 === true;
                    } else {
                        targetMigrated = false;
                    }
                }
                if (isMounted) {
                    setIsTargetMigrated(targetMigrated || false);
                }

                if (targetMigrated) {
                    // --- V2 Subcollections ---
                    const schedulesRef = collection(db, 'users', targetUid, 'schedules');
                    const lessonsRef = collection(db, 'users', targetUid, 'lessons');
                    const schoolsRef = collection(db, 'users', targetUid, 'schools');

                    // Optimize logs query: last 90 days (approx)
                    const ninetyDaysAgo = new Date();
                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                    const lessonsQuery = query(lessonsRef, where('createdAt', '>=', ninetyDaysAgo.getTime()));

                    // We will not cache V2 in AsyncStorage for now, rely on Firestore offline persistence 
                    // or implement a separate V2 cache later if needed for Expo.

                    const unsubSchedules = onSnapshot(schedulesRef, (snap) => {
                        const loadedSchedules: Schedule[] = [];
                        snap.forEach(d => loadedSchedules.push(d.data() as Schedule));
                        if (isMounted) setSchedules(loadedSchedules);
                    });
                    unsubs.push(unsubSchedules);

                    // Note: We query lessons, but if they need full history we might need pagination.
                    // For now, this limits to 90 days.
                    const unsubLessons = onSnapshot(lessonsQuery, (snap) => {
                        const loadedLogs: AttendanceLog[] = [];
                        snap.forEach(d => loadedLogs.push(d.data() as AttendanceLog));
                        if (isMounted) setLogs(loadedLogs);
                    });
                    unsubs.push(unsubLessons);

                    const unsubSchools = onSnapshot(schoolsRef, (snap) => {
                        const mappedGalleries: Record<string, string[]> = {};
                        snap.forEach(d => {
                            const data = d.data();
                            mappedGalleries[data.name] = data.gallery || [];
                        });
                        if (isMounted) setSchoolGalleries(mappedGalleries);
                    });
                    unsubs.push(unsubSchools);
                    if (isMounted) setLoading(false);

                } else {
                    // --- Legacy TeacherData ---
                    const docRef = doc(db, 'teacherData', targetUid);
                    const unsub = onSnapshot(docRef, async (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data() as TeacherData;
                            const serverSchedules = data.schedules || [];
                            const serverLogs = data.attendanceLogs || [];
                            const serverGalleries = data.schoolGalleries || {};

                            if (isOwnData) {
                                setSchedules(serverSchedules);
                                setLogs(serverLogs);
                                setSchoolGalleries(serverGalleries);

                                await AsyncStorage.setItem(STORAGE_KEYS.TEACHER_DATA, JSON.stringify({
                                    ownerUid: targetUid,
                                    schedules: serverSchedules,
                                    attendanceLogs: serverLogs,
                                    schoolGalleries: serverGalleries,
                                    updatedAt: Date.now()
                                }));
                            } else {
                                setSchedules(serverSchedules);
                                setLogs(serverLogs);
                                setSchoolGalleries(serverGalleries);
                            }
                        } else if (isOwnData) {
                            await setDoc(docRef, {
                                ownerUid: targetUid,
                                schedules: [],
                                attendanceLogs: [],
                                schoolGalleries: {},
                                updatedAt: Date.now()
                            });
                        }
                        if (isMounted) setLoading(false);
                    }, (error) => {
                        console.error("Firestore subscription error", error);
                        if (isMounted) setLoading(false);
                    });
                    unsubs.push(unsub);
                }
            } catch (error) {
                console.error("Error setting up subscription", error);
                if (isMounted) setLoading(false);
            }
        };

        loadData();

        return () => {
            isMounted = false;
            unsubs.forEach(unsub => unsub());
        };
    }, [user, targetUid]);

    // Helper to sync to Firestore
    const syncToFirestore = async (updates: Partial<TeacherData>) => {
        if (!user || !targetUid || user.uid !== targetUid) return;

        const dataToMerge: Partial<TeacherData> = {
            ...updates,
            updatedAt: Date.now()
        };

        // Optimistic update local storage
        try {
            const cached = await AsyncStorage.getItem(STORAGE_KEYS.TEACHER_DATA);
            if (cached) {
                const currentData: TeacherData = JSON.parse(cached);
                const merged = { ...currentData, ...dataToMerge };
                await AsyncStorage.setItem(STORAGE_KEYS.TEACHER_DATA, JSON.stringify(merged));
            }
        } catch (e) {
            console.error('Cache sync failed', e);
        }

        try {
            // Only send the specific updates to Firestore, not the full cache.
            // JSON.parse(JSON.stringify()) strips out any `undefined` values that Firestore rejects.
            const cleanDataToMerge = JSON.parse(JSON.stringify(dataToMerge));
            await setDoc(doc(db, 'teacherData', user.uid), cleanDataToMerge, { merge: true });
        } catch (e) {
            console.error('Firestore sync failed', e);
        }
    };

    const addSchedule = async (scheduleData: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newSchedule: Schedule = {
            ...scheduleData,
            id: firestoreDoc(collection(db, 'temp')).id,
            isActive: scheduleData.isActive !== undefined ? scheduleData.isActive : true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        if (isTargetMigrated) {
            await setDoc(doc(db, 'users', targetUid!, 'schedules', newSchedule.id), newSchedule);
        } else {
            setSchedules(prev => {
                const updatedSchedules = [...prev, newSchedule];
                syncToFirestore({ schedules: updatedSchedules });
                return updatedSchedules;
            });
        }
    };

    const addSchedules = async (scheduleDatas: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[]) => {
        const newSchedules: Schedule[] = scheduleDatas.map(scheduleData => ({
            ...scheduleData,
            id: firestoreDoc(collection(db, 'temp')).id,
            isActive: scheduleData.isActive !== undefined ? scheduleData.isActive : true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }));

        if (isTargetMigrated) {
            // Should theoretically use batch for multiple, but loop is okay for small arrays since we're offline capable
            await Promise.all(newSchedules.map(ns => setDoc(doc(db, 'users', targetUid!, 'schedules', ns.id), ns)));
        } else {
            setSchedules(prev => {
                const updatedSchedules = [...prev, ...newSchedules];
                syncToFirestore({ schedules: updatedSchedules });
                return updatedSchedules;
            });
        }
    };

    const updateSchedule = async (id: string, updates: Partial<Schedule>) => {
        if (isTargetMigrated) {
            await setDoc(doc(db, 'users', targetUid!, 'schedules', id), { ...updates, updatedAt: Date.now() }, { merge: true });
        } else {
            setSchedules(prev => {
                const updatedSchedules = prev.map(s =>
                    s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
                );
                syncToFirestore({ schedules: updatedSchedules });
                return updatedSchedules;
            });
        }
    };

    const deleteSchedule = async (id: string) => {
        // Hard delete as requested
        if (isTargetMigrated) {
            await deleteDoc(doc(db, 'users', targetUid!, 'schedules', id));
        } else {
            setSchedules(prev => {
                const updatedSchedules = prev.filter(s => s.id !== id);
                syncToFirestore({ schedules: updatedSchedules });
                return updatedSchedules;
            });
        }
    };

    const markAttendance = async (schedule: Schedule, status: AttendanceStatus, dateISO: string, notes?: string) => {
        const todayKey = new Date(dateISO).toISOString().split('T')[0];

        const newLog: AttendanceLog = {
            id: firestoreDoc(collection(db, 'temp')).id,
            scheduleId: schedule.id,
            school: schedule.school,
            dateISO: dateISO,
            localDayKey: todayKey, // Simplified day key
            status: status,
            hours: status === 'present' ? schedule.duration : 0,
            distance: status === 'present' ? schedule.distance : 0,
            notes: notes,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        if (isTargetMigrated) {
            await setDoc(doc(db, 'users', targetUid!, 'lessons', newLog.id), newLog);
        } else {
            setLogs(prev => {
                const updatedLogs = [...prev, newLog];
                syncToFirestore({ attendanceLogs: updatedLogs });
                return updatedLogs;
            });
        }
    };

    const addOneTimeLog = async (logData: Omit<AttendanceLog, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newLog: AttendanceLog = {
            ...logData,
            id: firestoreDoc(collection(db, 'temp')).id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        if (isTargetMigrated) {
            await setDoc(doc(db, 'users', targetUid!, 'lessons', newLog.id), newLog);
        } else {
            setLogs(prev => {
                const updatedLogs = [...prev, newLog];
                syncToFirestore({ attendanceLogs: updatedLogs });
                return updatedLogs;
            });
        }
    };

    const toggleLogStatus = async (logId: string) => {
        const oldLog = logs.find(l => l.id === logId);
        if (!oldLog) return;

        const newStatus: AttendanceStatus = oldLog.status === 'present' ? 'absent' : 'present';

        let newHours = 0;
        let newDistance = 0;

        if (newStatus === 'present') {
            if (oldLog.scheduleId) {
                const sched = schedules.find(s => s.id === oldLog.scheduleId);
                if (sched) {
                    newHours = sched.duration;
                    newDistance = sched.distance;
                }
            }
        }

        const updatedLog: AttendanceLog = {
            ...oldLog,
            status: newStatus,
            hours: newHours,
            distance: newDistance,
            updatedAt: Date.now()
        };

        if (isTargetMigrated) {
            await setDoc(doc(db, 'users', targetUid!, 'lessons', logId), updatedLog, { merge: true });
        } else {
            setLogs(prev => {
                const logIndex = prev.findIndex(l => l.id === logId);
                if (logIndex === -1) return prev;
                const newLogs = [...prev];
                newLogs[logIndex] = updatedLog;
                syncToFirestore({ attendanceLogs: newLogs });
                return newLogs;
            });
        }
    };

    const deleteLog = async (logId: string) => {
        if (isTargetMigrated) {
            await deleteDoc(doc(db, 'users', targetUid!, 'lessons', logId));
        } else {
            setLogs(prev => {
                const updatedLogs = prev.filter(l => l.id !== logId);
                syncToFirestore({ attendanceLogs: updatedLogs });
                return updatedLogs;
            });
        }
    };

    const updateLogNotes = async (logId: string, notes: string) => {
        if (isTargetMigrated) {
            await setDoc(doc(db, 'users', targetUid!, 'lessons', logId), { notes, updatedAt: Date.now() }, { merge: true });
        } else {
            setLogs(prev => {
                const logIndex = prev.findIndex(l => l.id === logId);
                if (logIndex === -1) return prev;

                const newLogs = [...prev];
                newLogs[logIndex] = {
                    ...newLogs[logIndex],
                    notes: notes,
                    updatedAt: Date.now(),
                };
                syncToFirestore({ attendanceLogs: newLogs });
                return newLogs;
            });
        }
    };

    const addSchoolPhoto = async (schoolName: string, localUri: string) => {
        if (!user || user.uid !== targetUid) return;
        try {
            const response = await fetch(localUri);
            const blob = await response.blob();
            // We use Date.now() as part of filename to avoid collisions 
            const filename = `${Date.now()}_${localUri.split('/').pop() || 'photo.jpg'}`;
            const fileRef = ref(storage, `users/${user.uid}/galleries/${schoolName}/${filename}`);
            await uploadBytes(fileRef, blob);
            const downloadUrl = await getDownloadURL(fileRef);

            if (isTargetMigrated) {
                // V2: Add to users/{uid}/schools/{schoolName}
                const newGalleries = { ...schoolGalleries };
                const updatedGallery = [...(newGalleries[schoolName] || []), downloadUrl];
                await setDoc(doc(db, 'users', targetUid!, 'schools', schoolName), { name: schoolName, gallery: updatedGallery, updatedAt: Date.now() }, { merge: true });
            } else {
                setSchoolGalleries(prev => {
                    const newGalleries = { ...prev };
                    if (!newGalleries[schoolName]) {
                        newGalleries[schoolName] = [];
                    }
                    newGalleries[schoolName] = [...newGalleries[schoolName], downloadUrl];
                    syncToFirestore({ schoolGalleries: newGalleries });
                    return newGalleries;
                });
            }
        } catch (error) {
            console.error("Upload failed", error);
            throw error;
        }
    };

    const deleteSchoolPhoto = async (schoolName: string, photoUrl: string) => {
        if (!user || user.uid !== targetUid) return;
        try {
            const fileRef = ref(storage, photoUrl);
            await deleteObject(fileRef);

            if (user?.migratedToV2) {
                const newGalleries = { ...schoolGalleries };
                if (newGalleries[schoolName]) {
                    const updatedGallery = newGalleries[schoolName].filter(url => url !== photoUrl);
                    await setDoc(doc(db, 'users', targetUid!, 'schools', schoolName), { gallery: updatedGallery, updatedAt: Date.now() }, { merge: true });
                }
            } else {
                setSchoolGalleries(prev => {
                    const newGalleries = { ...prev };
                    if (newGalleries[schoolName]) {
                        newGalleries[schoolName] = newGalleries[schoolName].filter(url => url !== photoUrl);
                        syncToFirestore({ schoolGalleries: newGalleries });
                    }
                    return newGalleries;
                });
            }
        } catch (error) {
            console.error("Delete failed", error);
            throw error;
        }
    };

    const refresh = async () => {
        // Force re-fetch logic if needed, mostly handled by snapshot
    };

    return (
        <LessonContext.Provider value={{
            schedules,
            logs,
            schoolGalleries,
            loading,
            addSchedule,
            addSchedules,
            updateSchedule,
            deleteSchedule,
            markAttendance,
            addOneTimeLog,
            toggleLogStatus,
            updateLogNotes,
            deleteLog,
            addSchoolPhoto,
            deleteSchoolPhoto,
            refresh,
            setTargetUid
        }}>
            {children}
        </LessonContext.Provider>
    );
};
