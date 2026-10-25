import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const hints = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
])

/** Live camera view; calls onDetected(code) once, then stops the camera. */
export default function Scanner({ onDetected }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!window.isSecureContext) {
      setError('The camera only works over HTTPS (or on localhost). Type the barcode below instead.')
      return
    }
    let controls
    let done = false
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
    reader
      .decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
        videoRef.current,
        (result, _err, ctrl) => {
          if (result && !done) {
            done = true
            ctrl.stop()
            navigator.vibrate?.(60)
            onDetected(result.getText())
          }
        },
      )
      .then((c) => {
        controls = c
        if (done) c.stop()
      })
      .catch((e) => {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for this site in your browser settings, or type the barcode below.'
            : `Couldn't start the camera (${e?.message || e}). Type the barcode below instead.`,
        )
      })
    return () => {
      done = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div className="scanner">
      {!error ? (
        <div className="viewfinder">
          <video ref={videoRef} muted playsInline autoPlay />
          <div className="reticle" />
          <p className="hint">Point at the barcode</p>
        </div>
      ) : (
        <p className="error">{error}</p>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          const code = typed.replace(/\s/g, '')
          if (code) onDetected(code)
        }}
      >
        <input
          inputMode="numeric"
          placeholder="Or type the barcode number"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button>Go</button>
      </form>
    </div>
  )
}
