// Initialize Supabase Client
const SUPABASE_URL = 'https://kgcuogyrxcbdlozgnfav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnY3VvZ3lyeGNiZGxvemduZmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzY0MDMsImV4cCI6MjA4ODAxMjQwM30.kEI2A8o3rxRJAgncH9gzxeFhB6PYyvLQ8IwKOTuAQ3U';

// FIXED: Renamed 'supabase' to 'supabaseClient' to avoid the naming collision
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loggedOutView = document.getElementById('logged-out-view');
const loggedInView = document.getElementById('logged-in-view');
const userNameDisplay = document.getElementById('user-name');

// 1. Handle Google Login
loginBtn.addEventListener('click', async () => {
    // FIXED: Use supabaseClient
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) console.error("Error logging in:", error.message);
});

// 2. Handle Logout
logoutBtn.addEventListener('click', async () => {
    // FIXED: Use supabaseClient
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
});

// 3. Listen for Authentication State Changes
// FIXED: Use supabaseClient
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        // User is logged in
        loggedOutView.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        
        // Extract the user's name from Google's metadata
        const userName = session.user.user_metadata.full_name;
        userNameDisplay.textContent = userName;
    } else {
        // User is logged out
        loggedInView.classList.add('hidden');
        loggedOutView.classList.remove('hidden');
        userNameDisplay.textContent = '';
    }
});