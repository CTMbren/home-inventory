import { useState } from 'react'
import { supabase } from '../supabase'

const STARTER_ROOMS = {
  Kitchen: ['Pantry', 'Fridge', 'Freezer', 'Spice drawer'],
  'Main bathroom': ['Under sink', 'Medicine cabinet', 'Shower'],
  Laundry: ['Shelf'],
  Garage: ['Overflow shelf'],
}

export default function HouseholdSetup({ onReady }) {
  const [name, setName] = useState('Our home')
  const [code, setCode] = useState('')
  const [seed, setSeed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data: householdId, error } = await supabase.rpc('create_household', { p_name: name.trim() || 'Our home' })
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    if (seed) await seedRooms(householdId)
    setBusy(false)
    onReady(householdId)
  }

  async function join(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data: householdId, error } = await supabase.rpc('join_household', { p_code: code.trim() })
    setBusy(false)
    if (error) return setError(error.message)
    onReady(householdId)
  }

  return (
    <div className="center-screen">
      <div className="brand">
        <h1>Set up your home</h1>
        <p className="muted">One household is shared by everyone who joins it.</p>
      </div>

      <form className="card stack" onSubmit={create}>
        <h2>Start a new household</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} />
          Add starter rooms (Kitchen, Main bathroom, Laundry, Garage)
        </label>
        <button className="primary" disabled={busy}>Create household</button>
      </form>

      <form className="card stack" onSubmit={join}>
        <h2>Join with an invite code</h2>
        <p className="muted small">Find the code in Settings on the phone that created the household.</p>
        <input
          placeholder="e.g. 3f9a1c07be"
          autoCapitalize="none"
          autoCorrect="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button disabled={busy}>Join household</button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  )
}

async function seedRooms(householdId) {
  let order = 0
  for (const [roomName, spots] of Object.entries(STARTER_ROOMS)) {
    const { data: room } = await supabase
      .from('rooms')
      .insert({ household_id: householdId, name: roomName, sort_order: order++ })
      .select('id')
      .single()
    if (!room) continue
    await supabase.from('locations').insert(
      spots.map((spot, i) => ({ household_id: householdId, room_id: room.id, name: spot, sort_order: i })),
    )
  }
}
