import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  loadAllocations,
  saveAllocations,
  seedDefaultAllocations,
} from '../services/allocationService'

export function useAllocations() {
  const ownUserId      = useAuthStore(s => s.user?.id)
  const activeProfileId = useAuthStore(s => s.activeProfileId)
  const isReadOnly      = !!activeProfileId
  const userId          = activeProfileId ?? ownUserId
  const qc     = useQueryClient()

  const query = useQuery({
    queryKey: ['allocations', userId],
    queryFn:  () => loadAllocations(userId!),
    enabled:  !!userId,
  })

  const seedMutation = useMutation({
    mutationFn: () => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return seedDefaultAllocations(ownUserId!)
    },
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['allocations', userId] }),
  })

  const saveMutation = useMutation({
    mutationFn: (items: { name: string; pct: number }[]) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return saveAllocations(ownUserId!, items)
    },
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['allocations', userId] }),
  })

  return { ...query, seedMutation, saveMutation }
}
