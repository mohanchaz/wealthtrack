// --- 1. Initialize Supabase ---
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. DOM Elements ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const userNameDisplay = document.getElementById('user-name');
const allocationsContainer = document.getElementById('allocations-container');

// --- 3. Authentication Logic ---
loginBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) console.error("Error logging in:", error.message);
});

logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
});

// Listen for Login/Logout events
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        // Show Dashboard
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        
        // Set Username
        userNameDisplay.textContent = session.user.user_metadata.full_name;

        // Fetch user data
        loadAllocations(session.user);
        
    } else {
        // Show Login Screen
        dashboardView.classList.add('hidden');
        authView.classList.remove('hidden');
        userNameDisplay.textContent = '';
    }
});

// --- 4. Allocation Logic ---

// Fetch Allocations from Database
async function loadAllocations(user) {
    const { data, error } = await supabaseClient
        .from('ideal_allocations')
        .select('*')
        .order('percentage', { ascending: false });

    if (error) {
        console.error("Error fetching allocations:", error);
        allocationsContainer.innerHTML = `<p style="padding: 20px; color: red;">Failed to load allocations. Check console.</p>`;
        return;
    }

    // Auto-seed data if table is completely empty for this user
    if (data.length === 0) {
        await seedDefaultAllocations(user.id);
        return; 
    }

    renderAllocations(data);
}

// Render data to the screen
function renderAllocations(allocations) {
    allocationsContainer.innerHTML = ''; // Clear the "Loading" text

    allocations.forEach(alloc => {
        // Convert decimal (e.g. 0.275) to percentage string (27.5%)
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

// Seed Database (Runs only once if the user has no allocations saved)
async function seedDefaultAllocations(userId) {
    allocationsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--primary-color);">Setting up your default portfolio targets...</div>`;
    
    // Data pulled directly from your provided CSV
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
        allocationsContainer.innerHTML = `<p style="padding: 20px; color: red;">Failed to set up defaults.</p>`;
    } else {
        // Data is seeded, fetch and render it!
        loadAllocations({ id: userId });
    }
}