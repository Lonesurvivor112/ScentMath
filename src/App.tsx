import { useEffect, type ReactNode } from 'react'
import { Build } from './screens/Build'
import { Ideas } from './screens/Ideas'
import { Saved } from './screens/Saved'
import { Shelf } from './screens/Shelf'
import { useBlends } from './store/blends'
import { useBuilder } from './store/builder'
import { useNav, type TabId } from './store/nav'
import { useOils } from './store/oils'
import { useProfile } from './store/profile'
import { useShelf } from './store/shelf'

interface Tab {
  id: TabId
  label: string
  icon: ReactNode
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const TABS: Tab[] = [
  {
    id: 'shelf',
    label: 'Shelf',
    icon: (
      <svg {...iconProps}>
        <path d="M3 20h18M3 12h18M6 12V8h3v4M11 12V6h3v6M16 12V9h3v3M7 20v-4h3v4M14 20v-5h3v5" />
      </svg>
    ),
  },
  {
    id: 'build',
    label: 'Build',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3s-6 7.2-6 11.5a6 6 0 0 0 12 0C18 10.2 12 3 12 3Z" />
        <path d="M9.5 14.5h5M12 12v5" />
      </svg>
    ),
  },
  {
    id: 'ideas',
    label: 'Ideas',
    icon: (
      <svg {...iconProps}>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
      </svg>
    ),
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: (
      <svg {...iconProps}>
        <path d="M6 4h12v17l-6-4-6 4V4Z" />
      </svg>
    ),
  },
]

const SCREENS: Record<TabId, () => ReactNode> = {
  shelf: () => <Shelf />,
  build: () => <Build />,
  ideas: () => <Ideas />,
  saved: () => <Saved />,
}

export default function App() {
  const active = useNav((state) => state.tab)
  const go = useNav((state) => state.go)

  // Everything saved on the device is read once, whichever tab opens first.
  useEffect(() => {
    void useProfile.getState().load()
    void useOils.getState().load()
    void useShelf.getState().load()
    void useBlends.getState().load()
    void useBuilder.getState().load()
  }, [])

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-paper">
      <main key={active} className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        {SCREENS[active]()}
      </main>

      <nav
        aria-label="Main"
        className="border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-4">
          {TABS.map((t) => {
            const selected = t.id === active
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => go(t.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    selected ? 'text-brand-700' : 'text-stone-500'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
