import { create } from 'zustand'
import { DEFAULT_PROFILE, ProfileSchema, type Profile } from '../data/schema'
import { db } from './db'

const PROFILE_KEY = 'profile'

interface ProfileState {
  profile: Profile
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Profile>) => Promise<void>
}

let loading: Promise<void> | null = null

/** Drops keys whose value is undefined, so an optional field can be cleared. */
function clean(profile: Profile): Profile {
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined),
  ) as Profile
}

/** The household and the defaults for the calculator, saved on the device. */
export const useProfile = create<ProfileState>((set, get) => ({
  profile: DEFAULT_PROFILE,
  loaded: false,

  load: () => {
    if (!loading) {
      loading = db.meta
        .get(PROFILE_KEY)
        .then((row) => {
          const parsed = ProfileSchema.safeParse(row?.value)
          set({ profile: parsed.success ? parsed.data : DEFAULT_PROFILE, loaded: true })
        })
        .catch(() => {
          loading = null
          set({ loaded: true })
        })
    }
    return loading
  },

  update: async (patch) => {
    const next = clean({ ...get().profile, ...patch })
    if (!ProfileSchema.safeParse(next).success) return
    set({ profile: next })
    await db.meta.put({ key: PROFILE_KEY, value: next })
  },
}))
