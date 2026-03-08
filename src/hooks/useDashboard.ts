import { useQuery } from '@tanstack/react-query'
import { loadDashboardStats } from '../services/dashboardService'
import { useAuthStore } from '../store/authStore'

export function useDashboard() {
  const userId = useAuthStore(s => s.user?.id)
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn:  () => loadDashboardStats(userId!),
    enabled:  !!userId,
  })
}
