// Initialize Supabase Client
const SUPABASE_URL = 'https://kgcuogyrxcbdlozgnfav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnY3VvZ3lyeGNiZGxvemduZmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzY0MDMsImV4cCI6MjA4ODAxMjQwM30.kEI2A8o3rxRJAgncH9gzxeFhB6PYyvLQ8IwKOTuAQ3U';


const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authView = document.getElementById('auth-view');         // Updated ID
const dashboardView = document.getElementById('dashboard-view'); // Updated ID
const userNameDisplay = document.getElementById('user-name');

// 1. Handle Google Login
loginBtn.addEventListener('click', async () => {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) console.error("Error logging in:", error.message);
});

// 2. Handle Logout
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
});

// 3. Listen for Authentication State Changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        // User is logged in: Hide Auth, Show Dashboard
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        
        // Extract the user's name
        const userName = session.user.user_metadata.full_name;
        userNameDisplay.textContent = userName;
    } else {
        // User is logged out: Hide Dashboard, Show Auth
        dashboardView.classList.add('hidden');
        authView.classList.remove('hidden');
        userNameDisplay.textContent = '';
    }
});
// --- NEW: Allocation Logic ---

const allocationsContainer = document.getElementById('allocations-container');

// 1. Fetch Allocations from Supabase
async function loadAllocations(user) {
    const { data, error } = await supabaseClient
        .from('ideal_allocations')
        .select('*')
        .order('percentage', { ascending: false }); // Show highest % first

    if (error) {
        console.error("Error fetching allocations:", error);
        allocationsContainer.innerHTML = `<p style="padding: 20px; color: red;">Failed to load allocations.</p>`;
        return;
    }

    // 2. Auto-seed data if the table is empty
    if (data.length === 0) {
        await seedDefaultAllocations(user.id);
        return; // Seed function will recall loadAllocations when done
    }

    renderAllocations(data);
}

// 3. Render the data to the screen
function renderAllocations(allocations) {
    allocationsContainer.innerHTML = ''; // Clear loading text

    allocations.forEach(alloc => {
        // Convert 0.275 to 27.5%
        const percentageDisplay = (alloc.percentage * 100).toFixed(1) + '%';
        
        const itemHtml = `
            <div class="allocation-item">
                <div class="allocation-header">
                    <div class="allocation-info">
                        <span class="allocation-name">${alloc.item}</span>
                        <span class="allocation-type">${alloc.type} &bull; ${alloc.category}</span>
                    </div>
                    <span class="allocation-value">${percentageDisplay}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${percentageDisplay};"></div>
                </div>
            </div>
        `;
        allocationsContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

// 4. Seed the database with your CSV data
async function seedDefaultAllocations(userId) {
    allocationsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--primary-color);">Setting up your default allocations...</div>`;
    
    // This is the exact data from your CSV file
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
        console.error("Error seeding data:", error);
    } else {
        // Reload now that data is in the database
        loadAllocations({ id: userId });
    }
}