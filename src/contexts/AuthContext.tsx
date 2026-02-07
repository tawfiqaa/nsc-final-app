import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword, User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { AuthContextType, User } from '../types';
import { STORAGE_KEYS, SUPER_ADMIN_EMAILS } from '../utils/constants';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCachedUser();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                await fetchUserRole(firebaseUser);
            } else {
                setUser(null);
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadCachedUser = async () => {
        try {
            const cached = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
            if (cached) {
                setUser(JSON.parse(cached));
            }
        } catch (e) {
            console.error('Failed to load cached user', e);
        }
    };

    const fetchUserRole = async (firebaseUser: FirebaseUser) => {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);

            // Subscribe to real-time updates for role changes
            const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data() as User;
                    setUser(userData);
                    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userData));
                } else {
                    // Needed if the user doc is missing for some reason
                    console.warn("User doc missing for auth user");
                }
                setLoading(false);
            });
            return unsubscribe;

        } catch (error) {
            console.error('Error fetching user role:', error);
            setLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const register = async (email: string, password: string, name?: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const { uid } = userCredential.user;

        // Check if super admin
        const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

        const newUser: User = {
            uid,
            email,
            name: name || email.split('@')[0], // Default to part of email if no name
            role: isSuperAdmin ? 'super_admin' : 'pending',
            isApproved: isSuperAdmin, // Auto-approve super admin
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await setDoc(doc(db, 'users', uid), newUser);

        // Create empty teacherData doc if not super admin (or even if they are, just in case)
        // Actually, prompt says "create empty teacherData/{uid} doc (optional but recommended)"
        await setDoc(doc(db, 'teacherData', uid), {
            ownerUid: uid,
            schedules: [],
            attendanceLogs: [],
            updatedAt: Date.now(),
        });

        setUser(newUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newUser));
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
