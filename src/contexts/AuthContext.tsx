import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { createUserWithEmailAndPassword, User as FirebaseUser, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import i18n, { applyRTLLogic, LANGUAGE_KEY } from '../i18n/i18n';
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

                    // Sync language from Firestore
                    const dbLang = userData.settings?.ui?.language;
                    if (dbLang && i18n.language !== dbLang) {
                        const currentIsRTL = i18n.language === 'he' || i18n.language === 'ar';
                        const newIsRTL = dbLang === 'he' || dbLang === 'ar';

                        await i18n.changeLanguage(dbLang);
                        await AsyncStorage.setItem(LANGUAGE_KEY, dbLang);

                        if (currentIsRTL !== newIsRTL && Platform.OS !== 'web') {
                            applyRTLLogic(dbLang);
                            // We might need to reload here, but be careful with loops
                            // Usually, if it's during initial load, we don't reload if we can avoid it
                            // But if the app already started with wrong RTL, we MUST reload.
                            Updates.reloadAsync();
                        } else {
                            applyRTLLogic(dbLang);
                        }
                    }
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

    const loginWithGoogle = async (idToken: string) => {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const firebaseUser = userCredential.user;
        const uid = firebaseUser.uid;

        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);

        let newUser: User;

        if (!docSnap.exists()) {
            // Create new user if not exists
            const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(firebaseUser.email!.toLowerCase());
            newUser = {
                uid,
                email: firebaseUser.email!,
                name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
                role: isSuperAdmin ? 'super_admin' : 'teacher',
                isApproved: true,
                isSuperAdmin: isSuperAdmin || undefined,
                migratedToV2: true,
                migrationVersion: 2,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            // Remove undefined fields to avoid Firestore errors
            if (!isSuperAdmin) delete (newUser as any).isSuperAdmin;
            await setDoc(docRef, newUser);

            // We don't need to create empty teacherData doc for V2 users
            // unless we really want to, but it's not strictly necessary. 
            // We'll leave it out for V2 to cleanly cut over.
        } else {
            // Update existing user with name if missing? Or just load it.
            // Let's just load it or ensure name is synced if valid.
            const existingData = docSnap.data() as User;
            // If name is missing in DB but exists in Google, maybe update?
            // For now just use existing.
            newUser = existingData;
            if (!newUser.name && firebaseUser.displayName) {
                await setDoc(docRef, { name: firebaseUser.displayName }, { merge: true });
                newUser.name = firebaseUser.displayName;
            }
        }

        setUser(newUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newUser));
    };

    const register = async (email: string, password: string, name?: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const { uid } = userCredential.user;

        // Check if super admin
        const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

        const newUser: User = {
            uid,
            email,
            name: name || email.split('@')[0],
            role: isSuperAdmin ? 'super_admin' : 'teacher',
            isApproved: true,
            isSuperAdmin: isSuperAdmin || undefined,
            migratedToV2: true,
            migrationVersion: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        // Remove undefined fields to avoid Firestore errors
        const userToSave = { ...newUser };
        if (!isSuperAdmin) delete (userToSave as any).isSuperAdmin;
        await setDoc(doc(db, 'users', uid), userToSave);

        // Empty teacherData is not needed for new V2 users

        setUser(newUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newUser));
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
