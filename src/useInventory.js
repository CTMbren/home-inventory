import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

/** Loads everything for one household and keeps it fresh via realtime. */
export function useInventory(householdId) {
  const [rooms, setRooms] = useState([])
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!householdId) return
    const [r, l, p, i] = await Promise.all([
      supabase.from('rooms').select('*').eq('household_id', householdId).order('sort_order').order('name'),
      supabase.from('locations').select('*').eq('household_id', householdId).order('sort_order').order('name'),
      supabase.from('products').select('*').eq('household_id', householdId).order('name'),
      supabase.from('inventory_items').select('*').eq('household_id', householdId),
    ])
    const err = r.error || l.error || p.error || i.error
    if (err) setError(err.message)
    else {
      setError(null)
      setRooms(r.data)
      setLocations(l.data)
      setProducts(p.data)
      setItems(i.data)
    }
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    if (!householdId) return
    reload()
    // Any change on either phone triggers a refresh on the other.
    const channel = supabase.channel(`household-${householdId}`)
    for (const table of ['rooms', 'locations', 'products', 'inventory_items']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        () => reload(),
      )
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, reload])

  const lookups = useMemo(() => {
    const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))
    const locationById = Object.fromEntries(locations.map((l) => [l.id, l]))
    const productById = Object.fromEntries(products.map((p) => [p.id, p]))
    const locationLabel = (id) => {
      const loc = locationById[id]
      if (!loc) return 'Unknown location'
      return `${roomById[loc.room_id]?.name ?? '?'} · ${loc.name}`
    }
    return { roomById, locationById, productById, locationLabel }
  }, [rooms, locations, products])

  return { rooms, locations, products, items, loading, error, reload, ...lookups }
}

/** Add `qty` of a product to a location, merging with an existing row there. */
export async function addStock({ householdId, productId, locationId, qty }) {
  const { data: existing, error: findErr } = await supabase
    .from('inventory_items')
    .select('id,quantity')
    .eq('household_id', householdId)
    .eq('product_id', productId)
    .eq('location_id', locationId)
    .limit(1)
    .maybeSingle()
  if (findErr) throw findErr

  let itemId
  if (existing) {
    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity: existing.quantity + qty })
      .eq('id', existing.id)
    if (error) throw error
    itemId = existing.id
  } else {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ household_id: householdId, product_id: productId, location_id: locationId, quantity: qty })
      .select('id')
      .single()
    if (error) throw error
    itemId = data.id
  }
  await logEvent({ householdId, itemId, productId, type: 'add', delta: qty })
  return itemId
}

/** Change an item's count by delta (never below zero). */
export async function adjustStock(item, delta) {
  const quantity = Math.max(0, item.quantity + delta)
  const { error } = await supabase.from('inventory_items').update({ quantity }).eq('id', item.id)
  if (error) throw error
  await logEvent({
    householdId: item.household_id,
    itemId: item.id,
    productId: item.product_id,
    type: delta < 0 ? 'use' : 'add',
    delta,
  })
}

export async function logEvent({ householdId, itemId, productId, type, delta }) {
  // Best effort: the history log should never block the main action.
  await supabase.from('events').insert({
    household_id: householdId,
    inventory_item_id: itemId ?? null,
    product_id: productId ?? null,
    type,
    delta: delta ?? null,
  })
}
