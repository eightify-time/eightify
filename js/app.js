// -------------------------------
// --- A. DOM ELEMENTS
// -------------------------------
const dom = {
    mainTimer: document.getElementById('main-timer'),
    timerStatus: document.getElementById('timer-status'),
    progressRing: document.getElementById('timer-progress-ring'),
    
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    hamburgerBtn: document.getElementById('hamburger-btn'),
    
    authBtn: document.getElementById('auth-btn'),
    guestLoginBtn: document.getElementById('guest-login-btn'),
    sidebarUsername: document.getElementById('sidebar-username'),
    sidebarAvatar: document.getElementById('sidebar-avatar-img'),
    
    modal: document.getElementById('start-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalActivityInput: document.getElementById('activity-name-input'),
    modalSuggestions: document.getElementById('modal-suggestions'),
    modalStartBtn: document.getElementById('modal-start-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    guestWarning: document.getElementById('guest-warning'),
    toastReward: document.getElementById('toast-reward'), // <-- BARU

    categoryButtons: document.querySelectorAll('.card-button[data-category]'),
    accumulatedDisplays: {
        productive: document.getElementById('accumulated-productive'),
        personal: document.getElementById('accumulated-personal'),
        sleep: document.getElementById('accumulated-sleep'),
    },
};

const colors = {
    productive: 'var(--productive-color)',
    personal: 'var(--personal-color)',
    sleep: 'var(--sleep-color)',
    untracked: 'var(--untracked-color)',
};

// -------------------------------
// --- B. APPLICATION STATE
// -------------------------------
let state = {
    currentActivity: null, // 'productive', 'personal', 'sleep'
    activityName: "",
    startTime: null,
    timerInterval: null,
    isLoggedIn: false,
    userId: null,
    accumulated: {
        productive: 0,
        personal: 0,
        sleep: 0
    },
    currentModalCategory: null,
};

const quickSuggestions = {
    productive: ['Coding', 'Studying', 'Working', 'Reading 📚'],
    personal: ['Gaming 🎮', 'Watching TV', 'Social Media', 'Friends'],
    sleep: ['Napping', 'Deep Sleep 😴']
};

// -------------------------------
// --- C. AUTH HANDLERS
// -------------------------------

function handleAuthState(user) {
    if (user) {
        // --- PENGGUNA LOGIN ---
        state.isLoggedIn = true;
        state.userId = user.uid;
        
        dom.authBtn.textContent = 'Logout';
        dom.authBtn.classList.add('logout');
        dom.sidebarUsername.textContent = user.displayName;
        dom.sidebarAvatar.src = user.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==';
        dom.guestWarning.style.display = 'none';

        updateUserProfile(user);
        syncLocalToFirestore(user.uid);
        loadData();

    } else {
        // --- PENGGUNA GUEST (LOGOUT) ---
        state.isLoggedIn = false;
        state.userId = null;
        
        dom.authBtn.textContent = 'Login with Google';
        dom.authBtn.classList.remove('logout');
        dom.sidebarUsername.textContent = 'Guest User';
        dom.sidebarAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==';
        dom.guestWarning.style.display = 'block';

        loadData();
    }
}


// -------------------------------
// --- D. DATA FUNCTIONS
// -------------------------------

function loadData() {
    if (state.isLoggedIn) {
        loadDataFromFirestore(state.userId, (data) => {
            state.accumulated = data;
            updateAllAccumulatedDisplays();
        });
    } else {
        loadDataFromLocalStorage();
        updateAllAccumulatedDisplays();
    }
}

function loadDataFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('timeTrackerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            const lastSaveDate = new Date(data.lastSave);
            
            // Gunakan fungsi helper dari firebase.js (jika ada) atau buat lokal
            const todayStr = new Date().toISOString().split('T')[0];
            if (todayStr === lastSaveDate.toISOString().split('T')[0]) {
                state.accumulated = data.accumulated;
            } else {
                localStorage.removeItem('timeTrackerData'); // Data kadaluarsa
            }
        }
    } catch (e) {
        console.error("Error loading local data", e);
        localStorage.removeItem('timeTrackerData'); // Hapus jika korup
        state.accumulated = { productive: 0, personal: 0, sleep: 0 };
    }
}

