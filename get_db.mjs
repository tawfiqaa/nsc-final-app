import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
    try {
        console.log("Fetching users...");
        const usersSnap = await getDocs(collection(db, "users"));
        const users = [];
        usersSnap.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        console.log("Users:", JSON.stringify(users, null, 2));

        console.log("\nFetching teacherData...");
        const tdSnap = await getDocs(collection(db, "teacherData"));
        const teacherData = [];
        tdSnap.forEach(doc => {
            const data = doc.data();
            teacherData.push({
                id: doc.id,
                ownerUid: data.ownerUid,
                schedulesCount: data.schedules?.length || 0,
                logsCount: data.attendanceLogs?.length || 0
            });
        });
        console.log("TeacherData overview:", JSON.stringify(teacherData, null, 2));

        process.exit(0);
    } catch (e) {
        console.error("Error fetching data:", e);
        process.exit(1);
    }
}

checkData();
