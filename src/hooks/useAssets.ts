import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { loadAssets, upsertAsset, deleteAssets } from '../services/assetService'
import { useAuthStore } from '../store/authStore'

export function useAssets<T>(table: string) {
  const userId = useAuthStore(s => s.user?.id)
  const qc = useQueryClient()
  const key = ['assets', table, userId]

  const query = useQuery<T[]>({
    queryKey: key,
    queryFn:  () => loadAssets<T>(table, userId!),
    enabled:  !!userId,
  })

  const upsertMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => upsertAsset(table, userId!, row),
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteAssets(table, ids),
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  return { ...query, upsertMutation, deleteMutation }
}
