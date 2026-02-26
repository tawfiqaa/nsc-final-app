import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, doc as firestoreDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
        let unsubscribe: () => void;

        const loadData = async () => {
            setLoading(true);

            // 1. Load from cache if viewing own data
            if (isOwnData) {
                try {
                    const cached = await AsyncStorage.getItem(STORAGE_KEYS.TEACHER_DATA);
                    if (cached) {
                        const data: TeacherData = JSON.parse(cached);
                        setSchedules(data.schedules || []);
                        setLogs(data.attendanceLogs || []);
                        setSchoolGalleries(data.schoolGalleries || {});
                    }
                } catch (e) {
                    console.error('Failed to load cached teacher data', e);
                }
            }

            // 2. Subscribe to Firestore
            try {
                const docRef = doc(db, 'teacherData', targetUid);
                unsubscribe = onSnapshot(docRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data() as TeacherData;
                        const serverSchedules = data.schedules || [];
                        const serverLogs = data.attendanceLogs || [];
                        const serverGalleries = data.schoolGalleries || {};

                        if (isOwnData) {
                            // Merge logic: Last write wins based on updatedAt
                            // We need access to current state, usually cumbersome in useEffect
                            // For simplicity in this prompt, we'll trust the server if it's newer or we force a merge 
                            // But to support "offline edits", we really should be careful.
                            // Simplified strategy: 
                            // If we have pending mutations (not impl fully here yet), keep ours.
                            // Else take server.
                            // Since we don't have a complex queue here yet, we will just update state and cache.

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
                            // Admin viewing others: just show server data
                            setSchedules(serverSchedules);
                            setLogs(serverLogs);
                            setSchoolGalleries(serverGalleries);
                        }
                    } else if (isOwnData) {
                        // Create if missing
                        await setDoc(docRef, {
                            ownerUid: targetUid,
                            schedules: [],
                            attendanceLogs: [],
                            schoolGalleries: {},
                            updatedAt: Date.now()
                        });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Firestore subscription error", error);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Error setting up subscription", error);
                setLoading(false);
            }
        };

        loadData();

        return () => {
            if (unsubscribe) unsubscribe();
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
            const currentData: TeacherData = cached ? JSON.parse(cached) : { ownerUid: user.uid, schedules: [], attendanceLogs: [], schoolGalleries: {}, updatedAt: Date.now() };
            const merged = { ...currentData, ...dataToMerge };
            await AsyncStorage.setItem(STORAGE_KEYS.TEACHER_DATA, JSON.stringify(merged));
        } catch (e) {
            console.error('Cache sync failed', e);
        }

        try {
            await setDoc(doc(db, 'teacherData', user.uid), dataToMerge, { merge: true });
        } catch (e) {
            console.error('Firestore sync failed', e);
            // In a real app, add to mutation queue here
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
        setSchedules(prev => {
            const updatedSchedules = [...prev, newSchedule];
            syncToFirestore({ schedules: updatedSchedules });
            return updatedSchedules;
        });
    };

    const addSchedules = async (scheduleDatas: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[]) => {
        const newSchedules: Schedule[] = scheduleDatas.map(scheduleData => ({
            ...scheduleData,
            id: firestoreDoc(collection(db, 'temp')).id,
            isActive: scheduleData.isActive !== undefined ? scheduleData.isActive : true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }));

        setSchedules(prev => {
            const updatedSchedules = [...prev, ...newSchedules];
            syncToFirestore({ schedules: updatedSchedules });
            return updatedSchedules;
        });
    };

    const updateSchedule = async (id: string, updates: Partial<Schedule>) => {
        setSchedules(prev => {
            const updatedSchedules = prev.map(s =>
                s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
            );
            syncToFirestore({ schedules: updatedSchedules });
            return updatedSchedules;
        });
    };

    const deleteSchedule = async (id: string) => {
        // Hard delete as requested
        setSchedules(prev => {
            const updatedSchedules = prev.filter(s => s.id !== id);
            syncToFirestore({ schedules: updatedSchedules });
            return updatedSchedules;
        });
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

        setLogs(prev => {
            const updatedLogs = [...prev, newLog];
            syncToFirestore({ attendanceLogs: updatedLogs });
            return updatedLogs;
        });
    };

    const addOneTimeLog = async (logData: Omit<AttendanceLog, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newLog: AttendanceLog = {
            ...logData,
            id: firestoreDoc(collection(db, 'temp')).id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        setLogs(prev => {
            const updatedLogs = [...prev, newLog];
            syncToFirestore({ attendanceLogs: updatedLogs });
            return updatedLogs;
        });
    };

    const toggleLogStatus = async (logId: string) => {
        setLogs(prev => {
            const logIndex = prev.findIndex(l => l.id === logId);
            if (logIndex === -1) return prev;

            const oldLog = prev[logIndex];
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

            const newLogs = [...prev];
            newLogs[logIndex] = updatedLog;
            syncToFirestore({ attendanceLogs: newLogs });
            return newLogs;
        });
    };

    const deleteLog = async (logId: string) => {
        setLogs(prev => {
            const updatedLogs = prev.filter(l => l.id !== logId);
            syncToFirestore({ attendanceLogs: updatedLogs });
            return updatedLogs;
        });
    };

    const updateLogNotes = async (logId: string, notes: string) => {
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

            setSchoolGalleries(prev => {
                const newGalleries = { ...prev };
                if (!newGalleries[schoolName]) {
                    newGalleries[schoolName] = [];
                }
                newGalleries[schoolName] = [...newGalleries[schoolName], downloadUrl];
                syncToFirestore({ schoolGalleries: newGalleries });
                return newGalleries;
            });
        } catch (error) {
            console.error("Upload failed", error);
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
            refresh,
            setTargetUid
        }}>
            {children}
        </LessonContext.Provider>
    );
};
