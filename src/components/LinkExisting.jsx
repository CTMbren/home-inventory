import { useMemo, useState } from 'react'
import { supabase } from '../supabase'
import ProductThumb from './ProductThumb'

/**
 * Shown when a scanned barcode isn't recognised: lets you say "this is one of
 * ours". Picking a product saves the scanned code on it, so the next scan of
 * this barcode goes straight to it.
 */
export default function LinkExisting({ barcode, products, onLinked }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => !q || [p.name, p.brand].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [products, query])

  if (products.length === 0) return null

  async function link(product) {
    if (
      product.barcode &&
      !confirm(`${product.name} already has barcode ${product.barcode}. Replace it with ${barcode}?`)
    )
      return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase
      .from('products')
      .update({ barcode })
      .eq('id', product.id)
      .select('*')
      .single()
    setBusy(false)
    if (error) {
      return setError(
        error.code === '23505' ? 'Another product already uses this barcode.' : error.message,
      )
    }
    onLinked(data)
  }

  if (!open) {
    return (
      <button type="button" className="ghost" onClick={() => setOpen(true)}>
        Already have this? Pick it from your items
      </button>
    )
  }

  return (
    <div className="card stack">
      <h3>Which product is this?</h3>
      <input
        type="search"
        placeholder="Search your products…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} // don't submit the new-product form
        autoFocus
      />
      {matches.map((p) => (
        <button key={p.id} type="button" className="item-main pick" disabled={busy} onClick={() => link(p)}>
          <ProductThumb product={p} size={40} />
          <span className="item-text">
            <span className="item-name">{p.name}</span>
            <span className="muted small">{[p.brand, p.barcode ? `barcode ${p.barcode}` : 'no barcode'].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      ))}
      {matches.length === 0 && <p className="muted small">No matches.</p>}
      {error && <p className="error">{error}</p>}
      <button type="button" className="ghost small" onClick={() => setOpen(false)}>
        Never mind, it's new
      </button>
    </div>
  )
}
