export default function DashboardPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4">
          <span className="text-3xl font-bold text-white">F</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">FinTrack</h1>
        <p className="text-green-400 font-medium mb-1">✅ Setup complete! You're logged in.</p>
        <p className="text-gray-400 text-sm">Dashboard UI coming in Module 2</p>
      </div>
    </div>
  );
}
