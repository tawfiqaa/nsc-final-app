import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

/**
 * Super Admin only: Deletes an organization and all its data.
 */
export const deleteOrganization = onCall(async (request) => {
    // 1. Verify caller
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { orgId } = request.data;
    if (!orgId) {
        throw new HttpsError('invalid-argument', 'Organization ID is required.');
    }

    // Check if caller is super_admin
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.isSuperAdmin !== true) {
        throw new HttpsError('permission-denied', 'Only Super Admins can delete organizations.');
    }

    try {
        // 2. Cleanup membership links in users' documents
        const membersSnap = await db.collection('orgs').doc(orgId).collection('members').get();
        const batchSize = 500;
        let batch = db.batch();
        let operationCount = 0;

        for (const memberDoc of membersSnap.docs) {
            const uid = memberDoc.id;
            const userOrgRef = db.collection('users').doc(uid).collection('orgMemberships').doc(orgId);
            batch.delete(userOrgRef);
            operationCount++;

            if (operationCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                operationCount = 0;
            }
        }
        if (operationCount > 0) {
            await batch.commit();
        }

        // 3. Delete all Org data recursively
        const orgRef = db.collection('orgs').doc(orgId);
        await db.recursiveDelete(orgRef);

        // 4. Cleanup Storage (if any org-level files exist)
        // Assume org files are in "orgMedia/{orgId}"
        try {
            await storage.bucket().deleteFiles({ prefix: `orgMedia/${orgId}` });
        } catch (e) {
            console.log('No org media files to delete or error:', e);
        }

        // 5. Audit Log
        await db.collection('auditLogs').add({
            action: 'DELETE_ORGANIZATION',
            orgId: orgId,
            byUid: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting organization:', error);
        throw new HttpsError('internal', error.message || 'Internal error');
    }
});

/**
 * User only: Deletes their own account and all their data.
 */
export const deleteMyAccount = onCall(async (request) => {
    // 1. Verify caller
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = request.auth.uid;

    try {
        // 2. Fetch all org memberships to clean them up
        const membershipsSnap = await db.collection('users').doc(uid).collection('orgMemberships').get();
        for (const membershipDoc of membershipsSnap.docs) {
            const orgId = membershipDoc.id;
            // Remove from org's members collection
            await db.collection('orgs').doc(orgId).collection('members').doc(uid).delete();
        }

        // 3. Delete user data recursively (including subcollections like lessons, schedules, etc)
        const userRef = db.collection('users').doc(uid);
        await db.recursiveDelete(userRef);

        // 4. Delete storage assets
        // avatars under userAvatars/{uid}
        try {
            await storage.bucket().deleteFiles({ prefix: `userAvatars/${uid}` });
        } catch (e) {
            console.log('No user media files to delete or error:', e);
        }

        // 5. Audit Log (before deleting auth user)
        await db.collection('auditLogs').add({
            action: 'DELETE_USER_ACCOUNT',
            uid: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 6. Delete Firebase Auth user
        await admin.auth().deleteUser(uid);

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting user account:', error);
        throw new HttpsError('internal', error.message || 'Internal error');
    }
});
