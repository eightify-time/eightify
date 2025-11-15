import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, updateDoc, arrayUnion } from './firebase-config.js';

class EightifyApp {
    constructor() {
        this.currentUser = null;
        this.currentActivity = null;
        this.timerInterval = null;
        this.startTime = null;
        this.elapsedSeconds = 0;
        this.todayData = {
            productive: 0,
            personal: 0,
            sleep: 0,
            activities: []
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAuthListener();
        this.setupDailyReset();
        this.updateUI();
        this.updateStats();
    }

    setupEventListeners() {
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleMenu());
        document.getElementById('googleLoginBtn').addEventListener('click', () => this.handleGoogleLogin());
        document.getElementById('changeAvatarBtn').addEventListener('click', () => this.changeAvatar());

        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                if (this.currentActivity) {
                    this.stopActivity();
                } else {
                    this.showActivityModal(category);
                }
            });
        });

        document.getElementById('modalCancel').addEventListener('click', () => this.hideActivityModal());
        document.getElementById('modalStart').addEventListener('click', () => this.startActivity());
        document.getElementById('activityInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startActivity();
        });

        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.navigateTo(page);
                this.toggleMenu();
            });
        });

        document.getElementById('createCircleBtn').addEventListener('click', () => this.createCircle());
    }

    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                document.getElementById('username').textContent = user.displayName || 'User';
                document.getElementById('userAvatar').src = user.photoURL || 'assets/default-avatar.svg';
                document.getElementById('googleLoginBtn').textContent = 'Sign Out';
                await this.loadUserData();
            } else {
                this.currentUser = null;
                document.getElementById('username').textContent = 'Guest User';
                document.getElementById('userAvatar').src = 'assets/default-avatar.svg';
                document.getElementById('googleLoginBtn').innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 18 18">
                        <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                        <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                        <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                        <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                    </svg>
                    Sign in with Google
                `;
                this.loadFromSessionStorage();
            }
            this.updateUI();
            this.updateStats();
        });
    }

    async handleGoogleLogin() {
        if (this.currentUser) {
            await signOut(auth);
            this.todayData = { productive: 0, personal: 0, sleep: 0, activities: [] };
            this.updateUI();
            this.updateStats();
        } else {
            try {
                const result = await signInWithPopup(auth, googleProvider);
                const user = result.user;
                
                // --- PERUBAHAN PENTING ---
                // Simpan info profil ke Firestore agar bisa dilihat anggota circle
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    displayName: user.displayName,
                    photoURL: user.photoURL
                }, { merge: true }); // 'merge' agar tidak menimpa data 'circles'

            } catch (error) {
                console.error('Login error:', error);
                this.showToast('Login failed. Please try again.');
            }
        }
    }
    
    changeAvatar() {
        this.showToast('Change Avatar feature coming soon!');
    }

    toggleMenu() {
        document.getElementById('menuToggle').classList.toggle('active');
        document.getElementById('sidenav').classList.toggle('active');
    }

    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(page).classList.add('active');
        document.querySelectorAll('.nav-menu a').forEach(link => link.classList.remove('active'));
        
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) activeLink.classList.add('active');

        if (page === 'statistics') {
            this.renderStatistics();
        } else if (page === 'circle') {
            this.loadCircle();
        }
    }

    showActivityModal(category) {
        this.selectedCategory = category;
        document.getElementById('activityModal').classList.add('active');
        document.getElementById('activityInput').value = '';
        document.getElementById('activityInput').focus();
    }

    hideActivityModal() {
        document.getElementById('activityModal').classList.remove('active');
    }

    startActivity() {
        const activityName = document.getElementById('activityInput').value.trim();
        if (!activityName) {
            this.showToast('Please enter an activity name');
            return;
        }

        this.currentActivity = {
            name: activityName,
            category: this.selectedCategory,
            startTime: Date.now()
        };

        this.startTime = Date.now();
        this.elapsedSeconds = 0;
        this.startTimer();
        this.hideActivityModal();
        this.updateUI();
        
        const btn = document.querySelector(`.start-btn[data-category="${this.selectedCategory}"]`);
        btn.textContent = 'Stop';
        btn.classList.add('active');
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            this.updateTimerDisplay();
        }, 1000);
    }

    updateTimerDisplay() {
        const hours = Math.floor(this.elapsedSeconds / 3600);
        const minutes = Math.floor((this.elapsedSeconds % 3600) / 60);
        const seconds = this.elapsedSeconds % 60;
        
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('timerDisplay').textContent = timeString;
        
        if (this.currentActivity) {
            const elapsed = Math.floor(this.elapsedSeconds / 60);
            document.getElementById('activityElapsed').textContent = `${elapsed} min`;
        }

        if (this.currentActivity) {
            const circumference = 565.48;
            const totalSeconds = 8 * 3600;
            const categorySeconds = this.todayData[this.currentActivity?.category] || 0;
            const progress = ((categorySeconds + this.elapsedSeconds) / totalSeconds) * circumference;
            document.getElementById('timerProgress').style.strokeDashoffset = circumference - progress;
        }
    }

    stopActivity() {
        if (!this.currentActivity) return;

        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        
        const activity = {
            name: this.currentActivity.name,
            category: this.currentActivity.category,
            duration: duration,
            timestamp: this.currentActivity.startTime,
            date: this.getTodayDate()
        };

        this.todayData.activities.push(activity);
        this.todayData[this.currentActivity.category] += duration;

        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.currentActivity = null;
        this.elapsedSeconds = 0;
        
        document.getElementById('timerDisplay').textContent = '00:00:00';
        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.textContent = 'Start';
            btn.classList.remove('active');
        });
        
        if (this.currentUser) {
            this.saveToFirebase();
        } else {
            this.saveToSessionStorage();
        }
        
        this.updateUI();
        this.updateStats();
        this.showToast('Nice job! Activity saved ✨');
    }

    updateUI() {
        if (this.currentActivity) {
            document.getElementById('currentActivity').style.display = 'block';
            document.getElementById('activityName').textContent = this.currentActivity.name;
        } else {
            document.getElementById('currentActivity').style.display = 'none';
        }

        ['productive', 'personal', 'sleep'].forEach(category => {
            const hours = (this.todayData[category] / 3600).toFixed(1);
            document.getElementById(`${category}Time`).textContent = `${hours}h`;
            
            const percentage = (this.todayData[category] / (8 * 3600)) * 100;
            document.getElementById(`${category}Progress`).style.width = `${Math.min(percentage, 100)}%`;
        });
    }

    updateStats() {
        const total = this.todayData.productive + this.todayData.personal + this.todayData.sleep;
        const empty = Math.max(0, (24 * 3600) - total);

        const data = {
            productive: this.todayData.productive,
            personal: this.todayData.personal,
            sleep: this.todayData.sleep,
            empty: empty
        };

        this.renderPieChart(data);
    }

    renderPieChart(data) {
        const canvas = document.getElementById('pieChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 120;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const total = Object.values(data).reduce((a, b) => a + b, 0);
        if (total === 0) return;

        const colors = {
            productive: '#5B9BD5',
            personal: '#ED7D31',
            sleep: '#70AD47',
            empty: '#E5E5E5'
        };

        let startAngle = -Math.PI / 2;

        Object.entries(data).forEach(([category, value]) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[category];
            ctx.fill();
            startAngle += sliceAngle;
        });

        this.renderLegend(data, colors);
    }

    renderLegend(data, colors) {
        const legend = document.getElementById('chartLegend');
        if (!legend) return;
        legend.innerHTML = '';
        Object.entries(data).forEach(([category, seconds]) => {
            const hours = (seconds / 3600).toFixed(1);
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background: ${colors[category]}"></div>
                <span>${category.charAt(0).toUpperCase() + category.slice(1)}: ${hours}h</span>
            `;
            legend.appendChild(item);
        });
    }

    renderStatistics() {
        const activityList = document.getElementById('activityList');
        if (this.todayData.activities.length === 0) {
            activityList.innerHTML = '<p class="empty-state">No activities recorded yet.</p>';
            return;
        }
        activityList.innerHTML = '';
        const sortedActivities = [...this.todayData.activities].reverse();
        sortedActivities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            const time = new Date(activity.timestamp);
            const duration = Math.floor(activity.duration / 60);
            item.innerHTML = `
                <div class="activity-info">
                    <h4>${activity.name}</h4>
                    <p>${activity.category} • ${time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <div class="activity-duration">${duration} min</div>
            `;
            activityList.appendChild(item);
        });
    }

    setupDailyReset() {
        setInterval(() => {
            const lastReset = localStorage.getItem('lastReset');
            const today = this.getTodayDate();
            if (lastReset !== today) {
                this.resetDaily();
            }
        }, 60000);
    }

    resetDaily() {
        this.todayData = { productive: 0, personal: 0, sleep: 0, activities: [] };
        localStorage.setItem('lastReset', this.getTodayDate());
        if (this.currentUser) {
            this.saveToFirebase();
        } else {
            this.saveToSessionStorage();
        }
        this.updateUI();
        this.updateStats();
        this.showToast('New day started! 🌅');
    }

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    saveToSessionStorage() {
        sessionStorage.setItem('eightifyData', JSON.stringify(this.todayData));
    }

    loadFromSessionStorage() {
        const data = sessionStorage.getItem('eightifyData');
        const lastReset = localStorage.getItem('lastReset');
        const today = this.getTodayDate();
        if (data && lastReset === today) {
            this.todayData = JSON.parse(data);
        } else {
            this.resetDaily();
        }
    }

    async saveToFirebase() {
        if (!this.currentUser) return;
        try {
            const today = this.getTodayDate();
            const userDoc = doc(db, 'users', this.currentUser.uid, 'days', today);
            await setDoc(userDoc, {
                ...this.todayData,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving to Firebase:', error);
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;
        try {
            const today = this.getTodayDate();
            const userDoc = doc(db, 'users', this.currentUser.uid, 'days', today);
            const docSnap = await getDoc(userDoc);
            if (docSnap.exists()) {
                const data = docSnap.data();
                this.todayData = {
                    productive: data.productive || 0,
                    personal: data.personal || 0,
                    sleep: data.sleep || 0,
                    activities: data.activities || []
                };
            } else {
                this.todayData = { productive: 0, personal: 0, sleep: 0, activities: [] };
            }
            this.updateUI();
            this.updateStats();
        } catch (error) {
            console.error('Error loading from Firebase:', error);
        }
    }

    async createCircle() {
        if (!this.currentUser) {
            this.showToast('Please sign in to create a circle');
            return;
        }
        const name = document.getElementById('circleName').value.trim();
        if (!name) {
            this.showToast('Please enter a circle name');
            return;
        }
        try {
            const circleRef = doc(collection(db, 'circles'));
            const circleId = circleRef.id;
            const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
            await setDoc(circleRef, {
                name: name,
                description: document.getElementById('circleDescription').value.trim(),
                inviteCode: inviteCode,
                createdBy: this.currentUser.uid,
                members: [this.currentUser.uid],
                createdAt: serverTimestamp()
            });
            const userCircleRef = doc(db, 'users', this.currentUser.uid);
            await setDoc(userCircleRef, {
                circles: arrayUnion(circleId)
            }, { merge: true });
            this.showToast(`Circle created! Invite code: ${inviteCode}`);
            document.getElementById('circleName').value = '';
            document.getElementById('circleDescription').value = '';
            this.navigateTo('circle');
        } catch (error) {
            console.error('Error creating circle:', error);
            this.showToast('Failed to create circle');
        }
    }

    async joinCircle() {
        if (!this.currentUser) {
            this.showToast('Please sign in to join a circle');
            return;
        }
        const code = prompt('Enter invite code:');
        if (!code || code.trim() === '') return;
        try {
            const q = query(collection(db, 'circles'), where("inviteCode", "==", code.trim().toUpperCase()));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                this.showToast('Invalid invite code');
                return;
            }
            const circleDoc = querySnapshot.docs[0];
            const circleId = circleDoc.id;
            await updateDoc(doc(db, 'circles', circleId), {
                members: arrayUnion(this.currentUser.uid)
            });
            const userRef = doc(db, 'users', this.currentUser.uid);
            await setDoc(userRef, {
                circles: arrayUnion(circleId)
            }, { merge: true });
            this.showToast(`Successfully joined "${circleDoc.data().name}"!`);
            this.navigateTo('circle');
        } catch (error) {
            console.error('Error joining circle:', error);
            this.showToast('Failed to join circle');
        }
    }

    // --- FUNGSI BARU UNTUK TAMPILAN CIRCLE ---

    async loadCircle() {
        const contentEl = document.getElementById('circleContent');
        
        if (!this.currentUser) {
            contentEl.innerHTML = '<p class="empty-state">Please sign in to join a circle.</p>';
            return;
        }

        const userRef = doc(db, 'users', this.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (!userData || !userData.circles || userData.circles.length === 0) {
            contentEl.innerHTML = `
                <p class="empty-state">You haven't joined a circle yet.</p>
                <button class="join-circle-btn" id="joinCircleBtnDynamic">Join a Circle</button>
            `;
            document.getElementById('joinCircleBtnDynamic').addEventListener('click', () => this.joinCircle());
            return;
        }

        contentEl.innerHTML = '<p class="empty-state">Loading Circle data...</p>';

        try {
            const circleId = userData.circles[0];
            const circleRef = doc(db, 'circles', circleId);
            const circleSnap = await getDoc(circleRef);

            if (!circleSnap.exists()) {
                contentEl.innerHTML = '<p class="empty-state">Error: Circle not found.</p>';
                return;
            }

            const circleData = circleSnap.data();
            const memberIds = circleData.members || [];
            const today = this.getTodayDate();

            // 1. Ambil data profil DAN data harian untuk semua anggota
            const memberPromises = memberIds.map(async (uid) => {
                const memberProfileRef = doc(db, 'users', uid);
                const memberDayRef = doc(db, 'users', uid, 'days', today);
                
                const [profileSnap, daySnap] = await Promise.all([getDoc(memberProfileRef), getDoc(memberDayRef)]);

                const profile = profileSnap.exists() ? profileSnap.data() : {};
                const daily = daySnap.exists() ? daySnap.data() : { productive: 0, personal: 0, sleep: 0, activities: [] };

                return {
                    uid: uid,
                    name: profile.displayName || 'Unknown Member',
                    avatar: profile.photoURL,
                    initials: this.getInitials(profile.displayName || 'Unknown Member'),
                    ...daily
                };
            });

            const membersData = await Promise.all(memberPromises);

            // 2. Siapkan data untuk leaderboard (urutkan berdasarkan produktif HARI INI)
            const leaderboardData = [...membersData].sort((a, b) => b.productive - a.productive);

            // 3. Siapkan data untuk activity feed
            const allActivities = membersData.flatMap(member => 
                member.activities.map(act => ({ ...act, userName: member.name }))
            ).sort((a, b) => b.timestamp - a.timestamp); // Urutkan terbaru di atas

            // 4. Bangun HTML
            contentEl.innerHTML = `
                <div class="circle-header">
                    <div>
                        <h1>${circleData.name}</h1>
                        <p>${circleData.description || 'Stay motivated with your team'}</p>
                    </div>
                    <button class="invite-btn" id="inviteCircleBtn">Invite Members</button>
                </div>

                <div class="circle-main-grid">
                    <div class="circle-members-section">
                        <h2>Circle Members</h2>
                        <div class="circle-members-grid" id="circleMembersGrid">
                            ${membersData.map(member => this.createMemberCardHTML(member)).join('')}
                        </div>
                    </div>
                    
                    <div class="leaderboard-card">
                        <h2>Weekly Leaderboard</h2>
                        <p>Most productive hours this week</p>
                        <div class="leaderboard-list" id="leaderboardList">
                            ${leaderboardData.slice(0, 3).map((member, index) => this.createLeaderboardItemHTML(member, index + 1)).join('')}
                        </div>
                    </div>
                </div>

                <div class="activity-feed-card">
                    <h2>Activity Feed</h2>
                    <p>Recent activities from circle members</p>
                    <div class="activity-feed-list" id="activityFeedList">
                        ${allActivities.length > 0 ? allActivities.slice(0, 15).map(act => this.createFeedItemHTML(act)).join('') : '<p class="empty-state">No activity from members today.</p>'}
                    </div>
                </div>
            `;

            // 5. Tambahkan event listener untuk tombol invite
            document.getElementById('inviteCircleBtn').addEventListener('click', () => {
                prompt("Share this invite code with your team:", circleData.inviteCode);
            });

        } catch (error) {
            console.error("Error loading circle:", error);
            contentEl.innerHTML = '<p class="empty-state">Failed to load circle data.</p>';
        }
    }

    // --- FUNGSI HELPER BARU ---

    getInitials(name) {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }
    
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const seconds = Math.floor((now - timestamp) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
    }

    createMemberCardHTML(member) {
        const prodHours = (member.productive / 3600).toFixed(1);
        const persHours = (member.personal / 3600).toFixed(1);
        const sleepHours = (member.sleep / 3600).toFixed(1);

        const prodPercent = Math.min((member.productive / (8 * 3600)) * 100, 100);
        const persPercent = Math.min((member.personal / (8 * 3600)) * 100, 100);
        const sleepPercent = Math.min((member.sleep / (8 * 3600)) * 100, 100);

        return `
            <div class="member-card">
                <div class="member-info">
                    <div class="member-avatar" style="background-color: ${member.avatar ? 'transparent' : 'var(--border)'}">
                        ${member.avatar ? `<img src="${member.avatar}" alt="${member.name}">` : `<span>${member.initials}</span>`}
                    </div>
                    <span class="member-name">${member.name}</span>
                </div>
                <div class="member-stats">
                    <div class="stat-row">
                        <span>Productive</span>
                        <div class="stat-bar-container">
                            <div class="stat-bar productive" style="width: ${prodPercent}%"></div>
                        </div>
                        <span class="stat-hours">${prodHours}h</span>
                    </div>
                    <div class="stat-row">
                        <span>Personal</span>
                        <div class="stat-bar-container">
                            <div class="stat-bar personal" style="width: ${persPercent}%"></div>
                        </div>
                        <span class="stat-hours">${persHours}h</span>
                    </div>
                    <div class="stat-row">
                        <span>Sleep</span>
                        <div class="stat-bar-container">
                            <div class="stat-bar sleep" style="width: ${sleepPercent}%"></div>
                        </div>
                        <span class="stat-hours">${sleepHours}h</span>
                    </div>
                </div>
            </div>
        `;
    }

    createLeaderboardItemHTML(member, rank) {
        const hours = (member.productive / 3600).toFixed(1);
        return `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">#${rank}</span>
                <div class="member-avatar small" style="background-color: ${member.avatar ? 'transparent' : 'var(--border)'}">
                    ${member.avatar ? `<img src="${member.avatar}" alt="${member.name}">` : `<span>${member.initials}</span>`}
                </div>
                <span class="member-name">${member.name}</span>
                <span class="leaderboard-hours">${hours}h</span>
            </div>
        `;
    }

    createFeedItemHTML(activity) {
        const duration = Math.floor(activity.duration / 60);
        const durationText = duration > 0 ? `(${duration} min)` : '';
        const timeAgo = this.formatTimeAgo(activity.timestamp);

        return `
            <div class="feed-item">
                <div class="feed-icon">✓</div>
                <div class="feed-content">
                    <p><strong>${activity.userName}</strong> finished: ${activity.name} <em>${durationText}</em></p>
                    <span class="feed-time">${timeAgo}</span>
                </div>
            </div>
        `;
    }

    // --- AKHIR FUNGSI HELPER BARU ---

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

new EightifyApp();
