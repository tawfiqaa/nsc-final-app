import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { createUserWithEmailAndPassword, User as FirebaseUser, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
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

                    // If authEmail is missing, sync it
                    if (!userData.authEmail && firebaseUser.email) {
                        await setDoc(userDocRef, {
                            authEmail: firebaseUser.email,
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    }

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
                            Updates.reloadAsync();
                        } else {
                            applyRTLLogic(dbLang);
                        }
                    }
                } else {
                    // Create new user if not exists (e.g. email/password login first time)
                    console.log("Creating missing user doc for:", firebaseUser.email);
                    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(firebaseUser.email?.toLowerCase() || '');
                    const newUser: User = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        authEmail: firebaseUser.email || '',
                        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
                        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
                        role: isSuperAdmin ? 'super_admin' : 'teacher',
                        isApproved: true,
                        isSuperAdmin: isSuperAdmin || undefined,
                        migratedToV2: true,
                        migrationVersion: 2,
                        createdAt: Date.now(),
                        updatedAt: Date.now() as any,
                    };
                    const userToSave = { ...newUser };
                    if (!isSuperAdmin) delete (userToSave as any).isSuperAdmin;
                    await setDoc(userDocRef, { ...userToSave, updatedAt: serverTimestamp() });
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
                authEmail: firebaseUser.email!,
                displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
                name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
                role: isSuperAdmin ? 'super_admin' : 'teacher',
                isApproved: true,
                isSuperAdmin: isSuperAdmin || undefined,
                migratedToV2: true,
                migrationVersion: 2,
                createdAt: Date.now(),
                updatedAt: Date.now() as any,
            };
            // Remove undefined fields to avoid Firestore errors
            if (!isSuperAdmin) delete (newUser as any).isSuperAdmin;
            await setDoc(docRef, { ...newUser, updatedAt: serverTimestamp() });

        } else {
            const existingData = docSnap.data() as User;
            newUser = existingData;
            // Sync fields if missing
            const updates: any = {};
            if (!newUser.authEmail && firebaseUser.email) updates.authEmail = firebaseUser.email;
            if (!newUser.displayName && firebaseUser.displayName) updates.displayName = firebaseUser.displayName;
            if (!newUser.name && firebaseUser.displayName) updates.name = firebaseUser.displayName;
            if (!newUser.photoURL && firebaseUser.photoURL) updates.photoURL = firebaseUser.photoURL;

            if (Object.keys(updates).length > 0) {
                updates.updatedAt = serverTimestamp();
                await setDoc(docRef, updates, { merge: true });
                newUser = { ...newUser, ...updates };
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
            authEmail: email,
            displayName: name || email.split('@')[0],
            name: name || email.split('@')[0],
            role: isSuperAdmin ? 'super_admin' : 'teacher',
            isApproved: true,
            isSuperAdmin: isSuperAdmin || undefined,
            migratedToV2: true,
            migrationVersion: 2,
            createdAt: Date.now(),
            updatedAt: Date.now() as any,
        };
        // Remove undefined fields to avoid Firestore errors
        const userToSave = { ...newUser };
        if (!isSuperAdmin) delete (userToSave as any).isSuperAdmin;
        await setDoc(doc(db, 'users', uid), { ...userToSave, updatedAt: serverTimestamp() });

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
