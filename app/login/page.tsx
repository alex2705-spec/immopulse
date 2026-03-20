'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')

  async function doLogin() {
    setError('')
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return }
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setLoading(false)
      setError('Email ou mot de passe incorrect.')
      return
    }

    // Vérifier que le user a des codes postaux attribués
    const { data: access } = await supabase
      .from('user_access')
      .select('code_postal')
      .eq('user_id', data.user.id)

    if (!access || access.length === 0) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Votre compte est en attente d\'activation. Contactez contact@immopulse.io')
      return
    }

    router.push('/carte')
  }

  async function doForgot() {
    if (!email) { setForgotMsg('Entrez votre email.'); return }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    setLoading(false)
    setForgotMsg('Lien envoyé ! Vérifiez votre boîte mail.')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid #E8EAED', fontSize: 14,
    fontFamily: 'DM Sans, sans-serif', outline: 'none',
    color: '#111827', boxSizing: 'border-box'
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #03082a 0%, #0a1d6e 40%, #0e2fa0 70%, #071840 100%)',
      padding: 24, fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontFamily: 'var(--font-jakarta), sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', letterSpacing: -0.5 }}>
            immopulse
          </span>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '48px 44px', boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>

          {!forgotMode ? (
            <>
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 28, fontWeight: 400, textAlign: 'center', marginBottom: 6 }}>
                Connexion
              </h1>
              <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 32 }}>
                Accédez à votre espace agent
              </p>

              {error && (
                <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  placeholder="vous@agence.fr" style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Mot de passe</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  placeholder="••••••••" style={inputStyle}
                />
              </div>

              <div style={{ textAlign: 'right', marginBottom: 20 }}>
                <button onClick={() => setForgotMode(true)} style={{ fontSize: 12, color: '#1A4DC8', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Mot de passe oublié ?
                </button>
              </div>

              <button
                onClick={doLogin} disabled={loading}
                style={{ width: '100%', padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#0A2880,#1A4DC8)', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <a href="/" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>
                  ← Retour à l&apos;accueil
                </a>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 28, fontWeight: 400, textAlign: 'center', marginBottom: 6 }}>
                Mot de passe oublié
              </h1>
              <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 32 }}>
                On vous envoie un lien de réinitialisation
              </p>

              {forgotMsg && (
                <div style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  {forgotMsg}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@agence.fr" style={inputStyle} />
              </div>

              <button
                onClick={doForgot} disabled={loading}
                style={{ width: '100%', padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#0A2880,#1A4DC8)', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 16 }}>
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button onClick={() => setForgotMode(false)} style={{ fontSize: 13, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ← Retour à la connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
