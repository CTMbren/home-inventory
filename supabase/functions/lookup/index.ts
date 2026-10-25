// Supabase Edge Function: barcode lookup waterfall with a shared cache.
// Order: barcode_cache → Open Food Facts → Open Beauty Facts → Open Products Facts → UPCitemdb (free trial).
// Deploy: supabase functions deploy lookup
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Product = {
  barcode: string
  name: string
  brand: string | null
  category: string
  image_url: string | null
  size: string | null
  source: string
  raw?: unknown
}

function guessCategory(text = '', fallback = 'Other') {
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

const UA = 'HomeInventory/0.1 (personal household app)'

const OPEN_FACTS = [
  { source: 'openfoodfacts', host: 'world.openfoodfacts.org', fallback: 'Food' },
  { source: 'openbeautyfacts', host: 'world.openbeautyfacts.org', fallback: 'Personal care' },
  { source: 'openproductsfacts', host: 'world.openproductsfacts.org', fallback: 'Other' },
]

async function openFacts(db: (typeof OPEN_FACTS)[number], code: string): Promise<Product | null> {
  const fields = 'product_name,generic_name,brands,quantity,image_front_small_url,image_url,categories'
  const res = await fetch(`https://${db.host}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) return null
  const data = await res.json()
  const p = data?.product
  const name = p?.product_name || p?.generic_name
  if (data?.status !== 1 || !name) return null
  return {
    barcode: code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    size: p.quantity || null,
    image_url: p.image_front_small_url || p.image_url || null,
    category: guessCategory(`${p.categories || ''} ${name}`, db.fallback),
    source: db.source,
    raw: p,
  }
}

async function upcItemDb(code: string): Promise<Product | null> {
  // Free trial endpoint: no key, 100 requests/day, about 6 lookups/minute.
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) return null
  const data = await res.json()
  const item = data?.items?.[0]
  if (!item?.title) return null
  return {
    barcode: code,
    name: item.title,
    brand: item.brand || null,
    size: item.size || null,
    image_url: item.images?.[0] || null,
    category: guessCategory(`${item.category || ''} ${item.title}`),
    source: 'upcitemdb',
    raw: item,
  }
}

async function findOnline(barcode: string): Promise<Product | null> {
  // A 12-digit UPC-A is often stored as a 13-digit EAN with a leading zero.
  const codes = barcode.length === 12 ? [barcode, `0${barcode}`] : [barcode]
  for (const db of OPEN_FACTS) {
    for (const code of codes) {
      try {
        const hit = await openFacts(db, code)
        if (hit) return { ...hit, barcode }
      } catch (_) {
        /* next source */
      }
    }
  }
  try {
    const hit = await upcItemDb(barcode)
    if (hit) return hit
  } catch (_) {
    /* fall through */
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let barcode = ''
  try {
    barcode = String((await req.json())?.barcode ?? '').replace(/\s/g, '')
  } catch (_) {
    /* empty body */
  }
  if (!/^[0-9A-Za-z-]{4,64}$/.test(barcode)) {
    return Response.json({ error: 'barcode required' }, { status: 400, headers: cors })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: cached } = await admin
    .from('barcode_cache')
    .select('barcode,name,brand,category,image_url,size,source')
    .eq('barcode', barcode)
    .maybeSingle()
  if (cached?.name) return Response.json({ product: cached }, { headers: cors })

  const found = await findOnline(barcode)
  if (found) {
    const { raw, ...product } = found
    await admin.from('barcode_cache').upsert({ ...product, raw: raw ?? null, fetched_at: new Date().toISOString() })
    return Response.json({ product }, { headers: cors })
  }
  return Response.json({ product: null }, { headers: cors })
})
