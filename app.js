// Initialize Supabase Client
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loggedOutView = document.getElementById('logged-out-view');
const loggedInView = document.getElementById('logged-in-view');
const userNameDisplay = document.getElementById('user-name');

// 1. Handle Google Login
loginBtn.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) console.error("Error logging in:", error.message);
});

// 2. Handle Logout
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
});

// 3. Listen for Authentication State Changes
supabase.auth.onAuthStateChange((event, session) => {
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