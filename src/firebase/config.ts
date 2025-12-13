// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, FirebaseOptions } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAPcHo7JGf2wNKN5pUscVYdnaw43xJBj6Q",
  authDomain: "aboutfootball-2b25c.firebaseapp.com",
  projectId: "aboutfootball-2b25c",
  storageBucket: "aboutfootball-2b25c.firebasestorage.app",
  messagingSenderId: "528963707212",
  appId: "1:528963707212:web:ee913c01b5bdf24b67efe9",
  measurementId: "G-P2G9GEQ5QS"
};

// Initialize Firebase
function initializeFirebase() {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export { initializeFirebase, firebaseConfig };
