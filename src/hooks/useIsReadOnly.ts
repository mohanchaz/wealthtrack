import { useAuthStore } from '../store/authStore'

/**
 * Returns true when the user is viewing someone else's portfolio.
 * Use this to hide add/edit/delete controls.
 */
export function useIsReadOnly(): boolean {
  return !!useAuthStore(s => s.activeProfileId)
}
