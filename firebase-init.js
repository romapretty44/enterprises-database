// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBf4oTZ-_qGfsZFlrZ22c5mBig2o5ApvnQ",
  authDomain: "enterprises-database.firebaseapp.com",
  projectId: "enterprises-database",
  storageBucket: "enterprises-database.firebasestorage.app",
  messagingSenderId: "623568134628",
  appId: "1:623568134628:web:0dcaa98e0b5e3fa4ba27f1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot };
