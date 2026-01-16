// NextGen Udaan MLM CRM Application
class NextGenUdaanApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.data = {
            users: [],
            prospects: [],
            activities: [],
            leaderboard: [],
            leads: [],
            employees: [],
            whatsappTemplates: [] // WhatsApp Message Templates
        };

        this.db = firebase.firestore();

        this.charts = {};
        this.init();
    }

    init() {
        // Force initialization after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.setupApp();
        }, 100);
    }

    setupApp() {
        this.setupEventListeners();
        this.checkAuthentication();
        this.initializeFeatherIcons();
    }

    initializeFeatherIcons() {
        // Initialize feather icons with retry mechanism
        const initFeather = () => {
            if (typeof feather !== 'undefined' && feather.replace) {
                feather.replace();
            } else {
                setTimeout(initFeather, 200);
            }
        };
        initFeather();
    }

    setupEventListeners() {
        // Login form - ensure we capture the form submission
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleLogin(e);
            });
        } else {
            console.error('Login form not found!');
        }


        // Main app event listeners (these will be setup when app loads)
        this.setupMainAppListeners();
    }

    setupMainAppListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.nav-item')) {
                e.preventDefault();
                const navItem = e.target.closest('.nav-item');
                const page = navItem.dataset.page;
                if (page) {
                    this.showPage(page);
                }
            }
        });

        // Logout
        document.addEventListener('click', (e) => {
            if (e.target.closest('#logout-btn')) {
                e.preventDefault();
                this.handleLogout();
            }
        });

        // Sidebar toggle
        document.addEventListener('click', (e) => {
            if (e.target.closest('#sidebar-toggle')) {
                e.preventDefault();
                this.toggleSidebar();
            }
        });

        // View toggles removed

        // Search Prospects
        const searchInput = document.getElementById('prospect-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterProspects(e.target.value);
            });
        }

        // Status Filter Dropdown
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterProspectsByStatus(e.target.value);
            });
        }

        // Forms
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'add-prospect-form') {
                e.preventDefault();
                this.handleAddProspect(e);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'clear-form') {
                e.preventDefault();
                this.clearProspectForm();
            }
        });

        // Edit Prospect Form
        const editForm = document.getElementById('edit-prospect-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditProspect(e);
            });
        }

        // Data management
        document.addEventListener('click', (e) => {
            if (e.target.id === 'export-csv') {
                e.preventDefault();
                this.exportData('csv');
            }
            if (e.target.id === 'export-json') {
                e.preventDefault();
                this.exportData('json');
            }
            if (e.target.id === 'export-pdf') {
                e.preventDefault();
                this.exportData('pdf');
            }
            if (e.target.id === 'import-btn') {
                e.preventDefault();
                this.importData();
            }
            if (e.target.id === 'create-backup') {
                e.preventDefault();
                this.createBackup();
            }
            if (e.target.id === 'restore-backup') {
                e.preventDefault();
                this.restoreBackup();
            }
            if (e.target.id === 'clear-all-data') {
                e.preventDefault();
                this.clearAllData();
            }
        });

        // Modal close
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-close')) {
                e.preventDefault();
                this.closeModal();
            }
            // Close modal when clicking outside
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    checkAuthentication() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = {
                    id: user.uid,
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    role: 'member',
                    status: 'active'
                };
                this.setupRealtimeData();
                this.showApp();
            } else {
                this.currentUser = null;
                this.showLogin();
            }
        });
    }

    setupRealtimeData() {
        // Listen for employees (HRMS)
        this.db.collection('employees').where('status', '==', 'Active')
            .onSnapshot(snapshot => {
                this.data.employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Update views if necessary
                if (this.currentPage === 'prospects') {
                    this.renderProspectsTable();
                }
            });

        // Listen for prospects
        this.db.collection('prospects').orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.data.prospects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.loadPageContent(this.currentPage);
                if (this.currentPage === 'dashboard') this.updateMetrics();
            });

        // Listen for activities
        this.db.collection('activities').orderBy('timestamp', 'desc').limit(20)
            .onSnapshot(snapshot => {
                this.data.activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            });

        // Listen for users
        this.db.collection('users').onSnapshot(snapshot => {
            this.data.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        // Listen for joinRequests (Leads)
        this.db.collection('joinRequests').onSnapshot(snapshot => {
            this.data.leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (this.currentPage === 'lead-management') {
                this.renderLeadsTable();
            }
        });
    }

    handleLogin(e) {
        try {
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            if (!emailInput || !passwordInput) {
                console.error('Email or password input not found');
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                this.showError('Please enter both email and password');
                return;
            }

            // Show loading state on button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Login successful
                })
                .catch((error) => {
                    console.error('Firebase login error:', error.code, error.message);
                    this.showError(error.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                });

        } catch (error) {
            console.error('Login error:', error);
            this.showError('An error occurred during login. Please try again.');
        }
    }

    showError(message) {
        // Remove existing error
        const existingError = document.getElementById('login-error');
        if (existingError) {
            existingError.remove();
        }

        // Create new error
        const errorDiv = document.createElement('div');
        errorDiv.id = 'login-error';
        errorDiv.style.cssText = `
            color: var(--color-error);
            background: rgba(255, 84, 89, 0.1);
            border: 1px solid var(--color-error);
            padding: 12px;
            border-radius: 6px;
            margin-top: 16px;
            font-size: 14px;
            animation: fadeIn 0.3s ease;
        `;
        errorDiv.textContent = message;

        const loginForm = document.querySelector('.login-form');
        if (loginForm) {
            loginForm.appendChild(errorDiv);
        }

        // Auto-hide error after 5 seconds
        setTimeout(() => {
            if (errorDiv && errorDiv.parentNode) {
                errorDiv.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => errorDiv.remove(), 300);
            }
        }, 5000);
    }

    handleLogout() {
        firebase.auth().signOut().then(() => {
            // Clear charts
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            this.charts = {};
            this.showLogin();
        }).catch((error) => {
            console.error('Sign out error:', error);
        });
    }

    showLogin() {
        const loginPage = document.getElementById('login-page');
        const app = document.getElementById('app');

        if (loginPage && app) {
            loginPage.classList.remove('hidden');
            app.classList.add('hidden');
        }

        // Clear form
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';

        // Remove any errors
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    showApp() {
        const loginPage = document.getElementById('login-page');
        const app = document.getElementById('app');

        if (loginPage && app) {
            loginPage.classList.add('hidden');
            app.classList.remove('hidden');
        }

        this.updateUserInfo();
        this.setupRoleBasedAccess();
        this.showPage('dashboard');

        // Initialize feather icons for the main app
        setTimeout(() => {
            this.initializeFeatherIcons();
        }, 100);
    }

    updateUserInfo() {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement && this.currentUser) {
            userNameElement.textContent = this.currentUser.name;
        }
    }

    setupRoleBasedAccess() {
        // Role-based access logic removed
    }

    showPage(pageName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.querySelector(`[data-page="${pageName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Update page title
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            pageTitle.textContent = this.getPageTitle(pageName);
        }

        // Show page content
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Load page-specific content
        this.loadPageContent(pageName);
        this.currentPage = pageName;

        // Update feather icons
        setTimeout(() => {
            this.initializeFeatherIcons();
        }, 100);
    }

    getPageTitle(pageName) {
        const titles = {
            'dashboard': 'Dashboard',
            'prospects': 'Prospects',
            'add-prospect': 'Add Prospect',
            'analytics': 'Analytics',
            'data-management': 'Data Management',
            'lead-management': 'Lead Management',
            'whatsapp': 'WhatsApp Messaging'
        };
        return titles[pageName] || 'Dashboard';
    }

    loadPageContent(pageName) {
        try {
            switch (pageName) {
                case 'dashboard':
                    this.loadDashboard();
                    break;
                case 'prospects':
                    this.loadProspects();
                    break;
                case 'add-prospect':
                    this.loadAddProspectForm();
                    break;
                case 'analytics':
                    this.loadAnalytics();
                    break;
                case 'data-management':
                    // No specific load logic needed
                    break;
                case 'lead-management':
                    this.loadLeadManagement();
                    break;
                case 'whatsapp':
                    this.loadWhatsAppPage();
                    break;
            }
        } catch (error) {
            console.error(`Error loading page content for ${pageName}:`, error);
        }
    }

    loadDashboard() {
        this.updateMetrics();

        // Delay chart rendering to ensure DOM is ready
        setTimeout(() => {
            this.renderCharts();
        }, 300);
    }

    updateMetrics() {
        const totalProspects = this.data.prospects.length;
        const interestedProspects = this.data.prospects.filter(p => ['interested', 'hot'].includes(p.interestLevel) || p.status === 'contacted').length;
        const joinedMembers = this.data.prospects.filter(p => p.status === 'joined').length;
        const activeMembers = this.data.users.filter(u => u.status === 'active').length;

        // Calculate growth metrics
        const totalProspectsGrowth = this.calculateGrowth(this.data.prospects);
        const interestedGrowth = this.calculateGrowth(this.data.prospects.filter(p => ['interested', 'hot'].includes(p.interestLevel) || p.status === 'contacted'));
        const joinedGrowth = this.calculateGrowth(this.data.prospects.filter(p => p.status === 'joined'));

        const elements = {
            'total-prospects': totalProspects,
            'interested-prospects': interestedProspects,
            'joined-members': joinedMembers,
            'active-members': activeMembers
        };

        const growthElements = {
            'prospects-growth': totalProspectsGrowth,
            'interested-growth': interestedGrowth,
            'joined-growth': joinedGrowth
        };

        // Update counts
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                const currentValue = parseInt(element.textContent) || 0;
                if (currentValue !== value) {
                    this.animateValue(element, currentValue, value, 500);
                } else {
                    element.textContent = value;
                }
            }
        });

        // Update growth labels
        Object.entries(growthElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                const formattedValue = (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
                element.textContent = formattedValue;
                element.classList.remove('positive', 'negative');
                if (value > 0) {
                    element.classList.add('positive');
                } else if (value < 0) {
                    element.classList.add('negative');
                }
            }
        });
    }

    calculateGrowth(items) {
        if (!items || items.length === 0) return 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let currentMonthCount = 0;
        let lastMonthCount = 0;

        items.forEach(item => {
            let date;
            if (item.createdAt && typeof item.createdAt.toDate === 'function') {
                date = item.createdAt.toDate();
            } else if (item.createdAt) {
                date = new Date(item.createdAt);
            } else {
                return;
            }

            if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                currentMonthCount++;
            } else if (date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear) {
                lastMonthCount++;
            }
        });

        if (lastMonthCount === 0) {
            return currentMonthCount > 0 ? 100 : 0;
        }

        return ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100;
    }

    animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // loadActivityFeed removed

    getEmptyState(message) {
        return `
            <div class="empty-state">
                <i data-feather="inbox"></i>
                <p>${message}</p>
            </div>
        `;
    }

    renderCharts() {
        if (typeof Chart === 'undefined') return;

        try {
            // Destroy existing charts
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            this.charts = {};

            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8892b0', usePointStyle: true, padding: 20 }
                    }
                }
            };

            // Status Distribution Chart
            const statusCtx = document.getElementById('status-chart');
            if (statusCtx) {
                const statusData = this.getStatusDistribution();
                this.charts.status = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(statusData).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                        datasets: [{
                            data: Object.values(statusData),
                            backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#64ffda', '#5D878F', '#DB4545'],
                            borderWidth: 2,
                            borderColor: '#ffffff',
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        ...commonOptions,
                        cutout: '70%'
                    }
                });
            }

            // Lead Source Chart
            const sourceCtx = document.getElementById('source-chart');
            if (sourceCtx) {
                const sourceData = this.getSourceDistribution();
                const labels = Object.keys(sourceData);
                this.charts.source = new Chart(sourceCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Prospects',
                            data: Object.values(sourceData),
                            backgroundColor: 'rgba(31, 184, 205, 0.6)',
                            borderColor: '#1FB8CD',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        ...commonOptions,
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892b0' } },
                            x: { grid: { display: false }, ticks: { color: '#8892b0' } }
                        }
                    }
                });
            }

            // Growth Chart (Dynamic based on creation dates)
            const growthCtx = document.getElementById('growth-chart');
            if (growthCtx) {
                const growthData = this.getGrowthData();
                this.charts.growth = new Chart(growthCtx, {
                    type: 'line',
                    data: {
                        labels: growthData.map(d => d.month),
                        datasets: [{
                            label: 'Monthly Additions',
                            data: growthData.map(d => d.count),
                            borderColor: '#1FB8CD',
                            backgroundColor: 'rgba(31, 184, 205, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: '#1FB8CD'
                        }]
                    },
                    options: {
                        ...commonOptions,
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892b0' } },
                            x: { grid: { display: false }, ticks: { color: '#8892b0' } }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error rendering charts:', error);
        }
    }

    getGrowthData() {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentYear = new Date().getFullYear();
        const monthlyCounts = new Array(12).fill(0);

        this.data.prospects.forEach(p => {
            // Handle Firestore timestamp or ISO string
            let date;
            if (p.createdAt && typeof p.createdAt.toDate === 'function') {
                date = p.createdAt.toDate();
            } else if (p.createdAt) {
                date = new Date(p.createdAt);
            } else {
                return; // Skip if no date
            }

            if (date.getFullYear() === currentYear) {
                monthlyCounts[date.getMonth()]++;
            }
        });

        // Return last 6 months
        const currentMonth = new Date().getMonth();
        return months.map((m, i) => ({ month: m, count: monthlyCounts[i] }))
            .slice(Math.max(0, currentMonth - 5), currentMonth + 1);
    }

    getStatusDistribution() {
        const distribution = {};
        this.data.prospects.forEach(prospect => {
            distribution[prospect.status] = (distribution[prospect.status] || 0) + 1;
        });
        return distribution;
    }

    getSourceDistribution() {
        const distribution = {};
        this.data.prospects.forEach(prospect => {
            distribution[prospect.leadSource] = (distribution[prospect.leadSource] || 0) + 1;
        });
        return distribution;
    }

    loadProspects() {
        this.renderProspectsTable();
    }

    renderProspectsTable(prospectsToRender = null) {
        const tbody = document.getElementById('prospects-tbody');
        if (!tbody) return;

        const prospects = prospectsToRender || this.data.prospects;
        tbody.innerHTML = '';

        if (prospects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8">${this.getEmptyState('No prospects found matching your search.')}</td></tr>`;
            return;
        }

        prospects.forEach(prospect => {
            const row = document.createElement('tr');

            // Create status dropdown
            const statusOptions = ['new', 'contacted', 'follow-up', 'interested', 'joined', 'lost']
                .map(s => `<option value="${s}" ${prospect.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`)
                .join('');

            row.innerHTML = `
                <td>${prospect.name}</td>
                <td>${prospect.phone}</td>
                <td>${prospect.email || 'N/A'}</td>
                <td>
                    <select class="status-select status--${this.getStatusClass(prospect.status)}" 
                            onchange="app.updateProspectStatus('${prospect.id}', this.value)"
                            style="width: 100%; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        ${statusOptions}
                    </select>
                </td>
                <td>${prospect.leadSource}</td>
                <td>${this.getAssignedName(prospect.assignedTo)}</td>
                <td>${this.formatDate(prospect.followUpDate)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="app.viewProspect('${prospect.id}')" title="View">
                            <i data-feather="eye"></i>
                        </button>
                        <button class="btn-icon" onclick="app.editProspect('${prospect.id}')" title="Edit">
                            <i data-feather="edit"></i>
                        </button>
                        <button class="btn-icon" onclick="app.deleteProspect('${prospect.id}')" title="Delete">
                            <i data-feather="trash-2"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        this.initializeFeatherIcons(); // Re-initialize icons for new rows
    }

    getStatusClass(status) {
        const classes = {
            'new': 'info',
            'contacted': 'warning',
            'follow-up': 'warning',
            'interested': 'success',
            'joined': 'success',
            'lost': 'error'
        };
        return classes[status] || 'info';
    }

    updateProspectStatus(id, newStatus) {
        this.showLoading();
        this.db.collection('prospects').doc(id).update({
            status: newStatus,
            updatedAt: new Date().toISOString()
        })
            .then(() => {
                this.hideLoading();
            })
            .catch(err => {
                console.error('Error updating status:', err);
                this.showError('Failed to update status');
                this.hideLoading();
            });
    }

    filterProspects(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const filtered = this.data.prospects.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.phone.includes(term) ||
            (p.email && p.email.toLowerCase().includes(term))
        );
        this.renderProspectsTable(filtered);
    }

    filterProspectsByStatus(status) {
        const filtered = (!status || status === 'all')
            ? this.data.prospects
            : this.data.prospects.filter(p => p.status === status);
        this.renderProspectsTable(filtered);
    }

    async loadAddProspectForm() {
        const assignInput = document.getElementById('assign-to-input');
        const assignList = document.getElementById('assign-to-list');
        const assignValue = document.getElementById('assign-to-value');

        if (!assignInput || !assignList) return;

        assignInput.value = 'Loading employees...';
        assignInput.disabled = true;

        try {
            // Fetch active employees from HRMS
            const employeesSnapshot = await this.db.collection('employees')
                .where('status', '==', 'Active')
                .get();

            assignInput.value = '';
            assignInput.disabled = false;
            assignInput.placeholder = 'Search by name or ID...';
            assignList.innerHTML = '';

            if (employeesSnapshot.empty) {
                assignInput.placeholder = 'No active employees found';
                assignInput.disabled = true;
                return;
            }

            // Store employee data for lookup
            const employeeMap = {};

            employeesSnapshot.docs.forEach(doc => {
                const employee = doc.data();
                const displayCode = employee.empCode ? ` (${employee.empCode})` : '';
                const displayText = `${employee.fullName}${displayCode} `;

                employeeMap[displayText] = doc.id;

                const option = document.createElement('option');
                option.value = displayText;
                assignList.appendChild(option);
            });

            // Handle selection
            assignInput.addEventListener('input', function () {
                if (employeeMap[this.value]) {
                    assignValue.value = employeeMap[this.value];
                } else {
                    assignValue.value = '';
                }
            });

            // Store for form submission
            assignInput.dataset.employeeMap = JSON.stringify(employeeMap);

        } catch (error) {
            console.error('Error loading employees:', error);
            assignInput.value = '';
            assignInput.placeholder = 'Error loading employees';
            assignInput.disabled = true;
        }

        // Set default follow-up date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const followUpDateInput = document.querySelector('[name="followUpDate"]');
        if (followUpDateInput) {
            followUpDateInput.value = tomorrow.toISOString().split('T')[0];
        }
    }



    showSuccess(message) {
        // Basic alert for now, could be upgraded to a toast later
        alert(message);
    }

    clearProspectForm() {
        const form = document.getElementById('add-prospect-form');
        if (form) {
            form.reset();
            // Reset follow-up date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const followUpDateInput = document.querySelector('[name="followUpDate"]');
            if (followUpDateInput) {
                followUpDateInput.value = tomorrow.toISOString().split('T')[0];
            }
        }
    }

    loadAnalytics() {
        this.renderLeaderboard();
        this.updateAnalyticsMetrics();
        setTimeout(() => {
            this.renderFunnelChart();
        }, 300);
    }

    updateAnalyticsMetrics() {
        const total = this.data.prospects.length;
        if (total === 0) return;

        const joined = this.data.prospects.filter(p => p.status === 'joined').length;
        const active = this.data.prospects.filter(p => !['joined', 'lost'].includes(p.status)).length;

        const conversionRate = ((joined / total) * 100).toFixed(1);
        const successRate = total > 0 ? ((joined / (total - active || 1)) * 100).toFixed(1) : 0;

        const elements = {
            'analytics-conversion-rate': conversionRate + '%',
            'analytics-active-prospects': active,
            'analytics-success-rate': successRate + '%'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    renderLeaderboard() {
        const leaderboardList = document.getElementById('leaderboard-list');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '';

        if (!this.data.employees || this.data.employees.length === 0) {
            leaderboardList.innerHTML = this.getEmptyState('No active team members data found.');
            return;
        }

        // Calculate leaders from actual EMPLOYEES and their conversions
        const leaders = this.data.employees.map(emp => {
            const empProspects = this.data.prospects.filter(p => p.assignedTo === emp.id);
            const conversions = empProspects.filter(p => p.status === 'joined').length;
            // Points: 100 per conversion, 10 per lead
            const points = (conversions * 100) + (empProspects.length * 10);
            return {
                userName: emp.fullName || emp.name,
                points: points,
                conversions: conversions,
                leadsAdded: empProspects.length
            };
        })
            .filter(l => l.points > 0) // Only show active employees
            .sort((a, b) => b.points - a.points)
            .slice(0, 5);

        if (leaders.length === 0) {
            leaderboardList.innerHTML = this.getEmptyState('No performance data available yet.');
            return;
        }

        leaders.forEach((item, index) => {
            const leaderboardItem = document.createElement('div');
            leaderboardItem.className = 'leaderboard-item';

            const rank = index + 1;
            const badgeClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';

            leaderboardItem.innerHTML = `
                <div class="rank-badge ${badgeClass}">${rank}</div>
                <div class="leaderboard-info">
                    <h5>${item.userName}</h5>
                    <p>${item.points} pts • ${item.conversions} conv • ${item.leadsAdded} leads</p>
                </div>
            `;
            leaderboardList.appendChild(leaderboardItem);
        });
    }

    renderFunnelChart() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded for funnel chart');
            return;
        }

        try {
            const funnelCtx = document.getElementById('funnel-chart');
            if (!funnelCtx) return;

            // Destroy existing chart
            if (this.charts.funnel) {
                this.charts.funnel.destroy();
            }

            const statusData = this.getStatusDistribution();

            this.charts.funnel = new Chart(funnelCtx, {
                type: 'bar',
                data: {
                    labels: ['New', 'Contacted', 'Follow-up', 'Interested', 'Joined'],
                    datasets: [{
                        label: 'Prospects',
                        data: [
                            statusData.new || 0,
                            statusData.contacted || 0,
                            statusData['follow-up'] || 0,
                            statusData.interested || 0,
                            statusData.joined || 0
                        ],
                        backgroundColor: [
                            'rgba(31, 184, 205, 0.8)',
                            'rgba(255, 193, 133, 0.8)',
                            'rgba(180, 65, 60, 0.8)',
                            'rgba(100, 255, 218, 0.8)',
                            'rgba(93, 135, 143, 0.8)'
                        ],
                        borderColor: '#1FB8CD',
                        borderWidth: 1,
                        borderRadius: 5,
                        barThickness: 30
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#8892b0' }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: '#8892b0', font: { weight: 'bold' } }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering funnel chart:', error);
        }
    }

    loadLeadManagement() {
        this.renderLeadsTable();
        this.setupLeadManagementListeners();
    }

    renderLeadsTable(leadsToRender = null) {
        const tbody = document.getElementById('leads-tbody');
        if (!tbody) return;

        const leads = leadsToRender || this.data.leads;
        tbody.innerHTML = '';
        if (!leads || leads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: var(--space-32);">
                        <div class="empty-state">
                            <i data-feather="inbox" style="width: 48px; height: 48px; margin-bottom: var(--space-16); opacity: 0.5;"></i>
                            <p style="color: var(--color-text-secondary); margin: 0;">No leads found. Leads will appear here when prospects submit join requests.</p>
                        </div>
                    </td>
                </tr>
            `;
            this.initializeFeatherIcons();
            return;
        }

        leads.forEach(lead => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="lead-checkbox" data-id="${lead.id}"></td>
                <td>${lead.name || 'N/A'}</td>
                <td>${lead.phone || 'N/A'}</td>
                <td>${lead.email || 'N/A'}</td>
                <td>${lead.location || 'N/A'}</td>
                <td>${this.formatDate(lead.timestamp?.toDate ? lead.timestamp.toDate() : lead.timestamp)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn--icon btn--success btn--sm transfer-lead" data-id="${lead.id}" title="Transfer to Prospect">
                            <i data-feather="user-plus"></i>
                        </button>
                        <button class="btn btn--icon btn--error btn--sm delete-lead" data-id="${lead.id}" title="Delete Lead">
                            <i data-feather="trash-2"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.initializeFeatherIcons();
    }

    setupLeadManagementListeners() {
        // Search leads
        const searchInput = document.getElementById('lead-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterLeads(e.target.value);
            });
        }

        // Action delegation for table
        const tbody = document.getElementById('leads-tbody');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const transferBtn = e.target.closest('.transfer-lead');
                const deleteBtn = e.target.closest('.delete-lead');

                if (transferBtn) {
                    this.transferLeadToProspect(transferBtn.dataset.id);
                } else if (deleteBtn) {
                    this.deleteLead(deleteBtn.dataset.id);
                }
            });
        }

        // Filter leads
        const filterBtn = document.getElementById('filter-leads-btn');
        if (filterBtn) {
            filterBtn.onclick = () => this.applyLeadFilters();
        }

        // Select all
        const selectAll = document.getElementById('select-all-leads');
        if (selectAll) {
            selectAll.onchange = (e) => {
                document.querySelectorAll('.lead-checkbox').forEach(cb => cb.checked = e.target.checked);
            };
        }

        // Delete selected
        const deleteSelectedBtn = document.getElementById('delete-selected-leads');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.onclick = () => this.deleteSelectedLeads();
        }

        // Export
        const exportBtn = document.getElementById('export-leads-btn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportLeads();
        }
    }

    applyLeadFilters() {
        const start = document.getElementById('lead-start-date').value;
        const end = document.getElementById('lead-end-date').value;

        let filteredLeads = this.data.leads;

        if (start) {
            const startDate = new Date(start);
            filteredLeads = filteredLeads.filter(l => {
                const date = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
                return date >= startDate;
            });
        }

        if (end) {
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            filteredLeads = filteredLeads.filter(l => {
                const date = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
                return date <= endDate;
            });
        }

        this.renderLeadsTable(filteredLeads);
    }

    filterLeads(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const filtered = this.data.leads.filter(l =>
            l.name.toLowerCase().includes(term) ||
            l.phone.includes(term) ||
            (l.email && l.email.toLowerCase().includes(term)) ||
            (l.location && l.location.toLowerCase().includes(term))
        );
        this.renderLeadsTable(filtered);
    }

    async transferLeadToProspect(id) {
        const lead = this.data.leads.find(l => l.id === id);
        if (!lead) return;

        if (confirm(`Do you want to transfer ${lead.name} to the Prospect list ? `)) {
            this.showLoading();
            try {
                // 1. Create Prospect with ALL lead data
                // Field mapping based on lead submission form
                const prospectData = {
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email || '',
                    age: lead.age || null,
                    location: lead.location || 'Unknown',
                    occupation: lead.occupation || lead.whatTheyDo || '', // Map whatTheyDo -> occupation
                    instagram: lead.instagram || lead.instagramId || '', // Map instagramId -> instagram
                    interestLevel: lead.interestLevel || 'medium',
                    status: 'new',
                    leadSource: this.getNormalizedLeadSource(lead.leadSource),
                    followUpDate: lead.followUpDate || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    assignedTo: this.currentUser.id,
                    notes: `Transferred from Leads on ${new Date().toLocaleDateString()}. ${lead.whyWantToJoin ? '\nWhy Join: ' + lead.whyWantToJoin : ''} ${lead.notes ? '\nOriginal notes: ' + lead.notes : ''}`
                };

                await this.db.collection('prospects').add(prospectData);

                // 2. Delete Lead
                await this.db.collection('joinRequests').doc(id).delete();

                // 3. Log Activity
                await this.db.collection('activities').add({
                    userId: this.currentUser.id,
                    action: 'Lead Transferred',
                    details: `${lead.name} promoted to Prospect.`,
                    timestamp: new Date().toISOString()
                });

                this.showSuccess(`${lead.name} transferred successfully!`);
            } catch (error) {
                console.error('Transfer error:', error);
                this.showError('Failed to transfer lead');
            } finally {
                this.hideLoading();
            }
        }
    }

    deleteLead(id) {
        if (confirm('Are you sure you want to delete this lead?')) {
            this.showLoading();
            this.db.collection('joinRequests').doc(id).delete()
                .then(() => {
                    this.showSuccess('Lead deleted successfully');
                    this.hideLoading();
                })
                .catch(err => {
                    console.error('Delete lead error:', err);
                    this.showError('Error deleting lead');
                    this.hideLoading();
                });
        }
    }

    deleteSelectedLeads() {
        const selectedIds = Array.from(document.querySelectorAll('.lead-checkbox:checked')).map(cb => cb.dataset.id);
        if (selectedIds.length === 0) return alert('Please select leads to delete');

        if (confirm(`Are you sure you want to delete ${selectedIds.length} leads ? `)) {
            const batch = this.db.batch();
            selectedIds.forEach(id => {
                batch.delete(this.db.collection('joinRequests').doc(id));
            });
            batch.commit()
                .then(() => alert('Leads deleted successfully'))
                .catch(err => console.error('Error deleting leads:', err));
        }
    }

    exportLeads() {
        if (this.data.leads.length === 0) return alert('No leads to export');

        const csvContent = "data:text/csv;charset=utf-8,"
            + "Name,Phone,Email,Location,Date\n"
            + this.data.leads.map(l => {
                const date = l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : l.timestamp;
                return `${l.name},${l.phone},${l.email},${l.location},${date} `;
            }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    renderGamificationLeaderboard() {
        const gamificationLeaderboard = document.getElementById('gamification-leaderboard');
        if (!gamificationLeaderboard) return;

        gamificationLeaderboard.innerHTML = '';

        this.data.leaderboard.forEach((item, index) => {
            const user = this.data.users.find(u => u.id === item.userId);
            if (!user) return;

            const gamificationItem = document.createElement('div');
            gamificationItem.className = 'gamification-item';
            gamificationItem.innerHTML = `
                < div class="rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}" > ${item.rank}</div >
                <div class="leaderboard-info" style="flex: 1;">
                    <h5>${item.userName}</h5>
                    <div class="badge-display">
                        ${user.badges.map(badge => `<span class="badge ${badge.toLowerCase().replace(/ /g, '-')}">${badge}</span>`).join('')}
                    </div>
                </div>
                <div class="points-display">${item.points} pts</div>
            `;
            gamificationLeaderboard.appendChild(gamificationItem);
        });
    }





    // Utility methods
    getAssignedName(id) {
        if (!id) return 'Unassigned';

        // Check employees first
        if (this.data.employees) {
            const employee = this.data.employees.find(e => e.id === id);
            if (employee) return employee.fullName || employee.name;
        }

        // Check users
        if (this.data.users) {
            const user = this.data.users.find(u => u.id === id);
            if (user) return user.name;
        }

        return 'Unknown';
    }

    getNormalizedLeadSource(source) {
        if (!source) return 'Other';
        const s = source.toLowerCase();

        if (s.includes('instagram') || s.includes('social')) return 'Instagram';
        if (s.includes('whatsapp')) return 'WhatsApp';
        if (s.includes('referral')) return 'Referral';
        if (s.includes('event')) return 'Event';
        if (s.includes('website')) return 'Other';

        return 'Other';
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }

    viewProspect(prospectId) {
        const prospect = this.data.prospects.find(p => p.id === prospectId);
        if (!prospect) return;

        const assignedUser = this.data.users.find(u => u.id === prospect.assignedTo);
        const modalBody = document.querySelector('#prospect-modal .modal-body');
        if (!modalBody) return;

        modalBody.innerHTML = `
                <div id="prospect-details">
                <h4>${prospect.name}</h4>
                <div class="profile-field">
                    <label>Phone:</label>
                    <span>${prospect.phone}</span>
                </div>
                <div class="profile-field">
                    <label>Email:</label>
                    <span id="view-email">${prospect.email || 'N/A'}</span>
                </div>
                <div class="profile-field">
                    <label>Age:</label>
                    <span id="view-age">${prospect.age || 'N/A'}</span>
                </div>
                <div class="profile-field">
                    <label>Occupation:</label>
                    <span id="view-occupation">${prospect.occupation || 'N/A'}</span>
                </div>
                <div class="profile-field">
                    <label>Instagram:</label>
                    <span id="view-instagram">${prospect.instagram || 'N/A'}</span>
                </div>
                <div class="profile-field">
                    <label>Interest Level:</label>
                    <span class="status status--${prospect.interestLevel === 'high' ? 'success' : prospect.interestLevel === 'medium' ? 'warning' : 'error'}">${prospect.interestLevel}</span>
                </div>
                <div class="profile-field">
                    <label>Lead Source:</label>
                    <span>${prospect.leadSource}</span>
                </div>
                <div class="profile-field">
                    <label>Assigned To:</label>
                    <span>${this.getAssignedName(prospect.assignedTo)}</span>
                </div>
                <div class="profile-field">
                    <label>Location:</label>
                    <span>${prospect.location || 'N/A'}</span>
                </div>
                <div class="profile-field">
                    <label>Status:</label>
                    <span class="status status--${this.getStatusClass(prospect.status)}">${prospect.status}</span>
                </div>
                <div class="profile-field">
                    <label>Follow-up Date:</label>
                    <span>${this.formatDate(prospect.followUpDate)}</span>
                </div>
                <div class="profile-field">
                    <label>Notes:</label>
                    <span>${prospect.notes || 'No notes available.'}</span>
                </div>
            </div > >
                `;

        const modal = document.getElementById('prospect-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    async editProspect(prospectId) {
        const prospect = this.data.prospects.find(p => p.id === prospectId);
        if (!prospect) return;

        const modal = document.getElementById('edit-prospect-modal');
        const form = document.getElementById('edit-prospect-form');
        const assignInput = document.getElementById('edit-assign-to-input');
        const assignList = document.getElementById('edit-assign-to-list');
        const assignValue = document.getElementById('edit-assign-to-value');

        if (!modal || !form || !assignInput || !assignList) return;

        // Populate assignment dropdown with HRMS employees
        assignInput.value = 'Loading employees...';
        assignInput.disabled = true;

        try {
            const employeesSnapshot = await this.db.collection('employees')
                .where('status', '==', 'Active')
                .get();

            assignInput.disabled = false;
            assignInput.placeholder = 'Search by name or ID...';
            assignList.innerHTML = '';

            if (!employeesSnapshot.empty) {
                const employeeMap = {};
                let currentAssignedText = '';

                employeesSnapshot.docs.forEach(doc => {
                    const employee = doc.data();
                    const displayCode = employee.empCode ? ` (${employee.empCode})` : '';
                    const displayText = `${employee.fullName}${displayCode} `;

                    employeeMap[displayText] = doc.id;

                    const option = document.createElement('option');
                    option.value = displayText;
                    assignList.appendChild(option);

                    // Find currently assigned employee
                    if (doc.id === prospect.assignedTo) {
                        currentAssignedText = displayText;
                    }
                });

                // Set current assignment
                assignInput.value = currentAssignedText;
                assignValue.value = prospect.assignedTo || '';

                // Handle selection
                assignInput.addEventListener('input', function () {
                    if (employeeMap[this.value]) {
                        assignValue.value = employeeMap[this.value];
                    } else {
                        assignValue.value = '';
                    }
                });

                assignInput.dataset.employeeMap = JSON.stringify(employeeMap);
            } else {
                assignInput.placeholder = 'No active employees found';
                assignInput.disabled = true;
            }
        } catch (error) {
            console.error('Error loading employees:', error);
            assignInput.placeholder = 'Error loading employees';
            assignInput.disabled = true;
        }

        // Populate form fields
        form.querySelector('[name="prospect-id"]').value = prospect.id;
        form.querySelector('[name="name"]').value = prospect.name || '';
        form.querySelector('[name="phone"]').value = prospect.phone || '';
        form.querySelector('[name="email"]').value = prospect.email || '';
        form.querySelector('[name="age"]').value = prospect.age || '';
        form.querySelector('[name="occupation"]').value = prospect.occupation || '';
        form.querySelector('[name="instagram"]').value = prospect.instagram || '';
        form.querySelector('[name="status"]').value = prospect.status || 'new';
        form.querySelector('[name="interestLevel"]').value = prospect.interestLevel || 'medium';
        form.querySelector('[name="leadSource"]').value = prospect.leadSource || 'Other';
        // assignedTo is handled by the datalist population above
        form.querySelector('[name="location"]').value = prospect.location || '';
        form.querySelector('[name="notes"]').value = prospect.notes || '';

        if (prospect.followUpDate) {
            form.querySelector('[name="followUpDate"]').value = prospect.followUpDate;
        }

        modal.classList.remove('hidden');
        this.initializeFeatherIcons();
    }

    handleEditProspect(e) {
        const formData = new FormData(e.target);
        const id = formData.get('prospect-id');

        const updates = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            age: parseInt(formData.get('age')) || null,
            occupation: formData.get('occupation'),
            instagram: formData.get('instagram'),
            status: formData.get('status'),
            interestLevel: formData.get('interestLevel'),
            leadSource: formData.get('leadSource'),
            assignedTo: formData.get('assignedToId') || prospect.assignedTo,
            location: formData.get('location'),
            followUpDate: formData.get('followUpDate'),
            notes: formData.get('notes'),
            updatedAt: new Date().toISOString()
        };

        this.showLoading();
        this.db.collection('prospects').doc(id).update(updates)
            .then(() => {
                this.showSuccess('Prospect updated successfully');
                this.closeModal();
                this.hideLoading();
            })
            .catch(err => {
                console.error('Update error:', err);
                this.showError('Error updating prospect');
                this.hideLoading();
            });
    }

    deleteProspect(prospectId) {
        if (confirm('Are you sure you want to delete this prospect?')) {
            this.showLoading();
            this.db.collection('prospects').doc(prospectId).delete()
                .then(() => {
                    this.showSuccess('Prospect deleted successfully.');
                    this.hideLoading();
                })
                .catch(error => {
                    console.error('Error deleting prospect:', error);
                    this.showError('Error deleting prospect.');
                    this.hideLoading();
                });
        }
    }

    handleAddProspect(e) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);

            const newProspect = {
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                age: parseInt(formData.get('age')) || null,
                occupation: formData.get('occupation'),
                instagram: formData.get('instagram'),
                interestLevel: formData.get('interestLevel'),
                leadSource: formData.get('leadSource'),
                location: formData.get('location'),
                followUpDate: formData.get('followUpDate'),
                assignedTo: formData.get('assignedTo'),
                status: 'new',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: formData.get('notes')
            };

            this.showLoading();
            this.db.collection('prospects').add(newProspect)
                .then(() => {
                    this.db.collection('activities').add({
                        userId: this.currentUser.id,
                        action: 'Prospect Added',
                        details: `Added ${newProspect.name} from ${newProspect.leadSource} `,
                        timestamp: new Date().toISOString()
                    });
                    this.showSuccess('Prospect added successfully!');
                    this.clearProspectForm();
                    this.hideLoading();
                })
                .catch(error => {
                    console.error('Error adding prospect to Firestore:', error);
                    this.showError('Error adding prospect. Please try again.');
                    this.hideLoading();
                });

        } catch (error) {
            console.error('Error adding prospect:', error);
            this.showError('Error adding prospect. Please try again.');
        }
    }



    editUser(userId) {
        alert('Edit user functionality would be implemented here.');
    }

    showAddTeamMemberForm() {
        alert('Add team member form would be shown here.');
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }



    exportData(format) {
        try {
            let content = '';
            let fileName = `nextgen_prospects_${new Date().toISOString().split('T')[0]} `;
            let mimeType = '';

            if (format === 'csv') {
                const headers = ['Name', 'Phone', 'Email', 'Status', 'Interest', 'Location', 'Created'];
                const rows = this.data.prospects.map(p => [
                    p.name, p.phone, p.email || '', p.status, p.interestLevel, p.location, p.createdAt
                ].join(','));
                content = [headers.join(','), ...rows].join('\n');
                mimeType = 'text/csv';
                fileName += '.csv';
            } else if (format === 'json') {
                content = JSON.stringify(this.data, null, 2);
                mimeType = 'application/json';
                fileName += '.json';
            } else if (format === 'pdf') {
                // Simplified PDF export (prints the table section)
                window.print();
                return;
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Error exporting data');
        }
    }

    generateReport(type) {
        try {
            switch (type) {
                case 'prospects':
                    this.exportToCSV(
                        this.data.prospects,
                        ['Name', 'Phone', 'Email', 'Status', 'Lead Source', 'Assigned To', 'Created At'],
                        row => [
                            row.name,
                            row.phone,
                            row.email,
                            row.status,
                            row.leadSource,
                            this.getAssignedName(row.assignedTo),
                            this.formatDate(row.createdAt?.toDate ? row.createdAt.toDate() : row.createdAt)
                        ],
                        'all_prospects_report'
                    );
                    break;
                case 'prospects_status':
                    const statusCounts = this.data.prospects.reduce((acc, p) => {
                        acc[p.status] = (acc[p.status] || 0) + 1;
                        return acc;
                    }, {});
                    const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
                    this.exportToCSV(
                        statusData,
                        ['Status', 'Count'],
                        row => [row.status, row.count],
                        'status_analysis_report'
                    );
                    break;
                case 'prospects_source':
                    const sourceCounts = this.data.prospects.reduce((acc, p) => {
                        acc[p.leadSource] = (acc[p.leadSource] || 0) + 1;
                        return acc;
                    }, {});
                    const sourceData = Object.entries(sourceCounts).map(([source, count]) => ({ source, count }));
                    this.exportToCSV(
                        sourceData,
                        ['Lead Source', 'Count'],
                        row => [row.source, row.count],
                        'lead_source_report'
                    );
                    break;
                case 'leads':
                    this.exportToCSV(
                        this.data.leads || [],
                        ['Name', 'Phone', 'Email', 'Location', 'Date'],
                        row => [
                            row.name,
                            row.phone,
                            row.email,
                            row.location,
                            this.formatDate(row.timestamp?.toDate ? row.timestamp.toDate() : row.timestamp)
                        ],
                        'raw_leads_report'
                    );
                    break;
                case 'activities':
                    this.showLoading();
                    this.db.collection('activities').orderBy('timestamp', 'desc').get()
                        .then(snapshot => {
                            const allActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            this.exportToCSV(
                                allActivities,
                                ['User', 'Details', 'Timestamp'],
                                row => [
                                    this.getAssignedName(row.userId),
                                    row.details,
                                    this.formatDate(row.timestamp?.toDate ? row.timestamp.toDate() : row.timestamp)
                                ],
                                'activity_log_report'
                            );
                            this.hideLoading();
                        })
                        .catch(err => {
                            console.error('Activity report error:', err);
                            this.showError('Failed to fetch activities');
                            this.hideLoading();
                        });
                    break;
                case 'employee_performance':
                    const performanceData = (this.data.employees || []).map(emp => {
                        const empProspects = this.data.prospects.filter(p => p.assignedTo === emp.id);
                        const conversions = empProspects.filter(p => p.status === 'joined').length;
                        return {
                            name: emp.fullName || emp.name,
                            leads: empProspects.length,
                            conversions: conversions,
                            conversionRate: empProspects.length > 0 ? ((conversions / empProspects.length) * 100).toFixed(1) + '%' : '0%'
                        };
                    });
                    this.exportToCSV(
                        performanceData,
                        ['Employee', 'Total Leads Assigned', 'Conversions', 'Conversion Rate'],
                        row => [row.name, row.leads, row.conversions, row.conversionRate],
                        'employee_performance_report'
                    );
                    break;
                default:
                    this.showError('Unknown report type');
            }
        } catch (error) {
            console.error('Report generation error:', error);
            this.showError('Failed to generate report');
        }
    }

    exportToCSV(data, headers, rowMapper, filenameBase) {
        if (!data || data.length === 0) {
            this.showError('No data available for this report');
            return;
        }

        const csvContent = [
            headers.join(','),
            ...data.map(item => rowMapper(item).map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filenameBase}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    importData() {
        const fileInput = document.getElementById('import-file');
        if (!fileInput || fileInput.files.length === 0) {
            this.showError('Please select a CSV file to import');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            this.showLoading();
            try {
                const text = e.target.result;
                const rows = text.split(/\r?\n/).filter(line => line.trim());
                if (rows.length < 2) throw new Error('CSV is empty or missing headers');

                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                const nameIdx = headers.indexOf('name');
                const phoneIdx = headers.indexOf('phone');

                if (nameIdx === -1 || phoneIdx === -1) {
                    throw new Error('CSV must contain "Name" and "Phone" columns');
                }

                const prospects = [];
                for (let i = 1; i < rows.length; i++) {
                    const values = rows[i].split(',').map(v => v.trim());
                    if (values.length < 2) continue;

                    prospects.push({
                        name: values[nameIdx],
                        phone: values[phoneIdx],
                        email: values[headers.indexOf('email')] || '',
                        status: 'new',
                        interestLevel: values[headers.indexOf('interest')] || 'medium',
                        location: values[headers.indexOf('location')] || 'Unknown',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        assignedTo: this.currentUser.id,
                        notes: 'Imported via CSV'
                    });
                }

                // Chunked batch commits (max 500 per batch)
                const chunkSize = 400;
                for (let i = 0; i < prospects.length; i += chunkSize) {
                    const chunk = prospects.slice(i, i + chunkSize);
                    const batch = this.db.batch();
                    chunk.forEach(p => {
                        const ref = this.db.collection('prospects').doc();
                        batch.set(ref, p);
                    });
                    await batch.commit();
                }

                this.showSuccess(`Successfully imported ${prospects.length} prospects`);
                fileInput.value = '';
            } catch (err) {
                console.error('Import error:', err);
                this.showError(err.message || 'Error parsing CSV file');
            } finally {
                this.hideLoading();
            }
        };

        reader.readAsText(file);
    }

    loadProfile() {
        if (!this.currentUser) return;

        const nameInput = document.getElementById('profile-name-input');
        const emailInput = document.getElementById('profile-email-input');
        const roleInput = document.getElementById('profile-role-input');
        const joinedInput = document.getElementById('profile-joined-input');

        if (nameInput) nameInput.value = this.currentUser.name || '';
        if (emailInput) emailInput.value = this.currentUser.email || '';
        if (roleInput) roleInput.value = this.currentUser.role || 'User';
        if (joinedInput) joinedInput.value = this.formatDate(this.currentUser.createdAt) || 'N/A';

        const profileForm = document.getElementById('profile-form');
        if (profileForm && !profileForm.dataset.listener) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileUpdate(e);
            });
            profileForm.dataset.listener = 'true';
        }
    }

    handleProfileUpdate(e) {
        const formData = new FormData(e.target);
        const name = formData.get('name');

        if (!name) {
            this.showError('Name is required');
            return;
        }

        this.showLoading();
        this.db.collection('users').doc(this.currentUser.id).update({
            name: name,
            updatedAt: new Date().toISOString()
        })
            .then(() => {
                this.showSuccess('Profile updated successfully');
                this.hideLoading();
            })
            .catch(err => {
                console.error('Update profile error:', err);
                this.showError('Error updating profile');
                this.hideLoading();
            });
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    createBackup() {
        try {
            const backup = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                data: this.data
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crm_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showSuccess('System backup created successfully');
        } catch (error) {
            console.error('Backup error:', error);
            this.showError('Error creating backup');
        }
    }

    restoreBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (re) => {
                try {
                    const backup = JSON.parse(re.target.result);
                    if (!backup.data) throw new Error('Invalid backup format');

                    if (confirm('This will COMPLETELY OVERWRITE current data (prospects and leads). Are you absolutely sure?')) {
                        this.showLoading();

                        // 1. Clear Existing Data (Prospects & JoinRequests)
                        const collections = ['prospects', 'joinRequests'];
                        for (const col of collections) {
                            const snapshot = await this.db.collection(col).get();
                            const batch = this.db.batch();
                            snapshot.docs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                        }

                        // 2. Restore Prospects
                        if (backup.data.prospects && Array.isArray(backup.data.prospects)) {
                            for (let i = 0; i < backup.data.prospects.length; i += 400) {
                                const chunk = backup.data.prospects.slice(i, i + 400);
                                const batch = this.db.batch();
                                chunk.forEach(p => {
                                    const { id, ...data } = p;
                                    const ref = id ? this.db.collection('prospects').doc(id) : this.db.collection('prospects').doc();
                                    batch.set(ref, data);
                                });
                                await batch.commit();
                            }
                        }

                        // 3. Restore Leads (JoinRequests)
                        const leadsData = backup.data.leads || backup.data.joinRequests;
                        if (leadsData && Array.isArray(leadsData)) {
                            for (let i = 0; i < leadsData.length; i += 400) {
                                const chunk = leadsData.slice(i, i + 400);
                                const batch = this.db.batch();
                                chunk.forEach(l => {
                                    const { id, ...data } = l;
                                    const ref = id ? this.db.collection('joinRequests').doc(id) : this.db.collection('joinRequests').doc();
                                    batch.set(ref, data);
                                });
                                await batch.commit();
                            }
                        }

                        this.showSuccess('System restored successfully');
                    }
                } catch (err) {
                    console.error('Restore error:', err);
                    this.showError('Failed to restore backup: ' + err.message);
                } finally {
                    this.hideLoading();
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async clearAllData() {
        const confirmation = prompt('To confirm system reset, type "DELETE EVERYTHING" exactly:');
        if (confirmation === 'DELETE EVERYTHING') {
            this.showLoading();
            try {
                const collections = ['prospects', 'joinRequests', 'activities'];
                for (const col of collections) {
                    const snapshot = await this.db.collection(col).get();
                    if (snapshot.empty) continue;

                    const batch = this.db.batch();
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
                this.showSuccess('All system data cleared successfully');
            } catch (err) {
                console.error('Clear error:', err);
                this.showError('Error clearing system data');
            } finally {
                this.hideLoading();
            }
        } else if (confirmation !== null) {
            this.showError('Confirmation failed. Data was not cleared.');
        }
    }

    // --- WhatsApp Feature Methods ---

    loadWhatsAppPage() {
        this.currentChannel = 'whatsapp'; // Default channel
        this.renderTemplateList();
        this.setupWhatsAppEventListeners();

        // Listen for templates in realtime if not already doing so
        if (!this.whatsappListenerInitialized) {
            this.setupWhatsAppRealtimeData();
            this.whatsappListenerInitialized = true;
        }
    }

    setupWhatsAppRealtimeData() {
        this.db.collection('whatsappTemplates')
            .orderBy('updatedAt', 'desc')
            .onSnapshot(snapshot => {
                this.data.whatsappTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (this.currentPage === 'whatsapp') {
                    this.renderTemplateList();
                }
            }, err => {
                console.error('Error listening for templates:', err);
            });
    }

    setupWhatsAppEventListeners() {
        // Create template button
        const createBtn = document.getElementById('create-template-btn');
        if (createBtn) {
            createBtn.onclick = () => this.showTemplateForm();
        }

        // Template form submission
        const templateForm = document.getElementById('whatsapp-template-form');
        if (templateForm) {
            templateForm.onsubmit = (e) => {
                e.preventDefault();
                this.handleSaveTemplate();
            };
        }

        // Cancel template edit
        const cancelEditBtn = document.getElementById('cancel-template-edit');
        if (cancelEditBtn) {
            cancelEditBtn.onclick = () => this.showTemplateSection('template-list-section');
        }

        // Back to templates from messaging
        const backBtn = document.getElementById('back-to-templates');
        if (backBtn) {
            backBtn.onclick = () => this.showTemplateSection('template-list-section');
        }

        // Variable insertion buttons
        document.querySelectorAll('.btn-variable').forEach(btn => {
            btn.onclick = () => {
                const variable = btn.dataset.var;
                const textarea = document.getElementById('template-content');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const before = text.substring(0, start);
                const after = text.substring(end, text.length);
                textarea.value = before + '{{' + variable + '}}' + after;
                textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
                textarea.focus();
                textarea.focus();
                this.updateLivePreview(); // Update preview immediately
            };
        });

        // Channel Toggles
        document.querySelectorAll('.channel-btn').forEach(btn => {
            btn.onclick = () => {
                // Update active state
                document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update state
                this.currentChannel = btn.dataset.channel;

                // Refresh selection list
                this.selectedProspects = new Set();
                this.updateMessagingStats();
                this.renderProspectSelection();

                // Update Button Text
                const sendBtn = document.getElementById('send-bulk-btn');
                if (sendBtn) {
                    if (this.currentChannel === 'whatsapp') {
                        sendBtn.innerHTML = '<i data-feather="message-circle"></i> Send WhatsApp';
                    } else if (this.currentChannel === 'instagram') {
                        sendBtn.innerHTML = '<i data-feather="instagram"></i> Send Instagram';
                    } else if (this.currentChannel === 'email') {
                        sendBtn.innerHTML = '<i data-feather="mail"></i> Send Email';
                    }
                    feather.replace();
                }
            };
        });

        // Emoji insertion buttons
        document.querySelectorAll('.btn-emoji').forEach(btn => {
            btn.onclick = () => {
                const emoji = btn.textContent;
                const textarea = document.getElementById('template-content');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const before = text.substring(0, start);
                const after = text.substring(end, text.length);
                textarea.value = before + emoji + after;
                textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
                textarea.focus();
                this.updateLivePreview(); // Update preview immediately
            };
        });

        // Live Preview Input Listener
        const templateContent = document.getElementById('template-content');
        if (templateContent) {
            templateContent.oninput = () => this.updateLivePreview();
        }

        // Template filtering
        const typeFilter = document.getElementById('template-type-filter');
        if (typeFilter) {
            typeFilter.onchange = () => this.renderTemplateList(typeFilter.value);
        }

        // Prospect selection search and filters
        const prospectSearch = document.getElementById('prospect-selection-search');
        if (prospectSearch) {
            prospectSearch.oninput = () => this.renderProspectSelection();
        }

        const statusFilter = document.getElementById('prospect-status-filter');
        if (statusFilter) {
            statusFilter.onchange = () => this.renderProspectSelection();
        }

        const interestFilter = document.getElementById('prospect-interest-filter');
        if (interestFilter) {
            interestFilter.onchange = () => this.renderProspectSelection();
        }

        // Select/Deselect all
        const selectAll = document.getElementById('select-all-prospects');
        if (selectAll) {
            selectAll.onclick = () => this.toggleAllProspects(true);
        }
        const deselectAll = document.getElementById('deselect-all-prospects');
        if (deselectAll) {
            deselectAll.onclick = () => this.toggleAllProspects(false);
        }

        // Multi-send button
        const bulkSendBtn = document.getElementById('send-bulk-btn');
        if (bulkSendBtn) {
            bulkSendBtn.onclick = () => this.handleBulkSend();
        }
    }

    showTemplateSection(sectionId) {
        document.querySelectorAll('.whatsapp-section').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(sectionId);
        if (target) target.classList.remove('hidden');
    }

    showTemplateForm(template = null) {
        const form = document.getElementById('whatsapp-template-form');
        const title = document.getElementById('template-form-title');

        if (form) form.reset();
        const idField = document.getElementById('template-id');
        if (idField) idField.value = '';

        if (template) {
            if (title) title.innerHTML = '<i data-feather="edit-3"></i> Edit Template';
            if (idField) idField.value = template.id;
            document.getElementById('template-name').value = template.name;
            document.getElementById('template-type').value = template.type;
            document.getElementById('template-content').value = template.content;
        } else {
            if (title) title.innerHTML = '<i data-feather="plus"></i> Create Template';
        }

        this.showTemplateSection('template-form-section');
        this.initializeFeatherIcons();
        this.updateLivePreview(); // Initial preview render
    }

    updateLivePreview() {
        const textarea = document.getElementById('template-content');
        const previewText = document.getElementById('live-preview-content');

        if (!textarea || !previewText) return;

        let content = textarea.value;

        if (!content) {
            previewText.innerHTML = '<span style="color: grey; font-style: italic;">Start typing to see preview...</span>';
            return;
        }

        // Escape HTML to prevent injection but allow our custom highlighting
        content = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Highlight variables
        content = content.replace(/{{([^}]+)}}/g, '<span class="wa-variable-highlight">{{$1}}</span>');

        // Handle newlines
        content = content.replace(/\n/g, '<br>');

        previewText.innerHTML = content;

        // Update time
        const timeEl = document.querySelector('.wa-time');
        if (timeEl) {
            timeEl.textContent = new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    }

    async handleSaveTemplate() {
        const id = document.getElementById('template-id').value;
        const name = document.getElementById('template-name').value;
        const type = document.getElementById('template-type').value;
        const content = document.getElementById('template-content').value;


        const templateData = {
            name,
            type,
            content,
            updatedAt: new Date().toISOString()
        };

        this.showLoading();
        try {
            if (id) {
                await this.db.collection('whatsappTemplates').doc(id).update(templateData);
                this.showSuccess('Template updated successfully');
            } else {
                templateData.createdAt = new Date().toISOString();
                templateData.createdBy = this.currentUser.id;
                await this.db.collection('whatsappTemplates').add(templateData);
                this.showSuccess('Template created successfully');
            }
            this.showTemplateSection('template-list-section');
        } catch (err) {
            console.error('Error saving template:', err);
            this.showError('Failed to save template');
        } finally {
            this.hideLoading();
        }
    }

    async deleteTemplate(id) {
        if (!confirm('Are you sure you want to delete this template?')) return;

        this.showLoading();
        try {
            await this.db.collection('whatsappTemplates').doc(id).delete();
            this.showSuccess('Template deleted successfully');
        } catch (err) {
            console.error('Error deleting template:', err);
            this.showError('Failed to delete template');
        } finally {
            this.hideLoading();
        }
    }

    renderTemplateList(filterType = 'all') {
        const grid = document.getElementById('templates-grid');
        if (!grid) return;

        grid.innerHTML = '';

        const templates = filterType === 'all'
            ? this.data.whatsappTemplates
            : this.data.whatsappTemplates.filter(t => t.type === filterType);

        if (templates.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1">${this.getEmptyState('No templates found.')}</div>`;
            this.initializeFeatherIcons();
            return;
        }

        templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'template-card';
            card.innerHTML = `
                <div class="template-card-header">
                    <h4>${t.name}</h4>
                    <span class="template-badge badge-${t.type}">${t.type}</span>
                </div>
                <div class="template-content-preview">${t.content}</div>
                <div class="template-actions">
                    <button class="btn btn--primary btn--sm btn--full-width" onclick="app.startMessaging('${t.id}')">
                        <i data-feather="send"></i> Use
                    </button>
                    <button class="btn btn--secondary btn--sm" onclick="app.editTemplate('${t.id}')">
                        <i data-feather="edit"></i>
                    </button>
                    <button class="btn btn--error btn--sm" onclick="app.deleteTemplate('${t.id}')">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
        this.initializeFeatherIcons();
    }

    editTemplate(id) {
        const template = this.data.whatsappTemplates.find(t => t.id === id);
        if (template) this.showTemplateForm(template);
    }

    startMessaging(templateId) {
        this.selectedTemplateId = templateId;
        const template = this.data.whatsappTemplates.find(t => t.id === templateId);

        const titleEl = document.getElementById('selected-template-name');
        if (titleEl) titleEl.textContent = template.name;

        this.selectedProspects = new Set();
        this.renderProspectSelection();
        this.updateMessagingStats();
        this.showTemplateSection('send-messaging-section');
    }

    renderProspectSelection() {
        const list = document.getElementById('prospect-selection-list');
        if (!list) return;

        list.innerHTML = '';

        // Get filter values
        const searchTerm = document.getElementById('prospect-selection-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('prospect-status-filter')?.value || '';
        const interestFilter = document.getElementById('prospect-interest-filter')?.value || '';

        // Apply all filters
        const prospects = this.data.prospects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm) ||
                p.phone.includes(searchTerm) ||
                (p.instagram && p.instagram.toLowerCase().includes(searchTerm));
            const matchesStatus = !statusFilter || p.status === statusFilter;
            const matchesInterest = !interestFilter || p.interestLevel === interestFilter;

            // Channel Filter
            let matchesChannel = true;
            if (this.currentChannel === 'instagram') {
                matchesChannel = p.instagram && p.instagram.length > 0;
            } else if (this.currentChannel === 'email') {
                matchesChannel = p.email && p.email.length > 0;
            }

            return matchesSearch && matchesStatus && matchesInterest && matchesChannel;
        });

        if (prospects.length === 0) {
            const msg = this.currentChannel === 'instagram'
                ? 'No prospects found with Instagram handles. Edit prospects to add their handles.'
                : 'No prospects match your filters';
            list.innerHTML = `<div style="padding: var(--space-16); text-align: center; color: var(--color-text-secondary);">${msg}</div>`;
            return;
        }

        prospects.forEach(p => {
            const item = document.createElement('div');
            item.className = `selection-item ${this.selectedProspects.has(p.id) ? 'selected' : ''}`;
            item.onclick = () => this.toggleProspectSelection(p.id);

            item.innerHTML = `
                <input type="checkbox" ${this.selectedProspects.has(p.id) ? 'checked' : ''} onclick="event.stopPropagation()">
                <div class="prospect-info-small">
                    <span class="name">${p.name}</span>
                    <span class="phone">${p.phone}</span>
                </div>
            `;
            list.appendChild(item);
        });
    }

    toggleProspectSelection(id) {
        if (this.selectedProspects.has(id)) {
            this.selectedProspects.delete(id);
        } else {
            this.selectedProspects.add(id);
        }
        this.renderProspectSelection();
        this.updateMessagingStats();
        this.updatePreview();
    }

    toggleAllProspects(select) {
        if (select) {
            this.data.prospects.forEach(p => this.selectedProspects.add(p.id));
        } else {
            this.selectedProspects.clear();
        }
        this.renderProspectSelection();
        this.updateMessagingStats();
        this.updatePreview();
    }

    updateMessagingStats() {
        const count = this.selectedProspects.size;
        const statsEl = document.getElementById('selection-stats');
        const bulkCountEl = document.getElementById('bulk-send-count');
        if (statsEl) statsEl.textContent = `${count} selected`;
        if (bulkCountEl) bulkCountEl.textContent = count;
    }

    updatePreview() {
        const preview = document.getElementById('message-preview-content');
        if (!preview) return;

        if (this.selectedProspects.size === 0) {
            preview.innerHTML = '<p class="text-muted">Select a prospect to see preview</p>';
            return;
        }

        // Preview for the first selected prospect
        const firstId = Array.from(this.selectedProspects)[0];
        const prospect = this.data.prospects.find(p => p.id === firstId);
        const template = this.data.whatsappTemplates.find(t => t.id === this.selectedTemplateId);

        if (prospect && template) {
            const message = this.formatMessage(template.content, prospect);
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            preview.innerHTML = `<p data-time="${timeString}">${message}</p>`;
        }
    }

    formatMessage(content, prospect) {
        let msg = content;
        const variables = {
            name: prospect.name,
            phone: prospect.phone,
            email: prospect.email || '',
            location: prospect.location || '',
            occupation: prospect.occupation || '',
            instagram: prospect.instagram || '',
            age: prospect.age || ''
        };

        Object.keys(variables).forEach(key => {
            const regex = new RegExp('{{' + key + '}}', 'g');
            msg = msg.replace(regex, variables[key]);
        });

        return msg;
    }

    async handleBulkSend() {
        if (this.selectedProspects.size === 0) {
            this.showError('Please select at least one prospect');
            return;
        }

        if (this.currentChannel === 'instagram') {
            await this.handleBulkSendInstagram();
            return;
        }

        if (this.currentChannel === 'email') {
            await this.handleBulkSendEmail();
            return;
        }

        const template = this.data.whatsappTemplates.find(t => t.id === this.selectedTemplateId);
        const prospectsToSend = Array.from(this.selectedProspects).map(id =>
            this.data.prospects.find(p => p.id === id)
        );

        if (!confirm(`This will open WhatsApp Web ${prospectsToSend.length} times. Continue?`)) return;

        for (const p of prospectsToSend) {
            const message = this.formatMessage(template.content, p);
            const cleanPhone = p.phone.replace(/\s+/g, '').replace(/\+/g, '');

            // Use URL API to properly handle emoji encoding
            // Direct API link prevents intermediate redirects that might corrupt emojis
            const url = new URL('https://api.whatsapp.com/send');
            url.searchParams.set('phone', cleanPhone);
            url.searchParams.set('text', message);

            const finalUrl = url.toString();

            // Open in new tab
            window.open(finalUrl, '_blank');

            // Log activity
            await this.logActivity('WhatsApp Message Sent', `Sent to ${p.name}`);

            // Small delay to prevent browser block
            await new Promise(r => setTimeout(r, 800));
        }
    }

    async handleBulkSendInstagram() {
        const template = this.data.whatsappTemplates.find(t => t.id === this.selectedTemplateId);
        const prospectsToSend = Array.from(this.selectedProspects).map(id =>
            this.data.prospects.find(p => p.id === id)
        );

        if (!confirm(`This will send ${prospectsToSend.length} messages via Instagram.\n\nNOTE: The message will be copied to your clipboard. When Instagram opens, just PASTE and Send.`)) return;

        for (const p of prospectsToSend) {
            if (!p.instagram) continue;

            const message = this.formatMessage(template.content, p);

            try {
                // Copy to clipboard
                await navigator.clipboard.writeText(message);

                // Open Instagram DM
                const handle = p.instagram.replace('@', '').trim();
                const url = `https://instagram.com/${handle}`;
                window.open(url, '_blank');

                await this.logActivity('Instagram Message Sent', `Sent to ${p.name} (${handle})`);

                // Show toast for clarity
                this.showSuccess(`Message copied! Opening chat for ${p.name}...`);
            } catch (err) {
                console.error('Error in IG send:', err);
                this.showError('Clipboard failed. Please copy manually.');
            }

            // Longer delay for manual action
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    async handleBulkSendEmail() {
        const template = this.data.whatsappTemplates.find(t => t.id === this.selectedTemplateId);
        const prospectsToSend = Array.from(this.selectedProspects).map(id =>
            this.data.prospects.find(p => p.id === id)
        );

        if (!confirm(`This will open your native mail app for ${prospectsToSend.length} messages. Continue?`)) return;

        for (const p of prospectsToSend) {
            if (!p.email) continue;

            const message = this.formatMessage(template.content, p);
            const subject = encodeURIComponent('Follow-up from NextGen Udaan');
            const body = encodeURIComponent(message);
            const url = `mailto:${p.email}?subject=${subject}&body=${body}`;

            window.open(url, '_self');

            await this.logActivity('Email Sent', `Sent to ${p.name} (${p.email})`);

            // Wait a bit longer between mailto calls to avoid flooding
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    async logActivity(action, details) {
        try {
            await this.db.collection('activities').add({
                userId: this.currentUser.id,
                action: action,
                details: details,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error logging activity:', err);
        }
    }
}

// Global initialization with multiple fallbacks
function initializeApp() {
    window.app = new NextGenUdaanApp();
}

// Multiple initialization strategies
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    setTimeout(initializeApp, 50);
}

// Fallback initialization
window.addEventListener('load', () => {
    if (!window.app) {
        initializeApp();
    }
});

// Additional fallback
setTimeout(() => {
    if (!window.app) {
        initializeApp();
    }
}, 1000);