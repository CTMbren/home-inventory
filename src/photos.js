import { supabase } from './supabase'

const BUCKET = 'product-images'
const MAX_SIDE = 640 // px; thumbnails show at 44–56 px, this leaves room for a larger view later

/** Shrink a phone photo to a small square-ish JPEG (~30–60 KB). */
async function resize(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process photo'))), 'image/jpeg', 0.82),
  )
}

/**
 * Upload a photo for a product and return its URL.
 * Files live under <household id>/<random id>.jpg; the storage policies only let
 * members of that household add or remove files in its folder.
 */
export async function uploadProductPhoto(householdId, file) {
  const blob = await resize(file)
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Remove a photo we uploaded earlier (best effort; ignores outside URLs). */
export async function deleteProductPhoto(url) {
  const marker = `/object/public/${BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  if (i < 0) return
  await supabase.storage.from(BUCKET).remove([url.slice(i + marker.length)])
}
