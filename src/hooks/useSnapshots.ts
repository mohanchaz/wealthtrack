import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { loadSnapshots, upsertSnapshot, deleteSnapshot, deriveSnapshot } from '../services/snapshotService'

export function useSnapshots() {
  const ownUserId       = useAuthStore(s => s.user?.id)
  const activeProfileId  = useAuthStore(s => s.activeProfileId)
  const isReadOnly       = !!activeProfileId
  const userId           = activeProfileId ?? ownUserId
  const qc     = useQueryClient()
  const key    = ['snapshots', userId]

  const query = useQuery({
    queryKey: key,
    queryFn:  async () => {
      const raw = await loadSnapshots(userId!)
      return raw.map(deriveSnapshot)
    },
    enabled: !!userId,
  })

  const saveMutation = useMutation({
    mutationFn: (snap: Parameters<typeof upsertSnapshot>[1]) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return (
        upsertSnapshot(ownUserId!, snap)
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return deleteSnapshot(id)
    },
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  return { ...query, saveMutation, deleteMutation }
}