function saveDataToLocalStorage() {
    if (state.isLoggedIn) return;
    try {
        const dataToSave = {
            accumulated: state.accumulated,
            lastSave: new Date().toISOString()
        };
        localStorage.setItem('timeTrackerData', JSON.stringify(dataToSave));
    } catch (e) {
        console.error("Error saving local data", e);
    }
}

// -------------------------------
// --- E. CORE TIMER FUNCTIONS
// -------------------------------

function openStartModal(category) {
    // 2-click start: Ini adalah klik pertama
    state.currentModalCategory = category;
    dom.modalTitle.textContent = `Start ${capitalize(category)} Activity`;
    dom.modalStartBtn.style.backgroundColor = colors[category];
    dom.modalActivityInput.value = "";

    dom.modalSuggestions.innerHTML = "";
    quickSuggestions[category].forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-btn';
        btn.textContent = text;
        btn.onclick = () => { dom.modalActivityInput.value = text; };
        dom.modalSuggestions.appendChild(btn);
    });
    dom.modal.classList.add('open');
}

function closeStartModal() {
    dom.modal.classList.remove('open');
}

function startActivity() {
    // 2-click start: Ini adalah klik kedua
    if (state.currentActivity) {
        stopActivity(); 
    }

    const category = state.currentModalCategory;
    state.currentActivity = category;
    state.activityName = dom.modalActivityInput.value || `My ${category} time`;
    state.startTime = new Date();

    updateUIForActivityStart(category, state.activityName);

    state.timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); 

    closeStartModal();
}

function stopActivity() {
    if (!state.currentActivity) return;

    const endTime = new Date();
    const duration = Math.round((endTime - state.startTime) / 1000);

    // Jangan simpan aktivitas yg terlalu pendek
    if (duration < 1) { 
        // Reset tanpa menyimpan
        const stoppedCategory = state.currentActivity;
        state.currentActivity = null;
        state.activityName = "";
        state.startTime = null;
        clearInterval(state.timerInterval);
        state.timerInterval = null;

        updateUIForActivityStop(stoppedCategory);
        return; // Hentikan fungsi di sini
    }

    state.accumulated[state.currentActivity] += duration;
    
    const activityData = {
        name: state.activityName,
        category: state.currentActivity,
        startTime: state.startTime,
        endTime: endTime,
        duration: duration
    };

    if (state.isLoggedIn) {
        saveDataToFirestore(state.userId, activityData);
    } else {
        saveDataToLocalStorage();
    }

    const stoppedCategory = state.currentActivity;
    state.currentActivity = null;
    state.activityName = "";
    state.startTime = null;
    clearInterval(state.timerInterval);
    state.timerInterval = null;

    updateUIForActivityStop(stoppedCategory);
    updateAccumulatedDisplay(stoppedCategory);
    
    // Tampilkan micro-reward!
    showToast("Nice job! 🚀");
}

// -------------------------------
// --- F. UI UPDATE FUNCTIONS
// -------------------------------

function updateUIForActivityStart(category, name) {
    dom.timerStatus.innerHTML = `Currently: <span class="activity-name" style="color: ${colors[category]}">${name}</span>`;
    dom.timerStatus.classList.add('active');
    dom.progressRing.style.background = `conic-gradient(${colors[category]} 0deg, ${colors.untracked} 0deg 360deg)`;
    
    dom.categoryButtons.forEach(btn => {
        if (btn.dataset.category === category) {
            btn.textContent = 'Stop';
            btn.classList.remove('start');
            btn.classList.add('stop');
        } else {
            btn.disabled = true;
            btn.style.opacity = 0.5;
        }
    });
}

