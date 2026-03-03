"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMyAccount = exports.deleteOrganization = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
/**
 * Super Admin only: Deletes an organization and all its data.
 */
exports.deleteOrganization = (0, https_1.onCall)(async (request) => {
    // 1. Verify caller
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { orgId } = request.data;
    if (!orgId) {
        throw new https_1.HttpsError('invalid-argument', 'Organization ID is required.');
    }
    // Check if caller is super_admin
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.isSuperAdmin !== true) {
        throw new https_1.HttpsError('permission-denied', 'Only Super Admins can delete organizations.');
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
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Error deleting organization:', error);
        throw new https_1.HttpsError('internal', error.message || 'Internal error');
    }
});
/**
 * User only: Deletes their own account and all their data.
 */
exports.deleteMyAccount = (0, https_1.onCall)(async (request) => {
    // 1. Verify caller
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in.');
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
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Error deleting user account:', error);
        throw new https_1.HttpsError('internal', error.message || 'Internal error');
    }
});
//# sourceMappingURL=index.js.map