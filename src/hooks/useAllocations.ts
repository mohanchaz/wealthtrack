import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  loadAllocations,
  saveAllocations,
  seedDefaultAllocations,
} from '../services/allocationService'

export function useAllocations() {
  const userId = useAuthStore(s => s.user?.id)
  const qc     = useQueryClient()

  const query = useQuery({
    queryKey: ['allocations', userId],
    queryFn:  () => loadAllocations(userId!),
    enabled:  !!userId,
  })

  const seedMutation = useMutation({
    mutationFn: () => seedDefaultAllocations(userId!),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['allocations', userId] }),
  })

  const saveMutation = useMutation({
    mutationFn: (items: { name: string; pct: number }[]) =>
      saveAllocations(userId!, items),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['allocations', userId] }),
  })

  return { ...query, seedMutation, saveMutation }
}
