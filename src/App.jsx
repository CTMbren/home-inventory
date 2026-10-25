import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useInventory } from './useInventory'
import Auth from './components/Auth'
import HouseholdSetup from './components/HouseholdSetup'
import Inventory from './components/Inventory'
import ScanFlow from './components/ScanFlow'
import Rooms from './components/Rooms'
import Settings from './components/Settings'

const TABS = [
  { id: 'inventory', label: 'Home', icon: 'M3 11 12 4l9 7v9h-6v-6H9v6H3z' },
  { id: 'scan', label: 'Scan', icon: 'M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M16 8v8' },
  { id: 'rooms', label: 'Rooms', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { id: 'settings', label: 'Settings', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M4 12h2M18 12h2M12 4v2M12 18v2' },
]

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [household, setHousehold] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadHousehold = useCallback(async () => {
    if (!session) return setHousehold(undefined)
    const { data } = await supabase
      .from('household_members')
      .select('household_id, households(id, name, invite_code)')
      .eq('user_id', session.user.id)
      .order('joined_at')
      .limit(1)
      .maybeSingle()
    setHousehold(data?.households ?? null)
  }, [session])

  useEffect(() => {
    loadHousehold()
  }, [loadHousehold])

  if (session === undefined || (session && household === undefined)) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    )
  }
  if (!session) return <Auth />
  if (!household) return <HouseholdSetup onReady={loadHousehold} />
  return <Main session={session} household={household} onHouseholdChanged={loadHousehold} />
}

function Main({ session, household, onHouseholdChanged }) {
  const [tab, setTab] = useState('inventory')
  const [toast, setToast] = useState(null)
  const inv = useInventory(household.id)

  const toastTimer = useRef(null)
  const showToast = useCallback((text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <h1>{tab === 'inventory' ? household.name : TABS.find((t) => t.id === tab).label}</h1>
      </header>

      <main className="content">
        {inv.error && <p className="error">{inv.error}</p>}
        {inv.loading ? (
          <div className="center">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {tab === 'inventory' && <Inventory inv={inv} onToast={showToast} />}
            {tab === 'scan' && <ScanFlow householdId={household.id} inv={inv} onToast={showToast} />}
            {tab === 'rooms' && <Rooms householdId={household.id} inv={inv} onToast={showToast} />}
            {tab === 'settings' && <Settings session={session} household={household} onRenamed={onHouseholdChanged} />}
          </>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
