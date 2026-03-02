// Fetch Allocations from Database
async function loadAllocations(user) {
    console.log("1. loadAllocations started for user:", user.id);

    const { data, error } = await supabaseClient
        .from('ideal_allocations')
        .select('*')
        .order('percentage', { ascending: false });

    console.log("2. Supabase SELECT finished. Data:", data, "Error:", error);

    if (error) {
        allocationsContainer.innerHTML = `<p style="padding: 20px; color: red;">Failed to load. Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        console.log("3. No data found. Starting seed process...");
        await seedDefaultAllocations(user.id);
        return; 
    }

    console.log("4. Data found! Rendering allocations...");
    renderAllocations(data);
}

// Seed Database
async function seedDefaultAllocations(userId) {
    console.log("5. seedDefaultAllocations started");
    allocationsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--primary-color);">Setting up defaults...</div>`;
    
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

    const { data, error } = await supabaseClient
        .from('ideal_allocations')
        .insert(defaultData)
        .select(); // Added .select() to ensure it returns the inserted rows

    console.log("6. Supabase INSERT finished. Data:", data, "Error:", error);

    if (error) {
        allocationsContainer.innerHTML = `<p style="padding: 20px; color: red;">Failed to set up defaults: ${error.message}</p>`;
    } else {
        console.log("7. Seed successful. Reloading allocations...");
        loadAllocations({ id: userId });
    }
}