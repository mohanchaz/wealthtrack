import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  loadGoals, createGoal, updateGoal, deleteGoal,
  type GoalInput,
} from '../services/goalService'

export function useGoals() {
  const ownUserId       = useAuthStore(s => s.user?.id)
  const activeProfileId  = useAuthStore(s => s.activeProfileId)
  const isReadOnly       = !!activeProfileId
  const userId           = activeProfileId ?? ownUserId
  const qc     = useQueryClient()
  const key    = ['goals', userId]

  const query = useQuery({
    queryKey: key,
    queryFn:  () => loadGoals(userId!),
    enabled:  !!userId,
  })

  const createMutation = useMutation({
    mutationFn: (input: GoalInput) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return createGoal(ownUserId!, input)
    },
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<GoalInput> }) =>
      updateGoal(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (isReadOnly) return Promise.reject(new Error('Read-only mode'))
      return deleteGoal(id)
    },
    onSuccess:  () => qc.invalidateQueries({ queryKey: key }),
  })

  return { ...query, createMutation, updateMutation, deleteMutation }
}
