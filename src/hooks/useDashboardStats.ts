import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { loadDashboardStats } from '../services/dashboardService'

export function useDashboardStats() {
  const userId = useAuthStore(s => s.user?.id)

  return useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn:  () => loadDashboardStats(userId!),
    enabled:  !!userId,
    staleTime: 2 * 60 * 1000,
  })
}
