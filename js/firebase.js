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
// ------------------------------------------------------------------

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

    // 2. Update data harian (agregat)
    const dailyRef = db.collection('users').doc(userId)
                       .collection('daily_stats').doc(todayStr);

    // Gunakan 'Increment' agar aman jika ada 2 tab terbuka
    const updateData = {
        [activity.category]: firebase.firestore.FieldValue.increment(activity.duration),
        total: firebase.firestore.FieldValue.increment(activity.duration)
    };
    
    dailyRef.set(updateData, { merge: true });
}

/**
 * Memuat data agregat harian dari Firestore
 * @param {string} userId - ID pengguna
 * @param {function} callback - Fungsi yang akan dipanggil dengan data
 */
function loadDataFromFirestore(userId, callback) {
    const todayStr = getTodayString();
    
    db.collection('users').doc(userId)
      .collection('daily_stats').doc(todayStr)
      .get()
      .then((doc) => {
          if (doc.exists) {
              const data = doc.data();
              // Pastikan semua kategori ada
              const cleanData = {
                  productive: data.productive || 0,
                  personal: data.personal || 0,
                  sleep: data.sleep || 0
              };
              callback(cleanData);
          } else {
              // Tidak ada data untuk hari ini
              callback({ productive: 0, personal: 0, sleep: 0 });
          }
      })
      .catch((error) => {
          console.error("Error loading data:", error);
      });
}

/**
 * Memeriksa data localStorage dan memindahkannya ke Firestore
 * Ini hanya berjalan sekali saat login pertama
 */
function syncLocalToFirestore(userId) {
    const localData = localStorage.getItem('timeTrackerData');
    if (!localData) return; // Tidak ada yang disinkronkan
    
    try {
        const data = JSON.parse(localData);
        // Cek apakah data ini dari "hari ini"
        const lastSave = new Date(data.lastSave);
        if (getTodayString() === lastSave.toISOString().split('T')[0]) {
            console.log("Sinkronisasi data local ke Firestore...");
            
            const todayStr = getTodayString();
            const dailyRef = db.collection('users').doc(userId)
                               .collection('daily_stats').doc(todayStr);
            
            const updateData = {
                productive: firebase.firestore.FieldValue.increment(data.accumulated.productive || 0),
                personal: firebase.firestore.FieldValue.increment(data.accumulated.personal || 0),
                sleep: firebase.firestore.FieldValue.increment(data.accumulated.sleep || 0)
            };
            
            // Set (merge) data ini ke Firestore
            dailyRef.set(updateData, { merge: true }).then(() => {
                // Hapus data local SETELAH berhasil sinkronisasi
                localStorage.removeItem('timeTrackerData');
                console.log("Sinkronisasi berhasil, data local dihapus.");
            });
        } else {
            // Data local sudah kadaluarsa, hapus saja
            localStorage.removeItem('timeTrackerData');
        }
    } catch (e) {
        console.error("Gagal parse data local:", e);
        localStorage.removeItem('timeTrackerData');
    }
}