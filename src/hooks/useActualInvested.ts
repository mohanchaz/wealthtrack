import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { loadActualInvested, saveActualInvested, deleteActualInvested } from '../services/actualInvestedService'
import { useAuthStore } from '../store/authStore'

export function useActualInvested(table: string | null) {
  const userId = useAuthStore(s => s.user?.id)
  const qc = useQueryClient()
  const key = ['actual-invested', table, userId]

  const query = useQuery({
    queryKey: key,
    queryFn:  () => loadActualInvested(table!, userId!),
    enabled:  !!userId && !!table,
  })

  const saveMutation = useMutation({
    mutationFn: (row: { id?: string; entry_date: string; amount: number; notes?: string }) =>
      saveActualInvested(table!, userId!, row),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteActualInvested(table!, ids),
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  return { ...query, saveMutation, deleteMutation }
}
