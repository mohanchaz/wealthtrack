import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { fetchAssets, upsertAsset, deleteAsset, type TableName } from '../services/assetService'

export function useAssets<T = Record<string, unknown>>(table: TableName) {
  const userId = useAuthStore(s => s.user?.id)
  const qc     = useQueryClient()
  const qKey   = [table, userId]

  const query = useQuery({
    queryKey: qKey,
    queryFn:  () => fetchAssets<T>(table, userId!),
    enabled:  !!userId,
  })

  const upsertMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => upsertAsset(table, { ...row, user_id: userId }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: qKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAsset(table, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: qKey }),
  })

  return { ...query, upsertMutation, deleteMutation }
}
