import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  loadGoals, createGoal, updateGoal, deleteGoal,
  type GoalInput,
} from '../services/goalService'

export function useGoals() {
  const userId = useAuthStore(s => s.user?.id)
  const qc     = useQueryClient()
  const key    = ['goals', userId]

  const query = useQuery({
    queryKey: key,
    queryFn:  () => loadGoals(userId!),
    enabled:  !!userId,
  })

  const createMutation = useMutation({
    mutationFn: (input: GoalInput) => createGoal(userId!, input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<GoalInput> }) =>
      updateGoal(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  return { ...query, createMutation, updateMutation, deleteMutation }
}
