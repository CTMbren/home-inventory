import { useState } from 'react'
import { supabase } from '../supabase'

// Email + password rather than magic links: on iPhone, a link opened from
// Mail lands in Safari, which doesn't share sign-in with the home-screen app.
export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email: email.trim(), password })
    setBusy(false)
    if (error) return setError(error.message)
    if (mode === 'signup' && !data.session) {
      setMessage('Check your email and tap the confirmation link, then come back here and sign in.')
      setMode('signin')
    }
  }

  return (
    <div className="center-screen">
      <div className="brand">
        <img src="./icon-192.png" alt="" width="64" height="64" />
        <h1>Home Inventory</h1>
        <p className="muted">What we have, and where it is.</p>
      </div>

      <form className="card stack" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {message && <p className="notice">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
