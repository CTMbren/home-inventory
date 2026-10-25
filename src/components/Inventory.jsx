import { useMemo, useState } from 'react'
import { adjustStock } from '../useInventory'
import ProductThumb from './ProductThumb'
import ItemSheet from './ItemSheet'

export default function Inventory({ inv, onToast }) {
  const [query, setQuery] = useState('')
  const [roomFilter, setRoomFilter] = useState('all')
  const [openItem, setOpenItem] = useState(null)

  const { inStock, ranOut } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = inv.items
      .map((item) => ({ item, product: inv.productById[item.product_id], loc: inv.locationById[item.location_id] }))
      .filter(({ product, loc }) => product && loc)
      .filter(({ loc }) => roomFilter === 'all' || loc.room_id === roomFilter)
      .filter(({ product }) => {
        if (!q) return true
        return [product.name, product.brand, product.category, product.barcode]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name))
    return { inStock: rows.filter((r) => r.item.quantity > 0), ranOut: rows.filter((r) => r.item.quantity === 0) }
  }, [inv, query, roomFilter])

  // Group in-stock rows by room, then location, in the order rooms are sorted.
  const groups = useMemo(() => {
    const out = []
    for (const room of inv.rooms) {
      const locs = inv.locations
        .filter((l) => l.room_id === room.id)
        .map((loc) => ({ loc, rows: inStock.filter((r) => r.loc.id === loc.id) }))
        .filter((g) => g.rows.length > 0)
      if (locs.length) out.push({ room, locs })
    }
    return out
  }, [inv.rooms, inv.locations, inStock])

  async function bump(item, delta) {
    try {
      await adjustStock(item, delta)
    } catch (e) {
      onToast(e.message)
    }
  }

  const totalUnits = inStock.reduce((n, r) => n + r.item.quantity, 0)

  if (inv.items.length === 0) {
    return (
      <section className="card center stack">
        <h2>Nothing here yet</h2>
        <p className="muted">Tap Scan below and point the camera at something in the pantry or bathroom.</p>
      </section>
    )
  }

  return (
    <section className="stack">
      <input
        type="search"
        className="search"
        placeholder="Search everything…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips">
        <button className={roomFilter === 'all' ? 'chip on' : 'chip'} onClick={() => setRoomFilter('all')}>
          All rooms
        </button>
        {inv.rooms.map((r) => (
          <button key={r.id} className={roomFilter === r.id ? 'chip on' : 'chip'} onClick={() => setRoomFilter(r.id)}>
            {r.name}
          </button>
        ))}
      </div>
      <p className="muted small">
        {inStock.length} {inStock.length === 1 ? 'item' : 'items'} · {totalUnits} in total
      </p>

      {groups.length === 0 && <p className="muted center">No matches.</p>}

      {groups.map(({ room, locs }) => (
        <div key={room.id} className="room-group">
          <h2 className="room-title">{room.name}</h2>
          {locs.map(({ loc, rows }) => (
            <div key={loc.id} className="card list">
              <h3 className="loc-title">{loc.name}</h3>
              {rows.map(({ item, product }) => (
                <Row key={item.id} item={item} product={product} onOpen={() => setOpenItem(item)} onBump={bump} />
              ))}
            </div>
          ))}
        </div>
      ))}

      {ranOut.length > 0 && (
        <details className="card list">
          <summary>
            <h3 className="loc-title inline">Ran out ({ranOut.length})</h3>
          </summary>
          {ranOut.map(({ item, product }) => (
            <Row
              key={item.id}
              item={item}
              product={product}
              sub={inv.locationLabel(item.location_id)}
              onOpen={() => setOpenItem(item)}
              onBump={bump}
            />
          ))}
        </details>
      )}

      {openItem && (
        <ItemSheet
          item={inv.items.find((i) => i.id === openItem.id) ?? openItem}
          inv={inv}
          onClose={() => setOpenItem(null)}
          onToast={onToast}
        />
      )}
    </section>
  )
}

function Row({ item, product, sub, onOpen, onBump }) {
  return (
    <div className={item.quantity === 0 ? 'item-row out' : 'item-row'}>
      <button className="item-main" onClick={onOpen}>
        <ProductThumb product={product} size={44} />
        <span className="item-text">
          <span className="item-name">{product.name}</span>
          <span className="muted small">{sub ?? [product.brand, product.size].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <div className="stepper compact">
        <button aria-label={`Use one ${product.name}`} disabled={item.quantity === 0} onClick={() => onBump(item, -1)}>
          −
        </button>
        <span>{item.quantity}</span>
        <button aria-label={`Add one ${product.name}`} onClick={() => onBump(item, 1)}>
          +
        </button>
      </div>
    </div>
  )
}
