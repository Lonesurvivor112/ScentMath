import { useState } from 'react'
import { OilSearchList } from '../components/OilSearchList'
import { Sheet } from '../components/Sheet'
import { PencilIcon, ScanIcon, SearchIcon } from '../components/icons'
import type { ResolvedOil } from '../engine/resolve'
import { DEFAULT_SIZE_ML } from '../engine/shelf'
import { useOilIndex } from '../store/oils'
import { useShelf } from '../store/shelf'
import { AddOilCreate } from './AddOilCreate'
import { AddOilScan } from './AddOilScan'

type Tab = 'search' | 'scan' | 'create'

interface AddOilProps {
  onClose: () => void
  initialTab?: Tab
}

const TABS: { id: Tab; label: string; icon: typeof SearchIcon }[] = [
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'scan', label: 'Scan', icon: ScanIcon },
  { id: 'create', label: 'Your own', icon: PencilIcon },
]

/** The "Add oil" screen: search the library, scan a barcode, or make your own. */
export function AddOil({ onClose, initialTab = 'search' }: AddOilProps) {
  const oils = useOilIndex()
  const shelf = useShelf((state) => state.items)
  const addBottle = useShelf((state) => state.addBottle)

  const [tab, setTab] = useState<Tab>(initialTab)
  /** How many bottles of each oil were added from search, shown on its button. */
  const [added, setAdded] = useState<ReadonlyMap<string, number>>(new Map())
  /** Carried into the "Your own" form from search or from a scan. */
  const [seed, setSeed] = useState<{ name?: string; barcode?: string }>({})
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const addFromSearch = async (oil: ResolvedOil) => {
    await addBottle({ oilId: oil.id, brand: oil.brand, sizeMl: DEFAULT_SIZE_ML })
    setAdded((current) => new Map(current).set(oil.id, (current.get(oil.id) ?? 0) + 1))
  }

  const openCreate = (next: { name?: string; barcode?: string }) => {
    setSeed(next)
    setFormKey((key) => key + 1)
    setNotice(null)
    setTab('create')
  }

  const total = [...added.values()].reduce((sum, n) => sum + n, 0)

  return (
    <Sheet title="Add oil" onClose={onClose} full>
      <div role="tablist" aria-label="Ways to add an oil" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
        {TABS.map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${
              tab === id ? 'bg-white text-brand-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            <TabIcon size={18} />
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
          {notice}
        </p>
      )}

      {tab === 'search' && (
        <div role="tabpanel" aria-label="Search">
          <OilSearchList
            index={oils}
            shelf={shelf}
            actionLabel="Add"
            onAction={(oil) => void addFromSearch(oil)}
            doneCounts={added}
            showPopular
            onCreate={(name) => openCreate({ name })}
          />
          {total > 0 && (
            <p role="status" aria-live="polite" className="sr-only">
              {total} {total === 1 ? 'bottle' : 'bottles'} added
            </p>
          )}
        </div>
      )}

      {tab === 'scan' && (
        <div role="tabpanel" aria-label="Scan">
          <AddOilScan onCreateForBarcode={(barcode) => openCreate({ barcode })} />
        </div>
      )}

      {tab === 'create' && (
        <div role="tabpanel" aria-label="Your own">
          <AddOilCreate
            key={formKey}
            initialName={seed.name}
            barcode={seed.barcode}
            onCreated={(name) => {
              setSeed({})
              setFormKey((key) => key + 1)
              setNotice(`${name} is on your shelf.`)
            }}
          />
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-paper via-paper to-transparent px-4 pt-6 pb-1">
        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-stone-900 text-base font-semibold text-white">
          Done
        </button>
      </div>
    </Sheet>
  )
}
