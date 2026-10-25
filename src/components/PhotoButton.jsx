import { useRef, useState } from 'react'
import { uploadProductPhoto } from '../photos'

/**
 * "Take or choose a photo" button. On a phone the picker offers the camera
 * and the photo library. Calls onUploaded(url) when the upload finishes.
 */
export default function PhotoButton({ householdId, hasPhoto, onUploaded, onRemove }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function picked(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onUploaded(await uploadProductPhoto(householdId, file))
    } catch (err) {
      setError(
        /bucket|not found/i.test(err.message)
          ? 'Photo storage is not set up yet. Run the Phase 2 SQL in Supabase.'
          : err.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack tight">
      <div className="row tight">
        <button type="button" className="small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Add photo'}
        </button>
        {hasPhoto && onRemove && (
          <button type="button" className="ghost small danger" disabled={busy} onClick={onRemove}>
            Use default
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={picked} />
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
