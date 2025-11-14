// DOM Elements Khusus Halaman Statistik
const statsContent = document.getElementById('stats-content');
const loginWarning = document.getElementById('stats-login-warning');
const timeline = document.getElementById('activity-timeline');
const timelineEmpty = document.getElementById('timeline-empty');
const filterButtons = document.querySelectorAll('.filter-btn');
const timelineTitle = document.getElementById('timeline-title');

let currentUserId = null;
let currentFilter = 'today'; // Default filter

// Helper untuk format durasi
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    let str = "";
    if (h > 0) str += `${h}h `;
    if (m > 0) str += `${m}m`;
    if (h === 0 && m === 0) str = `${seconds % 60}s`;
    return str.trim() || '0m';
}

// Helper untuk format waktu (HH:MM)
function formatTime(date) {
    return date.toLocaleTimeString(navigator.language, {
        hour: '2-digit',
        minute:'2-digit'
    });
}

// Helper untuk ikon
function getCategoryIcon(category) {
    if (category === 'productive') return '💼';
    if (category === 'personal') return '🎮';
    if (category === 'sleep') return '😴';
    return '❓';
}

/**
 * Membuat elemen HTML untuk satu item di timeline
 */
function createTimelineItem(activity) {
    // Ubah Firestore Timestamps menjadi object Date
    const startTime = activity.startTime.toDate();
    const endTime = activity.endTime.toDate();
    
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    item.innerHTML = `
        <span class="timeline-icon">${getCategoryIcon(activity.category)}</span>
        <div class="timeline-details">
            <div class="timeline-name">${activity.name || 'Aktivitas'}</div>
            <div class="timeline-meta">${formatTime(startTime)} - ${formatTime(endTime)}</div>
        </div>
        <div class="timeline-duration">${formatDuration(activity.duration)}</div>
    `;
    return item;
}

/**
 * Memuat data aktivitas dari Firestore berdasarkan filter
 */
function loadActivities() {
    if (!currentUserId) return;

    // Bersihkan timeline
    timeline.innerHTML = '';
    timelineEmpty.style.display = 'none';

    // Tentukan rentang waktu berdasarkan filter
    const now = new Date();
    let startDate = new Date();
    
    if (currentFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
        timelineTitle.textContent = "Aktivitas Hari Ini";
    } else if (currentFilter === 'week') {
        startDate.setDate(now.getDate() - now.getDay()); // Awal Minggu (Minggu)
        startDate.setHours(0, 0, 0, 0);
        timelineTitle.textContent = "Aktivitas Minggu Ini";
    } else if (currentFilter === 'month') {
        startDate.setDate(1); // Awal Bulan
        startDate.setHours(0, 0, 0, 0);
        timelineTitle.textContent = "Aktivitas Bulan Ini";
    } else { // 'all'
        startDate = new Date(0); // Jaman dahulu kala
        timelineTitle.textContent = "Semua Aktivitas";
    }

    // Buat query ke Firestore
    db.collection('users').doc(currentUserId)
      .collection('activities')
      .where('startTime', '>=', startDate) // Filter berdasarkan waktu mulai
      .orderBy('startTime', 'desc') // Tampilkan yang terbaru di atas
      .get()
      .then((querySnapshot) => {
          if (querySnapshot.empty) {
              timelineEmpty.style.display = 'block';
              return;
          }
          
          querySnapshot.forEach((doc) => {
              const activity = doc.data();
              const itemElement = createTimelineItem(activity);
              timeline.appendChild(itemElement);
          });
      })
      .catch((error) => {
          console.error("Error loading activities: ", error);
      });
}

/**
 * Menangani klik pada tombol filter
 */
function handleFilterClick(e) {
    // Hapus 'active' dari semua tombol
    filterButtons.forEach(btn => btn.classList.remove('active'));
    
    // Tambah 'active' ke tombol yang diklik
    const clickedButton = e.target;
    clickedButton.classList.add('active');
    
    // Set filter baru dan muat ulang data
    currentFilter = clickedButton.dataset.filter;
    loadActivities();
}


// --- Inisialisasi Halaman Statistik ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Pasang listener untuk tombol filter
    filterButtons.forEach(btn => btn.addEventListener('click', handleFilterClick));

    // Cek status login
    listenToAuthChanges(user => {
        if (user) {
            // Pengguna login
            currentUserId = user.uid;
            statsContent.style.display = 'block';
            loginWarning.style.display = 'none';
            // Muat data untuk filter default ('today')
            loadActivities();
        } else {
            // Pengguna guest
            currentUserId = null;
            statsContent.style.display = 'none';
            loginWarning.style.display = 'block';
        }
    });
    
    // Cek dark mode (karena ini halaman terpisah)
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
    }
});