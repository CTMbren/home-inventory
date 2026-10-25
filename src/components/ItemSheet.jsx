import { useState } from 'react'
import { supabase } from '../supabase'
import { CATEGORIES } from '../lookup'
import { logEvent } from '../useInventory'
import LocationPicker from './LocationPicker'
import Stepper from './Stepper'
import ProductThumb from './ProductThumb'
import PhotoButton from './PhotoButton'
import { deleteProductPhoto } from '../photos'

/** Bottom sheet to edit one item: count, location, product details, photo, delete. */
export default function ItemSheet({ item, inv, onClose, onToast }) {
  const product = inv.productById[item.product_id]

  // Photo changes save straight away so the new thumbnail shows everywhere at once.
  async function setPhoto(url) {
    const previous = product.custom_image_url
    const { error } = await supabase.from('products').update({ custom_image_url: url }).eq('id', product.id)
    if (error) return setError(error.message)
    if (previous && previous !== url) deleteProductPhoto(previous)
    await inv.reload()
    onToast(url ? 'Photo saved' : 'Back to the default picture')
  }
  const [qty, setQty] = useState(item.quantity)
  const [locationId, setLocationId] = useState(item.location_id)
  const [name, setName] = useState(product?.name ?? '')
  const [brand, setBrand] = useState(product?.brand ?? '')
  const [category, setCategory] = useState(product?.category ?? 'Other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (name !== product.name || brand !== (product.brand ?? '') || category !== product.category) {
        const { error } = await supabase
          .from('products')
          .update({ name: name.trim() || product.name, brand: brand.trim() || null, category })
          .eq('id', product.id)
        if (error) throw error
      }
      if (locationId !== item.location_id) {
        // Moving onto a spot that already holds this product merges the counts.
        const target = inv.items.find(
          (i) => i.product_id === item.product_id && i.location_id === locationId && i.id !== item.id,
        )
        if (target) {
          const { error: e1 } = await supabase
            .from('inventory_items')
            .update({ quantity: target.quantity + qty })
            .eq('id', target.id)
          if (e1) throw e1
          const { error: e2 } = await supabase.from('inventory_items').delete().eq('id', item.id)
          if (e2) throw e2
        } else {
          const { error } = await supabase
            .from('inventory_items')
            .update({ location_id: locationId, quantity: qty })
            .eq('id', item.id)
          if (error) throw error
        }
        await logEvent({ householdId: item.household_id, productId: item.product_id, type: 'move', delta: qty })
        onToast(`Moved to ${inv.locationLabel(locationId)}`)
      } else if (qty !== item.quantity) {
        const { error } = await supabase.from('inventory_items').update({ quantity: qty }).eq('id', item.id)
        if (error) throw error
        await logEvent({
          householdId: item.household_id,
          itemId: item.id,
          productId: item.product_id,
          type: 'edit',
          delta: qty - item.quantity,
        })
      }
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Remove ${product.name} from ${inv.locationLabel(item.location_id)}?`)) return
    setBusy(true)
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
    setBusy(false)
    if (error) return setError(error.message)
    await logEvent({ householdId: item.household_id, productId: item.product_id, type: 'discard', delta: -item.quantity })
    onToast(`Removed ${product.name}`)
    onClose()
  }

  if (!product) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet stack" role="dialog" aria-label={product.name} onClick={(e) => e.stopPropagation()}>
        <div className="product-head">
          <ProductThumb product={product} />
          <div className="grow">
            <h2>{product.name}</h2>
            <p className="muted small">{inv.locationLabel(item.location_id)}</p>
          </div>
          <button className="ghost icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <PhotoButton
          householdId={item.household_id}
          hasPhoto={Boolean(product.custom_image_url)}
          onUploaded={setPhoto}
          onRemove={() => setPhoto(null)}
        />

        <div className="row between">
          <span>Quantity</span>
          <Stepper value={qty} onChange={setQty} />
        </div>

        <LocationPicker
          rooms={inv.rooms}
          locations={inv.locations}
          value={locationId}
          onChange={setLocationId}
          label="Location"
        />

        <details>
          <summary className="muted small">Edit product details</summary>
          <div className="stack pad-top">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Brand
              <input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {product.barcode && <p className="muted small">Barcode {product.barcode}</p>}
          </div>
        </details>

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy} onClick={save}>
          Save
        </button>
        <button className="danger ghost" disabled={busy} onClick={remove}>
          Remove from this location
        </button>
      </div>
    </div>
  )
}
