import { supabase } from './supabase'

export const CATEGORIES = [
  'Food',
  'Drinks',
  'Personal care',
  'Shaving',
  'Cleaning',
  'Medicine & first aid',
  'Paper goods',
  'Other',
]

// Guess one of our categories from whatever text a source gives us.
export function guessCategory(text = '', fallback = 'Other') {
  const t = text.toLowerCase()
  if (/razor|blade|shav/.test(t)) return 'Shaving'
  if (/beverage|drink|juice|soda|water|coffee|tea|milk/.test(t)) return 'Drinks'
  if (/clean|detergent|laundry|dish|bleach|disinfect/.test(t)) return 'Cleaning'
  if (/medic|vitamin|supplement|bandage|first aid|pain relief|pharm/.test(t)) return 'Medicine & first aid'
  if (/paper|tissue|towel|toilet roll|napkin/.test(t)) return 'Paper goods'
  if (/lotion|shampoo|soap|wash|cosmetic|deodor|toothpaste|skin|hair|beauty|personal care/.test(t))
    return 'Personal care'
  if (/food|snack|grocery|sauce|cereal|pasta|spice|candy|chocolate/.test(t)) return 'Food'
  return fallback
}

// The Open Facts projects share one API shape: food, beauty and other products.
const OPEN_FACTS = [
  { source: 'openfoodfacts', host: 'world.openfoodfacts.org', fallback: 'Food' },
  { source: 'openbeautyfacts', host: 'world.openbeautyfacts.org', fallback: 'Personal care' },
  { source: 'openproductsfacts', host: 'world.openproductsfacts.org', fallback: 'Other' },
]

async function tryOpenFacts({ source, host, fallback }, barcode) {
  const fields = 'product_name,generic_name,brands,quantity,image_front_small_url,image_url,categories'
  const res = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`)
  if (!res.ok) return null
  const data = await res.json()
  const p = data?.product
  if (data?.status !== 1 || !p) return null
  const name = p.product_name || p.generic_name
  if (!name) return null
  return {
    barcode,
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    size: p.quantity || null,
    image_url: p.image_front_small_url || p.image_url || null,
    category: guessCategory(`${p.categories || ''} ${name}`, fallback),
    source,
  }
}

// Client-side fallback, used only if the `lookup` Edge Function isn't deployed yet.
async function lookupInBrowser(barcode) {
  // A 12-digit UPC-A is often stored as a 13-digit EAN with a leading zero.
  const codes = barcode.length === 12 ? [barcode, `0${barcode}`] : [barcode]
  for (const db of OPEN_FACTS) {
    for (const code of codes) {
      try {
        const hit = await tryOpenFacts(db, code)
        if (hit) return { ...hit, barcode }
      } catch {
        /* try the next source */
      }
    }
  }
  return null
}

/**
 * Find product details for a barcode.
 * 1) the shared cache in our database, 2) the `lookup` Edge Function
 *    (Open Food / Beauty / Products Facts, then UPCitemdb, and it caches),
 * 3) if the function isn't deployed, the Open Facts databases directly.
 * Returns null when nothing knows this barcode.
 */
export async function lookupBarcode(barcode) {
  const { data: cached } = await supabase
    .from('barcode_cache')
    .select('barcode,name,brand,category,image_url,size,source')
    .eq('barcode', barcode)
    .maybeSingle()
  if (cached?.name) return cached

  try {
    const { data, error } = await supabase.functions.invoke('lookup', { body: { barcode } })
    if (!error) return data?.product ?? null
  } catch {
    /* function not deployed: fall through */
  }
  return lookupInBrowser(barcode)
}
