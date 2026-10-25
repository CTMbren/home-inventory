import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Settings({ session, household, onRenamed }) {
  const [members, setMembers] = useState(null)
  const [name, setName] = useState(household.name)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', household.id)
      .then(({ data }) => setMembers(data ?? []))
  }, [household.id])

  async function rename(e) {
    e.preventDefault()
    const { error } = await supabase.from('households').update({ name: name.trim() }).eq('id', household.id)
    if (!error) onRenamed()
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the code is on screen anyway */
    }
  }

  return (
    <section className="stack">
      <div className="card stack">
        <h2>Invite someone</h2>
        <p className="muted small">
          On their phone: open the app, create an account, choose “Join with an invite code” and enter:
        </p>
        <div className="row between">
          <code className="invite">{household.invite_code}</code>
          <button onClick={copyCode}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        {members && (
          <p className="muted small">
            {members.length} {members.length === 1 ? 'person' : 'people'} in this household.
          </p>
        )}
      </div>

      <form className="card stack" onSubmit={rename}>
        <h2>Household name</h2>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button>Save</button>
        </div>
      </form>

      <div className="card stack">
        <h2>Install on your phone</h2>
        <p className="muted small">
          iPhone: open this page in Safari, tap Share, then “Add to Home Screen”. Android: open in Chrome, tap the ⋮ menu,
          then “Install app”.
        </p>
      </div>

      <div className="card stack">
        <p className="muted small">Signed in as {session.user.email}</p>
        <button className="ghost danger" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </section>
  )
}
