import { useState } from 'react'
import { supabase } from '../supabase'

export default function Rooms({ householdId, inv, onToast }) {
  const [newRoom, setNewRoom] = useState('')
  const [error, setError] = useState(null)

  const countIn = (locationId) =>
    inv.items.filter((i) => i.location_id === locationId).reduce((n, i) => n + i.quantity, 0)

  async function run(promise) {
    setError(null)
    const { error } = await promise
    if (error) setError(error.message)
    return !error
  }

  async function addRoom(e) {
    e.preventDefault()
    const name = newRoom.trim()
    if (!name) return
    const ok = await run(
      supabase.from('rooms').insert({ household_id: householdId, name, sort_order: inv.rooms.length }),
    )
    if (ok) setNewRoom('')
  }

  async function renameRoom(room) {
    const name = prompt('Rename room', room.name)?.trim()
    if (name && name !== room.name) await run(supabase.from('rooms').update({ name }).eq('id', room.id))
  }

  async function deleteRoom(room) {
    const spots = inv.locations.filter((l) => l.room_id === room.id)
    const units = spots.reduce((n, l) => n + countIn(l.id), 0)
    const warn = units ? ` Its ${units} items will be removed too.` : ''
    if (!confirm(`Delete ${room.name}?${warn}`)) return
    if (await run(supabase.from('rooms').delete().eq('id', room.id))) onToast(`Deleted ${room.name}`)
  }

  async function addLocation(room, name) {
    const order = inv.locations.filter((l) => l.room_id === room.id).length
    return run(
      supabase.from('locations').insert({ household_id: householdId, room_id: room.id, name, sort_order: order }),
    )
  }

  async function renameLocation(loc) {
    const name = prompt('Rename location', loc.name)?.trim()
    if (name && name !== loc.name) await run(supabase.from('locations').update({ name }).eq('id', loc.id))
  }

  async function deleteLocation(loc) {
    const units = countIn(loc.id)
    const warn = units ? ` Its ${units} items will be removed too.` : ''
    if (!confirm(`Delete ${loc.name}?${warn}`)) return
    await run(supabase.from('locations').delete().eq('id', loc.id))
  }

  return (
    <section className="stack">
      {inv.rooms.map((room) => (
        <div key={room.id} className="card stack">
          <div className="row between">
            <h2>{room.name}</h2>
            <div className="row tight">
              <button className="ghost small" onClick={() => renameRoom(room)}>
                Rename
              </button>
              <button className="ghost small danger" onClick={() => deleteRoom(room)}>
                Delete
              </button>
            </div>
          </div>
          {inv.locations
            .filter((l) => l.room_id === room.id)
            .map((loc) => (
              <div key={loc.id} className="row between loc-row">
                <button className="link" onClick={() => renameLocation(loc)}>
                  {loc.name}
                </button>
                <span className="row tight">
                  <span className="muted small">{countIn(loc.id)} {countIn(loc.id) === 1 ? "item" : "items"}</span>
                  <button className="ghost icon small" aria-label={`Delete ${loc.name}`} onClick={() => deleteLocation(loc)}>
                    ✕
                  </button>
                </span>
              </div>
            ))}
          <AddLocation onAdd={(name) => addLocation(room, name)} />
        </div>
      ))}

      <form className="card row" onSubmit={addRoom}>
        <input placeholder="New room, e.g. Ensuite" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
        <button className="primary">Add room</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="muted small center">Tap a location's name to rename it.</p>
    </section>
  )
}

function AddLocation({ onAdd }) {
  const [name, setName] = useState('')
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault()
        if (name.trim() && (await onAdd(name.trim()))) setName('')
      }}
    >
      <input placeholder="Add a location, e.g. Top shelf" value={name} onChange={(e) => setName(e.target.value)} />
      <button>Add</button>
    </form>
  )
}
