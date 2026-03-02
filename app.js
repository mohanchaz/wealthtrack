// Initialize Supabase Client
const SUPABASE_URL = 'https://kgcuogyrxcbdlozgnfav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnY3VvZ3lyeGNiZGxvemduZmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzY0MDMsImV4cCI6MjA4ODAxMjQwM30.kEI2A8o3rxRJAgncH9gzxeFhB6PYyvLQ8IwKOTuAQ3U';
// =============================


const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// =============================
// DOM Elements
// =============================
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const userNameDisplay = document.getElementById('user-name');
const allocationsContainer = document.getElementById('allocations-container');

// =============================
// Google Login
// =============================
loginBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
});

// =============================
// Logout
// =============================
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// =============================
// Auth State Listener
// =============================
supabaseClient.auth.onAuthStateChange(async (event, session) => {

    if (session) {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');

        const userName = session.user.user_metadata.full_name || "User";
        userNameDisplay.textContent = userName;

        await loadAllocations(session.user);

    } else {
        dashboardView.classList.add('hidden');
        authView.classList.remove('hidden');
        userNameDisplay.textContent = '';
    }
});

// =============================
// Load Allocations
// =============================
async function loadAllocations(user) {

    allocationsContainer.innerHTML =
        `<div style="text-align:center;padding:20px;">Loading allocations...</div>`;

    const { data, error } = await supabaseClient
        .from('ideal_allocations')
        .select('*')
        .eq('user_id', user.id)
        .order('percentage', { ascending: false });

    if (error) {
        console.error(error);
        allocationsContainer.innerHTML =
            `<div style="color:red;padding:20px;">Failed to load data</div>`;
        return;
    }

    if (!data || data.length === 0) {
        await seedDefaultAllocations(user.id);
        return;
    }

    renderAllocations(data);
}

// =============================
// Render Allocations
// =============================
function renderAllocations(allocations) {

    allocationsContainer.innerHTML = '';

    allocations.forEach(alloc => {

        const percentageDisplay =
            (Number(alloc.percentage) * 100).toFixed(1) + '%';

        const itemHtml = `
            <div class="allocation-item">
                <div class="allocation-header">
                    <div class="allocation-info">
                        <span class="allocation-name">${alloc.item}</span>
                        <span class="allocation-type">${alloc.type} • ${alloc.category}</span>
                    </div>
                    <span class="allocation-value">${percentageDisplay}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${percentageDisplay};"></div>
                </div>
            </div>
        `;

        allocationsContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

// =============================
// Seed Default Data
// =============================
async function seedDefaultAllocations(userId) {

    allocationsContainer.innerHTML =
        `<div style="text-align:center;padding:20px;">Setting up your portfolio...</div>`;

    const defaultData = [
        { user_id: userId, item: 'Cash', type: 'Asset', category: 'Cash', percentage: 0.040 },
        { user_id: userId, item: 'FD', type: 'Asset', category: 'FD', percentage: 0.060 },
        { user_id: userId, item: 'India Equity Stocks', type: 'Asset', category: 'India Equity Stocks', percentage: 0.275 },
        { user_id: userId, item: 'India Equity MF', type: 'Asset', category: 'India Equity MF', percentage: 0.360 },
        { user_id: userId, item: 'Foreign Equity/ETF', type: 'Asset', category: 'Foreign Equity/ETF', percentage: 0.100 },
        { user_id: userId, item: 'Gold', type: 'Asset', category: 'Gold', percentage: 0.100 },
        { user_id: userId, item: 'Bonds', type: 'Asset', category: 'Bonds', percentage: 0.060 },
        { user_id: userId, item: 'Crypto', type: 'Asset', category: 'Crypto', percentage: 0.005 }
    ];

    const { error } = await supabaseClient
        .from('ideal_allocations')
        .insert(defaultData);

    if (error) {
        console.error("Seed error:", error);
        allocationsContainer.innerHTML =
            `<div style="color:red;padding:20px;">Failed to seed data</div>`;
        return;
    }

    await loadAllocations({ id: userId });
}