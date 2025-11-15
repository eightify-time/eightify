// ------------------------------------------------------------------
// PENTING: ISI DENGAN KONFIGURASI PROYEK FIREBASE ANDA
// ------------------------------------------------------------------
// Buka Firebase Console > Project Settings > General
// Salin object "firebaseConfig" dan tempel di sini.
const firebaseConfig = {
  apiKey: "AIzaSyCVXoePE_K0BxmKuYUh4gDCFenxV6tF7kg",
  authDomain: "eightify-ea45f.firebaseapp.com",
  projectId: "eightify-ea45f",
  storageBucket: "eightify-ea45f.firebasestorage.app",
  messagingSenderId: "827591118188",
  appId: "1:827591118188:web:de855d05c512af745ef749",
  measurementId: "G-N48L4C268V"
};
// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);

// Inisialisasi layanan yang kita butuhkan
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();
const GoogleProvider = new firebase.auth.GoogleAuthProvider();

/**
 * Mendapatkan string tanggal hari ini (misal "2025-11-14")
 * Ini penting untuk ID dokumen di Firestore
 */
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

// ------------------------------------
// FUNGSI AUTENTIKASI
// ------------------------------------

/**
 * Memulai login dengan popup Google
 */
function loginWithGoogle() {
    auth.signInWithPopup(GoogleProvider)
        .then((result) => {
            console.log("Login sukses:", result.user.displayName);
            // Pengecekan auth state akan menangani sisanya
        })
        .catch((error) => {
            console.error("Login Error:", error);
        });
}

/**
 * Logout pengguna
 */
function logout() {
    auth.signOut()
        .then(() => {
            console.log("Logout sukses");
        })
        .catch((error) => {
            console.error("Logout Error:", error);
        });
}

/**
 * "Mendengarkan" perubahan status login (inti dari aplikasi)
 * @param {function} callback - Fungsi yang akan dipanggil saat status berubah
 */
function listenToAuthChanges(callback) {
    auth.onAuthStateChanged(callback);
}

/**
 * Saat login, update/buat profil pengguna di Firestore
 */
function updateUserProfile(user) {
    if (!user) return;
    
    const userRef = db.collection('users').doc(user.uid);
    const profileData = {
        name: user.displayName,
        email: user.email,
        avatarUrl: user.photoURL,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Set dengan 'merge: true' agar tidak menimpa data lain
    userRef.set(profileData, { merge: true });
}


// ------------------------------------
// FUNGSI DATABASE (FIRESTORE)
// ------------------------------------

/**
 * Menyimpan data aktivitas ke Firestore
 * @param {string} userId - ID pengguna
 * @param {object} activity - { name, category, startTime, endTime, duration }
 */
function saveDataToFirestore(userId, activity) {
    const todayStr = getTodayString();
    
    // 1. Simpan log aktivitas individual
    db.collection('users').doc(userId)
      .collection('activities').add(activity);

// ... (sisa kode) ...
