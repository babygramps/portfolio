import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Edit keys for the events this browser created (or opened via an edit link) */
interface EditKeysStore {
  editKeys: Record<string, string>

  setEditKey: (eventId: string, editKey: string) => void
}

const useEditKeysStore = create<EditKeysStore>()(persist(
  set => ({
    editKeys: {},

    setEditKey: (eventId, editKey) => set(state => ({
      editKeys: { ...state.editKeys, [eventId]: editKey },
    })),
  }),
  { name: 'schedule-edit-keys' },
))

export default useEditKeysStore
