// --- DOM Elements ---
const dom = {
    loginWarning: document.getElementById('stats-login-warning'),
    loadingView: document.getElementById('circle-loading'),
    joinCreateView: document.getElementById('circle-join-create-view'),
    dashboardView: document.getElementById('circle-dashboard-view'),
    
    createNameInput: document.getElementById('circle-name-input'),
    createBtn: document.getElementById('create-circle-btn'),
    
    joinCodeInput: document.getElementById('circle-code-input'),
    joinBtn: document.getElementById('join-circle-btn'),
    
    circleNameDisplay: document.getElementById('circle-name-display'),
    circleInviteDisplay: document.getElementById('circle-invite-display'),
};

// --- State ---
let currentUser = null;
let currentUserId = null;

// --- Functions ---

/**
 * Helper untuk ganti tampilan
 */
function showView(viewName) {
    // Sembunyikan semua view dulu
    document.querySelectorAll('.circle-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Tampilkan yang diminta
    if (viewName === 'loading') {
        dom.loadingView.classList.add('active');
    } else if (viewName === 'join-create') {
        dom.joinCreateView.classList.add('active');
    } else if (viewName === 'dashboard') {
        dom.dashboardView.classList.add('active');
    }
}

/**
 * (1) Entry Point: Cek status login
 */
function handleAuth(user) {
    if (user) {
        // User Login
        currentUser = user;
        currentUserId = user.uid;
        dom.loginWarning.style.display = 'none';
        showView('loading');
        checkUserCircleStatus(currentUserId);
    } else {
        // User Guest
        currentUser = null;
        currentUserId = null;
        dom.loginWarning.style.display = 'block';
        showView('none'); // Sembunyikan semua
    }
}

/**
 * (2) Cek apakah user sudah punya circle
 */
function checkUserCircleStatus(userId) {
    const userRef = db.collection('users').doc(userId);
    
    userRef.get().then((doc) => {
        if (doc.exists && doc.data().circleId) {
            // User SUDAH punya circle
            const circleId = doc.data().circleId;
            loadCircleDashboard(circleId);
        } else {
            // User BELUM punya circle
            showView('join-create');
        }
    }).catch(err => {
        console.error("Error cek status user:", err);
        alert("Gagal memuat data. Coba refresh.");
    });
}

/**
 * (3) Muat dashboard jika user SUDAH punya circle
 */
function loadCircleDashboard(circleId) {
    const circleRef = db.collection('circles').doc(circleId);
    
    circleRef.get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            dom.circleNameDisplay.textContent = data.name;
            dom.circleInviteDisplay.textContent = data.inviteCode;
            showView('dashboard');
            // Nanti di sini kita panggil fungsi loadLeaderboard(), loadFeed(), dll.
        } else {
            // Aneh, user punya ID circle tapi circle-nya tidak ada.
            alert("Circle Anda tidak ditemukan. Menampilkan halaman join/create.");
            showView('join-create');
        }
    });
}

/**
 * Helper untuk membuat kode acak 6 digit
 */
function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * (4) Fungsi untuk BUAT circle baru
 */
function handleCreateCircle() {
    const circleName = dom.createNameInput.value;
    if (!circleName || circleName.length < 3) {
        alert("Nama circle minimal 3 karakter.");
        return;
    }
    
    const inviteCode = generateInviteCode();
    
    // Siapkan data
    const circleData = {
        name: circleName,
        adminId: currentUserId,
        inviteCode: inviteCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        memberCount: 1
    };
    
    const circleRef = db.collection('circles');
    
    // Buat dokumen circle baru
    circleRef.add(circleData).then((docRef) => {
        const newCircleId = docRef.id;
        
        // Update dokumen user dengan circleId baru
        const userRef = db.collection('users').doc(currentUserId);
        userRef.update({ circleId: newCircleId });
        
        // Tambahkan user sebagai member pertama
        const memberRef = db.collection('circles').doc(newCircleId).collection('members').doc(currentUserId);
        memberRef.set({
            name: currentUser.displayName,
            avatarUrl: currentUser.photoURL,
            joinDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Muat dashboard
        loadCircleDashboard(newCircleId);
        
    }).catch(err => {
        console.error("Error membuat circle:", err);
        alert("Gagal membuat circle. Coba lagi.");
    });
}

/**
 * (5) Fungsi untuk GABUNG circle
 */
function handleJoinCircle() {
    const inviteCode = dom.joinCodeInput.value.toUpperCase();
    if (inviteCode.length < 6) {
        alert("Kode undangan tidak valid.");
        return;
    }
    
    // Cari circle berdasarkan inviteCode
    const circleQuery = db.collection('circles').where("inviteCode", "==", inviteCode);
    
    circleQuery.get().then((querySnapshot) => {
        if (querySnapshot.empty) {
            alert("Kode undangan salah atau tidak ditemukan.");
            return;
        }
        
        // Ambil data circle
        const circleDoc = querySnapshot.docs[0];
        const circleId = circleDoc.id;
        
        // Update dokumen user
        const userRef = db.collection('users').doc(currentUserId);
        userRef.update({ circleId: circleId });
        
        // Tambahkan user ke subkoleksi members
        const memberRef = db.collection('circles').doc(circleId).collection('members').doc(currentUserId);
        memberRef.set({
            name: currentUser.displayName,
            avatarUrl: currentUser.photoURL,
            joinDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Tambah jumlah anggota (opsional, tapi bagus)
        circleDoc.ref.update({
            memberCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Muat dashboard
        loadCircleDashboard(circleId);
        
    }).catch(err => {
        console.error("Error bergabung circle:", err);
        alert("Gagal bergabung. Coba lagi.");
    });
}


// --- Inisialisasi ---
document.addEventListener('DOMContentLoaded', () => {
    // Cek dark mode
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
    }
    
    // Pasang listener tombol
    dom.createBtn.addEventListener('click', handleCreateCircle);
    dom.joinBtn.addEventListener('click', handleJoinCircle);
    
    // Mulai "mendengarkan" status login
    listenToAuthChanges(handleAuth);
});