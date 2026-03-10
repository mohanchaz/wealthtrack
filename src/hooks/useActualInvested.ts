import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  fetchActualInvested,
  addActualEntry,
  updateActualEntry,
  deleteActualEntry,
  type ActualTable,
} from '../services/actualInvestedService'

export function useActualInvested(table: ActualTable) {
  const userId = useAuthStore(s => s.user?.id)
  const qc     = useQueryClient()
  const qKey   = [table, userId]

  const query = useQuery({
    queryKey: qKey,
    queryFn:  () => fetchActualInvested(table, userId!),
    enabled:  !!userId,
  })

  const addMutation = useMutation({
    mutationFn: ({ amount, entryDate }: { amount: number; entryDate?: string }) =>
      addActualEntry(table, userId!, amount, entryDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, amount, entryDate }: { id: string; amount: number; entryDate?: string }) =>
      updateActualEntry(table, id, amount, entryDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteActualEntry(table, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: qKey }),
  })

  return { ...query, addMutation, updateMutation, deleteMutation }
}
