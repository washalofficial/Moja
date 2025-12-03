import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

// HARDCODED FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDW7ARKxRz1AH6ifyd6vCUV51ZpboBfPSQ",
  authDomain: "spark-team-765e6.firebaseapp.com",
  projectId: "spark-team-765e6",
  storageBucket: "spark-team-765e6.firebasestorage.app",
  messagingSenderId: "445100505776",
  appId: "1:445100505776:web:30830ae16c1221d839d975",
  measurementId: "G-Q8NQRSLHMN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

console.log('✅ Firebase initialized with hardcoded configuration');

export { app, analytics, db };
