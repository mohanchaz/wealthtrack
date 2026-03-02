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