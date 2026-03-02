// Creates "Nazareth Space Center" org and adds ALL existing users to it
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync('C:/Users/tawfi/Downloads/nsc-final-app-firebase-adminsdk-fbsvc-ed2c230b40.json', 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const ORG_NAME = 'Nazareth Space Center';
const SUPER_ADMIN_EMAIL = 'tawfiq.a.a@gmail.com';

async function main() {
    console.log('=== Creating Organization: ' + ORG_NAME + ' ===\n');

    // 1. Get all users
    const usersSnap = await db.collection('users').get();
    const users = [];
    usersSnap.forEach(doc => {
        users.push({ uid: doc.id, ...doc.data() });
    });
    console.log(`Found ${users.length} users:\n`);
    users.forEach(u => console.log(`  - ${u.email} (${u.role}) uid=${u.uid}`));
    console.log('');

    // 2. Find the super admin
    const superAdmin = users.find(u => u.email === SUPER_ADMIN_EMAIL);
    if (!superAdmin) {
        console.log('❌ Super admin not found!');
        return;
    }

    // 3. Create the org doc
    const orgRef = db.collection('orgs').doc(); // auto-generate ID
    const orgId = orgRef.id;
    const now = Date.now();

    const orgData = {
        name: ORG_NAME,
        createdBy: superAdmin.uid,
        createdAt: now,
        updatedAt: now,
    };

    console.log(`Creating org with ID: ${orgId}`);

    // 4. Batch: create org + all memberships + update user docs
    // Firestore batches limited to 500 operations, we're well under that
    const batch = db.batch();

    // Create the org
    batch.set(orgRef, orgData);

    for (const user of users) {
        const isOwner = user.email === SUPER_ADMIN_EMAIL;
        const role = isOwner ? 'owner' : 'teacher';

        // Create membership in orgs/{orgId}/members/{uid}
        const memberRef = db.collection('orgs').doc(orgId).collection('members').doc(user.uid);
        batch.set(memberRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.name || user.email || '',
            role: role,
            status: 'approved',
            joinedAt: now,
            approvedAt: now,
            approvedBy: superAdmin.uid,
            updatedAt: now,
        });

        // Create mirror in users/{uid}/orgMemberships/{orgId}
        const mirrorRef = db.collection('users').doc(user.uid).collection('orgMemberships').doc(orgId);
        batch.set(mirrorRef, {
            orgId: orgId,
            orgName: ORG_NAME,
            role: role,
            status: 'approved',
            joinedAt: now,
            updatedAt: now,
        });

        // Set activeOrgId on user doc
        batch.update(db.collection('users').doc(user.uid), {
            activeOrgId: orgId,
            updatedAt: now,
        });
    }

    await batch.commit();

    console.log('\n✅ Organization created successfully!');
    console.log(`\n📋 Organization Details:`);
    console.log(`   Name: ${ORG_NAME}`);
    console.log(`   ID (join code): ${orgId}`);
    console.log(`   Owner: ${superAdmin.email}`);
    console.log(`   Members added: ${users.length}`);
    console.log(`\n   Share this ID with new teachers: ${orgId}`);
}

main().catch(console.error);
