'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Méthode 1 : token_hash dans l'URL (nouveau format Supabase)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    if (token_hash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
        if (error) setError('Lien invalide ou expiré.')
        else setReady(true)
      })
      return
    }

    // Méthode 2 : access_token dans le hash de l'URL (ancien format)
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (error) setError('Lien invalide ou expiré.')
          else setReady(true)
        })
        return
      }
    }

    // Méthode 3 : écouter l'événement PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [searchParams])

  async function handleSubmit() {
    setError('')
    if (!password) return setError('Entrez un nouveau mot de passe')
    if (password.length < 6) return setError('Le mot de passe doit faire au moins 6 caractères')
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else {
      setSuccess(true)
      setTimeout(() => router.push('/carte'), 2000)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #03082a 0%, #0a1d6e 40%, #0e2fa0 70%, #071840 100%)', fontFamily: 'DM Sans, sans-serif', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#2260E8,#1035A0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#fff"><path d="M8 1a5 5 0 0 1 5 5c0 3.5-5 9-5 9S3 9.5 3 6a5 5 0 0 1 5-5zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: '#111', fontFamily: 'var(--font-jakarta), sans-serif' }}>immopulse</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px', letterSpacing: -0.5 }}>Nouveau mot de passe</h1>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 28px' }}>Choisissez un mot de passe sécurisé</p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#065F46' }}>Mot de passe mis à jour !</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>Redirection en cours...</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nouveau mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8EAED', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#2260E8'} onBlur={e => e.target.style.borderColor = '#E8EAED'} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Confirmer le mot de passe</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8EAED', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#2260E8'} onBlur={e => e.target.style.borderColor = '#E8EAED'} />
            </div>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}
            <button onClick={handleSubmit} disabled={loading || !ready}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: (!ready || loading) ? '#9CA3AF' : 'linear-gradient(135deg,#0A2880,#1A4DC8)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: (!ready || loading) ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {loading ? 'Mise à jour...' : !ready ? 'Vérification...' : 'Mettre à jour le mot de passe'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
