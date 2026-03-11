import { collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { MembershipStatus, OrgContextType, OrgRole, Organization, UserOrgMembership } from '../types';
import { useAuth } from './AuthContext';

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const useOrg = () => {
    const context = useContext(OrgContext);
    if (!context) {
        throw new Error('useOrg must be used within an OrgProvider');
    }
    return context;
};

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
    const [membershipRole, setMembershipRole] = useState<OrgRole | null>(null);
    const [userOrgs, setUserOrgs] = useState<UserOrgMembership[]>([]);
    const [orgLoading, setOrgLoading] = useState(true);

    // Sync activeOrgId from user doc
    useEffect(() => {
        if (!user) {
            setActiveOrgId(null);
            setActiveOrg(null);
            setMembershipStatus(null);
            setMembershipRole(null);
            setUserOrgs([]);
            setOrgLoading(false);
            return;
        }
        setActiveOrgId(user.activeOrgId || null);
        if (!user.activeOrgId) {
            setOrgLoading(false);
        }
    }, [user?.uid, user?.activeOrgId]);

    // Listen to user's orgMemberships subcollection
    useEffect(() => {
        if (!user) return;
        const ref = collection(db, 'users', user.uid, 'orgMemberships');
        const unsub = onSnapshot(ref, (snap) => {
            const orgs: UserOrgMembership[] = [];
            snap.forEach(d => {
                orgs.push({ orgId: d.id, ...d.data() } as UserOrgMembership);
            });
            setUserOrgs(orgs);
        }, (err) => {
            console.error('Error listening to orgMemberships', err);
        });
        return () => unsub();
    }, [user?.uid]);

    // Listen to active org doc + membership doc
    useEffect(() => {
        if (!user || !activeOrgId) {
            setActiveOrg(null);
            setMembershipStatus(null);
            setMembershipRole(null);
            return;
        }

        const unsubs: (() => void)[] = [];

        // Safety timeout for org loading
        const timeout = setTimeout(() => {
            setOrgLoading(false);
        }, 3000);

        // Org doc
        const orgUnsub = onSnapshot(doc(db, 'orgs', activeOrgId), (snap) => {
            if (snap.exists()) {
                setActiveOrg({ id: snap.id, ...snap.data() } as Organization);
            } else {
                setActiveOrg(null);
            }
        }, (err) => {
            console.error('Error listening to org doc', err);
        });
        unsubs.push(orgUnsub);

        // Membership doc
        const memberUnsub = onSnapshot(doc(db, 'orgs', activeOrgId, 'members', user.uid), (snap) => {
            clearTimeout(timeout);
            if (snap.exists()) {
                const data = snap.data();
                setMembershipStatus(data.status as MembershipStatus);
                setMembershipRole(data.role as OrgRole);
            } else {
                setMembershipStatus(null);
                setMembershipRole(null);
            }
            setOrgLoading(false);
        }, (err) => {
            console.error('Error listening to membership doc', err);
            clearTimeout(timeout);
            setOrgLoading(false);
        });
        unsubs.push(memberUnsub);

        return () => unsubs.forEach(u => u());
    }, [user?.uid, activeOrgId]);

    const createOrg = async (name: string): Promise<string> => {
        if (!user) throw new Error('Not authenticated');

        const orgRef = doc(collection(db, 'orgs'));
        const orgId = orgRef.id;
        const batch = writeBatch(db);

        // Create org doc
        batch.set(orgRef, {
            name,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            joinCode: orgId,
            isActive: true,
        });

        // Membership in org (owner, auto-approved)
        batch.set(doc(db, 'orgs', orgId, 'members', user.uid), {
            uid: user.uid,
            role: 'owner',
            status: 'approved',
            requestedAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
            approvedBy: user.uid,
            updatedAt: serverTimestamp(),
            displayName: user.name || user.email,
            email: user.email,
        });

        // Mirror in user's orgMemberships
        batch.set(doc(db, 'users', user.uid, 'orgMemberships', orgId), {
            orgName: name,
            role: 'owner',
            status: 'approved',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Set active org
        batch.update(doc(db, 'users', user.uid), {
            activeOrgId: orgId,
            updatedAt: Date.now(),
        });

        await batch.commit();
        setActiveOrgId(orgId); // Optimistic local update
        return orgId;
    };

    const joinOrg = async (orgIdOrCode: string): Promise<void> => {
        if (!user) throw new Error('Not authenticated');

        const trimmed = orgIdOrCode.trim();
        if (!trimmed) throw new Error('Please enter an Organization ID');

        // Validate org exists
        const orgSnap = await getDoc(doc(db, 'orgs', trimmed));
        if (!orgSnap.exists()) {
            throw new Error('Organization not found. Check the ID and try again.');
        }
        const orgData = orgSnap.data();
        if (orgData.isActive === false) {
            throw new Error('This organization is no longer active.');
        }

        // Check existing membership
        const memberSnap = await getDoc(doc(db, 'orgs', trimmed, 'members', user.uid));
        if (memberSnap.exists()) {
            const existing = memberSnap.data();
            if (existing.status === 'approved') throw new Error('You are already a member of this organization.');
            if (existing.status === 'pending') throw new Error('Your join request is already pending approval.');
            if (existing.status === 'rejected') throw new Error('Your request was rejected. Contact the org admin.');
        }

        const batch = writeBatch(db);

        // Create pending membership
        batch.set(doc(db, 'orgs', trimmed, 'members', user.uid), {
            uid: user.uid,
            role: 'teacher',
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            displayName: user.name || user.email,
            email: user.email,
        });

        // Mirror in user's orgMemberships
        batch.set(doc(db, 'users', user.uid, 'orgMemberships', trimmed), {
            orgName: orgData.name,
            role: 'teacher',
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Set as active org (will show pending UI)
        batch.update(doc(db, 'users', user.uid), {
            activeOrgId: trimmed,
            updatedAt: Date.now(),
        });

        await batch.commit();
        setActiveOrgId(trimmed);
    };

    const switchOrg = async (orgId: string): Promise<void> => {
        if (!user) throw new Error('Not authenticated');

        const membership = userOrgs.find(o => o.orgId === orgId);
        if (!membership || membership.status !== 'approved') {
            throw new Error('You are not an approved member of this organization.');
        }

        await updateDoc(doc(db, 'users', user.uid), {
            activeOrgId: orgId,
            updatedAt: Date.now(),
        });
        setActiveOrgId(orgId);
    };

    return (
        <OrgContext.Provider value={{
            activeOrg,
            activeOrgId,
            membershipStatus,
            membershipRole,
            userOrgs,
            orgLoading,
            createOrg,
            joinOrg,
            switchOrg,
        }}>
            {children}
        </OrgContext.Provider>
    );
};
