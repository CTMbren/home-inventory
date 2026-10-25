const KEY = 'inventory:lastLocation'

export function rememberLocation(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable: fine */
  }
}

export function lastLocation(locations) {
  try {
    const id = localStorage.getItem(KEY)
    if (id && locations.some((l) => l.id === id)) return id
  } catch {
    /* ignore */
  }
  return locations[0]?.id ?? ''
}

/** A <select> of every location, grouped by room. */
export default function LocationPicker({ rooms, locations, value, onChange, label = 'Where does it go?' }) {
  if (locations.length === 0) {
    return <p className="notice">Add a room and a location in the Rooms tab first.</p>
  }
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {rooms.map((room) => {
          const spots = locations.filter((l) => l.room_id === room.id)
          if (spots.length === 0) return null
          return (
            <optgroup key={room.id} label={room.name}>
              {spots.map((l) => (
                <option key={l.id} value={l.id}>
                  {room.name} · {l.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
