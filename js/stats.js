// DOM Elements
const statsContent = document.getElementById('stats-content');
const loginWarning = document.getElementById('stats-login-warning');
const timeline = document.getElementById('activity-timeline');
const timelineEmpty = document.getElementById('timeline-empty');
const filterButtons = document.querySelectorAll('.filter-btn');
const timelineTitle = document.getElementById('timeline-title');
const pieChartTitle = document.getElementById('pie-chart-title');
const pieChartCtx = document.getElementById('pieChart').getContext('2d');

let currentUserId = null;
let currentFilter = 'today';
let myPieChart = null; // Variable untuk menyimpan instance chart

// --- Helper Functions ---

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    let str = "";
    if (h > 0) str += `${h}h `;
    if (m > 0) str += `${m}m`;
    if (h === 0 && m === 0) str = `${seconds % 60}s`;
    return str.trim() || '0m';
}

function formatTime(date) {
    return date.toLocaleTimeString(navigator.language, {
        hour: '2-digit',
        minute:'2-digit'
    });
}

function getCategoryIcon(category) {
    if (category === 'productive') return '💼';
    if (category === 'personal') return '🎮';
    if (category === 'sleep') return '😴';
    return '❓';
}

// --- Pie Chart Function ---

/**
 * Merender atau meng-update Pie Chart
 */
function renderPieChart(productive = 0, personal = 0, sleep = 0) {
    const totalTracked = productive + personal + sleep;
    const totalDay = 24 * 60 * 60; // Total detik dalam sehari
    const empty = Math.max(0, totalDay - totalTracked);

    const data = {
        labels: ['Productive', 'Personal', 'Sleep', 'Empty'],
        datasets: [{
            data: [productive, personal, sleep, empty],
            backgroundColor: [
                'var(--productive-chart-bg)',
                'var(--personal-chart-bg)',
                'var(--sleep-chart-bg)',
                'var(--untracked-chart-bg)'
            ],
            borderColor: [
                'var(--productive-color)',
                'var(--personal-color)',
                'var(--sleep-color)',
                'var(--untracked-color)'
            ],
            borderWidth: 1
        }]
    };

    // Hancurkan chart lama jika ada, agar bisa di-render ulang
    if (myPieChart) {
        myPieChart.destroy();
    }

    // Buat chart baru
    myPieChart = new Chart(pieChartCtx, {
        type: 'doughnut', // 'pie' atau 'doughnut'
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: 'var(--text-color)' // Untuk dark mode
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const duration = formatDuration(value);
                            return `${label}: ${duration}`;
                        }
                    }
                }
            }
        }
    });
}

// --- Data Loading Functions ---

/**
 * Membuat elemen HTML untuk timeline
 */
function createTimelineItem(activity) {
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
 * Memuat data agregat harian (untuk pie chart)
 */
function loadDailyStats() {
    if (!currentUserId) return;
    
    const todayStr = getTodayString();
    
    // Ambil data agregat harian
    db.collection('users').doc(currentUserId)
      .collection('daily_stats').doc(todayStr)
      .get()
      .then((doc) => {
          if (doc.exists) {
              const data = doc.data();
              renderPieChart(data.productive, data.personal, data.sleep);
          } else {
              // Belum ada data hari ini
              renderPieChart(0, 0, 0);
          }
      })
      .catch((error) => {
          console.error("Error loading daily stats: ", error);
          renderPieChart(0, 0, 0); // Tampilkan chart kosong jika error
      });
}

/**
 * Memuat log aktivitas (untuk timeline)
 */
function loadActivities() {
    if (!currentUserId) return;

    timeline.innerHTML = '';
    timelineEmpty.style.display = 'none';

    const now = new Date();
    let startDate = new Date();
    
    if (currentFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
        timelineTitle.textContent = "Aktivitas Hari Ini";
        pieChartTitle.textContent = "Total Hari Ini";
    } else if (currentFilter === 'week') {
        startDate.setDate(now.getDate() - now.getDay()); // Awal Minggu (Minggu)
        startDate.setHours(0, 0, 0, 0);
        timelineTitle.textContent = "Aktivitas Minggu Ini";
        pieChartTitle.textContent = "Total Hari Ini"; // Pie chart selalu hari ini
    } else if (currentFilter === 'month') {
        startDate.setDate(1); // Awal Bulan
        startDate.setHours(0, 0, 0, 0);
        timelineTitle.textContent = "Aktivitas Bulan Ini";
        pieChartTitle.textContent = "Total Hari Ini"; // Pie chart selalu hari ini
    } else { // 'all'
        startDate = new Date(0); // Jaman dahulu kala
        timelineTitle.textContent = "Semua Aktivitas";
        pieChartTitle.textContent = "Total Hari Ini"; // Pie chart selalu hari ini
    }

    // Buat query ke Firestore
    db.collection('users').doc(currentUserId)
      .collection('activities')
      .where('startTime', '>=', startDate)
      .orderBy('startTime', 'desc')
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

// --- Event Handlers ---

function handleFilterClick(e) {
    filterButtons.forEach(btn => btn.classList.remove('active'));
    
    const clickedButton = e.target;
    clickedButton.classList.add('active');
    
    currentFilter = clickedButton.dataset.filter;
    loadActivities();
    
    // Logic untuk Pie Chart: Hanya tampilkan jika filter 'Today'
    // Sesuai prompt: "Display a pie chart showing today’s usage"
    // Kita biarkan saja chart-nya selalu 'Today'
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    
    filterButtons.forEach(btn => btn.addEventListener('click', handleFilterClick));

    listenToAuthChanges(user => {
        if (user) {
            currentUserId = user.uid;
            statsContent.style.display = 'block';
            loginWarning.style.display = 'none';
            
            // Muat kedua-duanya
            loadDailyStats(); // Muat data Pie Chart (hanya hari ini)
            loadActivities(); // Muat data Timeline (sesuai filter)
            
        } else {
            currentUserId = null;
            statsContent.style.display = 'none';
            loginWarning.style.display = 'block';
        }
    });
    
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
    }
});