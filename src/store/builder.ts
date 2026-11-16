import { create } from 'zustand'
import { newDraft, type Draft } from '../engine/builder'
import { db } from './db'
import { useProfile } from './profile'

const DRAFT_KEY = 'builderDraft'

interface BuilderState {
  draft: Draft
  loaded: boolean
  /** Restores the blend that was being built when the app was last closed. */
  load: () => Promise<void>
  /** Replaces the draft with a changed copy (see engine/builder.ts). */
  change: (next: Draft | ((draft: Draft) => Draft)) => void
  /** Starts an empty blend, keeping the current method. */
  startOver: () => void
}

let loading: Promise<void> | null = null

const looksLikeDraft = (value: unknown): value is Draft =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as Draft).items) &&
  typeof (value as Draft).method === 'string' &&
  typeof (value as Draft).volumeMl === 'number'

/** The blend being built. Shared so Ideas and Saved can open one in Build. */
export const useBuilder = create<BuilderState>((set, get) => ({
  draft: newDraft(useProfile.getState().profile),
  loaded: false,

  load: () => {
    if (!loading) {
      loading = Promise.all([useProfile.getState().load(), db.meta.get(DRAFT_KEY)])
        .then(([, row]) => {
          set({
            draft: looksLikeDraft(row?.value)
              ? row.value
              : newDraft(useProfile.getState().profile),
            loaded: true,
          })
        })
        .catch(() => {
          loading = null
          set({ loaded: true })
        })
    }
    return loading
  },

  change: (next) => {
    const draft = typeof next === 'function' ? next(get().draft) : next
    if (draft === get().draft) return
    set({ draft })
    void db.meta.put({ key: DRAFT_KEY, value: draft }).catch(() => undefined)
  },

  startOver: () => {
    get().change(newDraft(useProfile.getState().profile, get().draft.method))
  },
}))
