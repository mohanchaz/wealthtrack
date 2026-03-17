import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { fetchAssets, upsertAsset, deleteAsset, type TableName } from '../services/assetService'

export function useAssets<T = Record<string, unknown>>(table: TableName) {
  const ownUserId      = useAuthStore(s => s.user?.id)
  const activeProfileId = useAuthStore(s => s.activeProfileId)
  const isReadOnly     = !!activeProfileId
  const userId         = activeProfileId ?? ownUserId
  const qc             = useQueryClient()
  const qKey           = [table, userId]

  const query = useQuery({
    queryKey: qKey,
    queryFn:  () => fetchAssets<T>(table, userId!),
    enabled:  !!userId,
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qKey })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const upsertMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return upsertAsset(table, { ...row, user_id: ownUserId })
    },
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return deleteAsset(table, id)
    },
    onSuccess: invalidateAll,
  })

  return { ...query, upsertMutation, deleteMutation, isReadOnly }
}
