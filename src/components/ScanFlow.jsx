import { Suspense, lazy, useCallback, useState } from 'react'
import { supabase } from '../supabase'
import { CATEGORIES, lookupBarcode } from '../lookup'
import { addStock, adjustStock } from '../useInventory'

// The barcode decoder is the heaviest part of the app; load it only on the Scan tab.
const Scanner = lazy(() => import('./Scanner'))
import LocationPicker, { lastLocation, rememberLocation } from './LocationPicker'
import Stepper from './Stepper'
import ProductThumb from './ProductThumb'

const EMPTY = { barcode: null, name: '', brand: '', category: 'Other', size: '', image_url: null, source: 'manual' }

export default function ScanFlow({ householdId, inv, onToast }) {
  // step: scan | checking | known | new
  const [step, setStep] = useState('scan')
  const [barcode, setBarcode] = useState(null)
  const [product, setProduct] = useState(null) // existing product row
  const [draft, setDraft] = useState(EMPTY) // new product form
  const [foundOnline, setFoundOnline] = useState(false)
  const [locationId, setLocationId] = useState(() => lastLocation(inv.locations))
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const reset = () => {
    setStep('scan')
    setBarcode(null)
    setProduct(null)
    setDraft(EMPTY)
    setQty(1)
    setError(null)
  }

  const onDetected = useCallback(
    async (code) => {
      setBarcode(code)
      setStep('checking')
      setError(null)
      setQty(1)
      if (!locationId) setLocationId(lastLocation(inv.locations))

      // 1) Already one of our products?
      const { data: mine } = await supabase
        .from('products')
        .select('*')
        .eq('household_id', householdId)
        .eq('barcode', code)
        .maybeSingle()
      if (mine) {
        setProduct(mine)
        setStep('known')
        return
      }
      // 2) Look it up online.
      let hit = null
      try {
        hit = await lookupBarcode(code)
      } catch {
        hit = null
      }
      setFoundOnline(Boolean(hit))
      setDraft(
        hit
          ? { ...EMPTY, ...hit, brand: hit.brand ?? '', size: hit.size ?? '', barcode: code }
          : { ...EMPTY, barcode: code },
      )
      setStep('new')
    },
    [householdId, inv.locations, locationId],
  )

  function startManual() {
    setBarcode(null)
    setFoundOnline(false)
    setDraft(EMPTY)
    setQty(1)
    if (!locationId) setLocationId(lastLocation(inv.locations))
    setStep('new')
  }

  async function saveNew(e) {
    e.preventDefault()
    if (!draft.name.trim()) return setError('Give it a name.')
    if (!locationId) return setError('Pick a location.')
    setBusy(true)
    setError(null)
    try {
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          household_id: householdId,
          barcode: draft.barcode || null,
          name: draft.name.trim(),
          brand: draft.brand?.trim() || null,
          category: draft.category,
          size: draft.size?.trim() || null,
          image_url: draft.image_url || null,
          source: draft.source || 'manual',
        })
        .select('*')
        .single()
      if (error) throw error
      await addStock({ householdId, productId: created.id, locationId, qty })
      rememberLocation(locationId)
      onToast(`Added ${qty} × ${created.name} to ${inv.locationLabel(locationId)}`)
      reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function addKnown() {
    if (!locationId) return setError('Pick a location.')
    setBusy(true)
    setError(null)
    try {
      await addStock({ householdId, productId: product.id, locationId, qty })
      rememberLocation(locationId)
      onToast(`Added ${qty} × ${product.name} to ${inv.locationLabel(locationId)}`)
      reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function markUsed(item) {
    try {
      await adjustStock(item, -1)
      onToast(`Used one ${product.name}. ${Math.max(0, item.quantity - 1)} left in ${inv.locationLabel(item.location_id)}.`)
      reset()
    } catch (err) {
      setError(err.message)
    }
  }

  if (step === 'scan') {
    return (
      <section className="stack">
        <Suspense fallback={<div className="spinner" />}>
          <Scanner onDetected={onDetected} />
        </Suspense>
        <button className="ghost" onClick={startManual}>
          No barcode? Add it by hand
        </button>
      </section>
    )
  }

  if (step === 'checking') {
    return (
      <section className="card center">
        <div className="spinner" />
        <p>Looking up {barcode}…</p>
      </section>
    )
  }

  if (step === 'known') {
    const stock = inv.items.filter((i) => i.product_id === product.id)
    return (
      <section className="stack">
        <div className="card product-head">
          <ProductThumb product={product} />
          <div>
            <h2>{product.name}</h2>
            <p className="muted small">{[product.brand, product.size, product.category].filter(Boolean).join(' · ')}</p>
          </div>
        </div>

        {stock.length > 0 && (
          <div className="card stack">
            <h3>We have</h3>
            {stock.map((item) => (
              <div key={item.id} className="row between">
                <span>
                  <strong>{item.quantity}</strong> in {inv.locationLabel(item.location_id)}
                </span>
                <button disabled={item.quantity === 0} onClick={() => markUsed(item)}>
                  Used one
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="card stack">
          <h3>Add more</h3>
          <LocationPicker rooms={inv.rooms} locations={inv.locations} value={locationId} onChange={setLocationId} />
          <div className="row between">
            <span>How many?</span>
            <Stepper value={qty} onChange={setQty} min={1} />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy} onClick={addKnown}>
            Add {qty}
          </button>
        </div>
        <button className="ghost" onClick={reset}>
          Scan something else
        </button>
      </section>
    )
  }

  // step === 'new'
  return (
    <form className="stack" onSubmit={saveNew}>
      <div className="card stack">
        <div className="row between">
          <h2>{draft.barcode ? 'New product' : 'Add by hand'}</h2>
          {draft.barcode && <span className="pill">{draft.barcode}</span>}
        </div>
        {draft.barcode && (
          <p className={foundOnline ? 'notice' : 'muted small'}>
            {foundOnline
              ? 'Found online. Check the details and fix anything that looks off.'
              : "Couldn't find this barcode online. Fill in what you know; we'll remember it next time."}
          </p>
        )}
        <div className="product-head">
          <ProductThumb product={draft} />
          <label className="grow">
            Name
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Coconut body lotion"
              required
            />
          </label>
        </div>
        <div className="grid2">
          <label>
            Brand
            <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
          </label>
          <label>
            Size
            <input
              value={draft.size}
              onChange={(e) => setDraft({ ...draft, size: e.target.value })}
              placeholder="500 ml"
            />
          </label>
        </div>
        <label>
          Category
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="card stack">
        <LocationPicker rooms={inv.rooms} locations={inv.locations} value={locationId} onChange={setLocationId} />
        <div className="row between">
          <span>How many?</span>
          <Stepper value={qty} onChange={setQty} min={1} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="ghost" onClick={reset}>
        Cancel
      </button>
    </form>
  )
}