function updateUIForActivityStop(stoppedCategory) {
    dom.mainTimer.textContent = '00:00:00';
    dom.timerStatus.innerHTML = 'Ready to start an activity?';
    dom.timerStatus.classList.remove('active');
    dom.progressRing.style.background = `conic-gradient(${colors.untracked} 360deg, ${colors.untracked} 0deg 360deg)`;

    dom.categoryButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = 1;
        if (btn.dataset.category === stoppedCategory) {
            btn.textContent = 'Start';
            btn.classList.remove('stop');
            btn.classList.add('start');
        }
    });
}

function updateTimer() {
    if (!state.startTime) return;

    const elapsedSeconds = Math.floor((new Date() - state.startTime) / 1000);
    dom.mainTimer.textContent = formatTime(elapsedSeconds);
    
    const elapsedStr = formatTime(elapsedSeconds, true);
    dom.timerStatus.innerHTML = `Currently: <span class="activity-name" style="color: ${colors[state.currentActivity]}">${state.activityName}</span> - ${elapsedStr}`;
    
    const degrees = (elapsedSeconds % 3600) / 10;
    dom.progressRing.style.background = `conic-gradient(
        ${colors[state.currentActivity]} ${degrees}deg, 
        ${colors.untracked} ${degrees}deg 360deg
    )`;
}

function updateAccumulatedDisplay(category) {
    const totalSeconds = state.accumulated[category];
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    dom.accumulatedDisplays[category].textContent = `${hours}h ${minutes}m`;
}

function updateAllAccumulatedDisplays() {
    updateAccumulatedDisplay('productive');
    updateAccumulatedDisplay('personal');
    updateAccumulatedDisplay('sleep');
}

/**
 * Menampilkan notifikasi Toast
 */
function showToast(message) {
    dom.toastReward.textContent = message;
    dom.toastReward.classList.add("show");
    
    // Sembunyikan lagi setelah 3 detik
    setTimeout(() => {
        dom.toastReward.classList.remove("show");
    }, 3000);
}

// -------------------------------
// --- G. HELPER UTILITIES
// -------------------------------

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(totalSeconds, short = false) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (short) {
        let str = "";
        if (hours > 0) str += `${hours}h `;
        if (minutes > 0) str += `${minutes}m `;
        if (hours === 0 && minutes === 0) str += `${seconds}s`;
        return str.trim() || '0s';
    }

    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    const s = String(seconds).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// -------------------------------
// --- H. INITIALIZATION
// -------------------------------
function setupEventListeners() {
    // Sidebar
    dom.hamburgerBtn.addEventListener('click', () => {
        dom.sidebar.classList.toggle('open');
        dom.sidebarOverlay.classList.toggle('open');
    });
    dom.sidebarOverlay.addEventListener('click', () => {
        dom.sidebar.classList.remove('open');
        dom.sidebarOverlay.classList.remove('open');
    });

    // Auth
    dom.authBtn.addEventListener('click', () => {
        if (state.isLoggedIn) {
            logout();
        } else {
            loginWithGoogle();
        }
    });
    dom.guestLoginBtn.addEventListener('click', loginWithGoogle);

    // Kategori Buttons
    dom.categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            if (state.currentActivity === category) {
                stopActivity();
            } else if (!state.currentActivity) {
                openStartModal(category);
            }
        });
    });

    // Modal
    dom.modalStartBtn.addEventListener('click', startActivity);
    dom.modalCancelBtn.addEventListener('click', closeStartModal);

    // Dark Mode
    dom.darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if(document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
        } else {
            localStorage.removeItem('darkMode');
        }
    });
    
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
    }
}

function init() {
    console.log("App initialized.");
    setupEventListeners();
    listenToAuthChanges(handleAuthState);
}

document.addEventListener('DOMContentLoaded', init);