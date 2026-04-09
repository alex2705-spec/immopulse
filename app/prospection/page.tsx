'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { supabase } from '../supabase'
import { useFavoris } from '../useFavoris'
import { useAuth } from '../useAuth'

type DPE = {
  id: string
  adresse: string
  code_postal: string
  ville: string
  classe_dpe: string | null
  surface_habitable: number | null
  etage: string | null
  type_batiment: string | null
  date_etablissement: string | null
}

type Prospection = {
  id?: string
  dpe_id: string
  user_id?: string
  statut: string
  contact_proprio: string
  autre_contact: string
  note: string
}

const DPE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: '#d4f0d4', text: '#166534' },
  B: { bg: '#d9f0c0', text: '#3a5c1a' },
  C: { bg: '#f0f0b0', text: '#5c5a00' },
  D: { bg: '#fef08a', text: '#713f12' },
  E: { bg: '#fdd9a0', text: '#92400e' },
  F: { bg: '#fdba8a', text: '#7c2d12' },
  G: { bg: '#fca5a5', text: '#7f1d1d' },
}

const STATUTS = [
  { value: 'a_visiter',     label: 'À visiter',     bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
  { value: 'a_recontacter', label: 'À recontacter', bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  { value: 'mandat_signe',  label: 'Mandat signé',  bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  { value: 'perdu',         label: 'Perdu',         bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
]

const TYPES_CONTACT = [
  { label: 'Propriétaire', bg: '#1035A0', color: '#fff',    dropdownColor: '#111', hoverBg: '#1035A0', hoverColor: '#fff' },
  { label: 'Famille',      bg: '#2260E8', color: '#fff',    dropdownColor: '#111', hoverBg: '#2260E8', hoverColor: '#fff' },
  { label: 'Locataire',    bg: '#60A5FA', color: '#fff',    dropdownColor: '#111', hoverBg: '#60A5FA', hoverColor: '#fff' },
  { label: 'Gardien',      bg: '#BFDBFE', color: '#1E40AF', dropdownColor: '#111', hoverBg: '#BFDBFE', hoverColor: '#1E40AF' },
  { label: 'Autre',        bg: '#E5E7EB', color: '#374151', dropdownColor: '#111', hoverBg: '#E5E7EB', hoverColor: '#374151' },
  { label: 'Aucun',        bg: '#111827', color: '#fff',    dropdownColor: '#111', hoverBg: '#111827', hoverColor: '#fff' },
]

const GRAD = 'linear-gradient(135deg,#0A2880,#1A4DC8)'

function formatDateFR(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function StatutBadge({ dpeId, pro, onUpdate, openDropdown, setOpenDropdown }: {
  dpeId: string, pro: Prospection,
  onUpdate: (field: string, value: string) => void,
  openDropdown: string | null,
  setOpenDropdown: (k: string | null) => void
}) {
  const key = dpeId + '_statut'
  const open = openDropdown === key
  const s = STATUTS.find(s => s.value === pro.statut) || STATUTS[0]
  const btnRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 160 })
    }
    setOpenDropdown(open ? null : key)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={btnRef} onClick={handleOpen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }}/>
        {s.label}
      </div>
      {open && typeof document !== 'undefined' && createPortal(
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, background: '#fff', border: '1px solid #E8EAED', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 4, minWidth: 160, zIndex: 99999 }}>
          {STATUTS.map(opt => (
            <div key={opt.value} onClick={() => { onUpdate('statut', opt.value); setOpenDropdown(null) }}
              style={{ padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: opt.color, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = opt.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: opt.dot, flexShrink: 0 }}/>{opt.label}
            </div>
          ))}
        </div>, document.body
      )}
    </div>
  )
}

function TypeContactCell({ value, onSave, dropdownKey, openDropdown, setOpenDropdown }: {
  value: string, onSave: (v: string) => void,
  dropdownKey: string, openDropdown: string | null, setOpenDropdown: (k: string | null) => void
}) {
  const open = openDropdown === dropdownKey
  const [custom, setCustom] = useState(false)
  const [localVal, setLocalVal] = useState(value)
  const btnRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useEffect(() => { setLocalVal(value) }, [value])
  const typeInfo = TYPES_CONTACT.find(t => t.label === value)

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpenDropdown(open ? null : dropdownKey)
  }

  if (custom) return (
    <input autoFocus value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={() => { onSave(localVal); setCustom(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(localVal); setCustom(false) } if (e.key === 'Escape') setCustom(false) }}
      onClick={e => e.stopPropagation()}
      style={{ width: '100%', border: '1.5px solid #1035A0', borderRadius: 8, padding: '4px 8px', fontSize: 12, outline: 'none', fontFamily: 'DM Sans, sans-serif', minWidth: 100 }} />
  )

  return (
    <div style={{ position: 'relative' }}>
      <div ref={btnRef} onClick={handleOpen}
        style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        {value && typeInfo
          ? <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: typeInfo.bg, color: typeInfo.color }}>{value}</span>
          : value
            ? <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: '#F9FAFB', color: '#9CA3AF' }}>{value}</span>
            : <span style={{ fontSize: 12, color: '#C4C4C4' }}>Choisir...</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M2 3.5l3 3 3-3"/></svg>
      </div>
      {open && typeof document !== 'undefined' && createPortal(
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, background: '#fff', border: '1px solid #E8EAED', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 4, minWidth: 160, zIndex: 99999 }}>
          {TYPES_CONTACT.map(opt => (
            <div key={opt.label}
              onClick={() => { if (opt.label === 'Autre') { setCustom(true); setOpenDropdown(null) } else { onSave(opt.label); setOpenDropdown(null) } }}
              style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.background = opt.hoverBg; (e.currentTarget.querySelector('span') as HTMLElement).style.color = opt.hoverColor }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; (e.currentTarget.querySelector('span') as HTMLElement).style.color = opt.dropdownColor }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: opt.dropdownColor }}>{opt.label}</span>
            </div>
          ))}
        </div>, document.body
      )}
    </div>
  )
}

function TextCell({ value, placeholder, onSave }: { value: string, placeholder: string, onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])

  if (editing) return (
    <input autoFocus value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { onSave(local); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(local); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      onClick={e => e.stopPropagation()}
      style={{ width: '100%', border: '1.5px solid #1035A0', borderRadius: 8, padding: '4px 8px', fontSize: 12, outline: 'none', fontFamily: 'DM Sans, sans-serif', minWidth: 100 }} />
  )

  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true) }}
      style={{ fontSize: 12, color: value ? '#111' : '#C4C4C4', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, minHeight: 26, display: 'flex', alignItems: 'center' }}
      onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {value || placeholder}
    </div>
  )
}

export default function ProspectionPage() {
  const { access, loading: authLoading, logout } = useAuth()
  const [dpes, setDpes] = useState<DPE[]>([])
  const [prospections, setProspections] = useState<Record<string, Prospection>>({})
  const [loading, setLoading] = useState(true)
  const { favoris, toggleFavori } = useFavoris()
  const [filterStatut, setFilterStatut] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const PAGE_SIZE = 20

  useEffect(() => {
    if (!access) return
    async function load() {
      setLoading(true)
      const { data: dpeData } = await supabase
        .from('dpes')
        .select('id,adresse,code_postal,ville,classe_dpe,surface_habitable,etage,type_batiment,date_etablissement')
        .in('code_postal', access!.codesPostaux)
        .order('date_etablissement', { ascending: false })
        .limit(500)
      const { data: proData } = await supabase
        .from('prospection').select('*').eq('user_id', access!.userId)
      setDpes(dpeData || [])
      const proMap: Record<string, Prospection> = {}
      ;(proData || []).forEach((p: any) => { proMap[p.dpe_id] = p })
      setProspections(proMap)
      setLoading(false)
    }
    load()
  }, [access])

  const getPro = useCallback((dpeId: string): Prospection => {
    return prospections[dpeId] || { dpe_id: dpeId, statut: 'a_visiter', contact_proprio: '', autre_contact: '', note: '' }
  }, [prospections])

  const handleUpdate = useCallback(async (dpeId: string, field: string, value: string) => {
    if (!access) return
    const existing = getPro(dpeId)
    const updated = { ...existing, [field]: value }
    setProspections(prev => ({ ...prev, [dpeId]: { ...updated, dpe_id: dpeId, user_id: access.userId } }))
    const payload = { dpe_id: dpeId, user_id: access.userId, statut: updated.statut, contact_proprio: updated.contact_proprio, autre_contact: updated.autre_contact, note: updated.note, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('prospection').upsert(payload, { onConflict: 'dpe_id,user_id' }).select().single()
    if (data) setProspections(prev => ({ ...prev, [dpeId]: data }))
    if (error) console.error('Erreur sauvegarde:', error)
  }, [getPro, access])

  if (authLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', color: '#6B7280' }}>Chargement...</div>
  )

  const dpesEnFavoris = dpes.filter(dpe => favoris.has(dpe.id))
  const dpesFiltered = dpesEnFavoris.filter(dpe => {
    const pro = getPro(dpe.id)
    if (filterStatut && pro.statut !== filterStatut) return false
    if (searchQuery && !dpe.adresse.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })
  const totalPages = Math.ceil(dpesFiltered.length / PAGE_SIZE)
  const currentPage = page >= totalPages ? Math.max(0, totalPages - 1) : page
  const dpesAffiches = dpesFiltered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const stats = {
    aVisiter:     dpesEnFavoris.filter(d => getPro(d.id).statut === 'a_visiter').length,
    aRecontacter: dpesEnFavoris.filter(d => getPro(d.id).statut === 'a_recontacter').length,
    mandat:       dpesEnFavoris.filter(d => getPro(d.id).statut === 'mandat_signe').length,
    perdu:        dpesEnFavoris.filter(d => getPro(d.id).statut === 'perdu').length,
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#F0F4FF', minHeight: '100vh', overflowX: 'hidden' }}
      onClick={() => { setOpenDropdown(null); setShowMobileMenu(false) }}>

      {/* TOPBAR */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8EAED', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="url(#lg-p)"/>
            <defs><linearGradient id="lg-p" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stopColor="#0A2880"/><stop offset="100%" stopColor="#1A4DC8"/></linearGradient></defs>
            <polyline points="4,18 9,18 11,12 14,22 17,10 20,20 23,18 28,18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-jakarta), sans-serif', fontWeight: 800, fontSize: 22, color: '#0A2880', letterSpacing: -0.5 }}>immopulse</span>
        </div>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="desktop-nav">
          <button onClick={logout} style={{ padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 500, border: '1.5px solid #E8EAED', color: '#6B7280', background: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Déconnexion</button>
          <Link href="/carte" style={{ padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 500, background: GRAD, color: '#fff', textDecoration: 'none' }}>Voir la carte</Link>
        </div>

        {/* Mobile nav */}
        <div className="mobile-nav" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowMobileMenu(!showMobileMenu)}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E8EAED', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 1.5, background: '#6B7280', borderRadius: 2 }}/>
            <div style={{ width: 16, height: 1.5, background: '#6B7280', borderRadius: 2 }}/>
            <div style={{ width: 16, height: 1.5, background: '#6B7280', borderRadius: 2 }}/>
          </button>
          {showMobileMenu && (
            <div style={{ position: 'absolute', top: 44, right: 0, background: '#fff', border: '1px solid #E8EAED', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: 8, zIndex: 99999, minWidth: 180 }}>
              <Link href="/carte" onClick={() => setShowMobileMenu(false)} style={{ display: 'block', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#111', textDecoration: 'none', marginBottom: 4 }}>Voir la carte</Link>
              <button onClick={() => { setShowMobileMenu(false); logout() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Déconnexion</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mobile-nav { display: none !important; }
        @media (max-width: 767px) { .mobile-nav { display: flex !important; } .desktop-nav { display: none !important; } }
      `}</style>

      {/* CONTENU */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px 24px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 400, color: '#111', margin: 0, fontFamily: 'DM Serif Display, serif' }}>Espace Prospection</h1>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: '6px 0 0' }}>{dpesEnFavoris.length} bien{dpesEnFavoris.length > 1 ? 's' : ''} en suivi</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'À visiter',     value: stats.aVisiter,     color: '#6B7280', statut: 'a_visiter' },
            { label: 'À recontacter', value: stats.aRecontacter, color: '#92400E', statut: 'a_recontacter' },
            { label: 'Mandat signé',  value: stats.mandat,       color: '#065F46', statut: 'mandat_signe' },
            { label: 'Perdu',         value: stats.perdu,        color: '#991B1B', statut: 'perdu' },
          ].map(stat => (
            <div key={stat.label} onClick={() => setFilterStatut(filterStatut === stat.statut ? null : stat.statut)}
              style={{ background: '#fff', border: filterStatut === stat.statut ? `2px solid ${stat.color}` : '1px solid #E8EAED', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div style={{ background: '#fff', border: '1px solid #E8EAED', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F7F8FA', border: '1.5px solid #E8EAED', borderRadius: 100, padding: '7px 14px', flex: 1, minWidth: 180 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0) }} placeholder="Rechercher une adresse..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', fontFamily: 'DM Sans, sans-serif' }}/>
          </div>
          {(filterStatut || searchQuery) && (
            <button onClick={() => { setFilterStatut(null); setSearchQuery(''); setPage(0) }}
              style={{ padding: '7px 14px', borderRadius: 100, fontSize: 12, border: '1.5px solid #E8EAED', color: '#9CA3AF', background: '#fff', cursor: 'pointer' }}>Réinitialiser</button>
          )}
          <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>{dpesFiltered.length} résultat{dpesFiltered.length > 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Chargement...</div>
        ) : dpesEnFavoris.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, border: '1px solid #E8EAED' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>♡</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 8 }}>Aucun bien en suivi</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Ajoutez des favoris depuis la carte pour les retrouver ici</div>
            <Link href="/carte" style={{ padding: '10px 20px', borderRadius: 100, background: GRAD, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>Ouvrir la carte</Link>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8EAED', borderRadius: 16, overflow: 'visible' }}>
            <div style={{ overflowX: 'auto', borderRadius: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8EAED', background: '#F9FAFB' }}>
                    {['Adresse','DPE','Surface','Étage','Type','Date','Type de contact','Contact','Commentaire','Statut',''].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dpesAffiches.map((dpe, i) => {
                    const colors = dpe.classe_dpe ? DPE_COLORS[dpe.classe_dpe] : { bg: '#f3f4f6', text: '#6b7280' }
                    const pro = getPro(dpe.id)
                    return (
                      <tr key={dpe.id}
                        style={{ borderBottom: i < dpesAffiches.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFBFF'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <td style={{ padding: '10px 14px', minWidth: 180 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{dpe.adresse}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{dpe.ville}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ width: 36, height: 42, borderRadius: 8, background: colors.bg, color: colors.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{dpe.classe_dpe || '?'}</span>
                            <span style={{ fontSize: 8, opacity: 0.7 }}>DPE</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{dpe.surface_habitable ? `${Math.round(dpe.surface_habitable)} m²` : '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{dpe.etage && dpe.etage !== '0' ? `${dpe.etage}e` : '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{dpe.type_batiment ? dpe.type_batiment.charAt(0).toUpperCase() + dpe.type_batiment.slice(1) : '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{formatDateFR(dpe.date_etablissement)}</td>
                        <td style={{ padding: '10px 14px', minWidth: 130 }} onClick={e => e.stopPropagation()}>
                          <TypeContactCell value={pro.contact_proprio} onSave={v => handleUpdate(dpe.id, 'contact_proprio', v)} dropdownKey={dpe.id + '_contact'} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
                        </td>
                        <td style={{ padding: '10px 14px', minWidth: 140 }}>
                          <TextCell value={pro.autre_contact} placeholder="Tél / Mail" onSave={v => handleUpdate(dpe.id, 'autre_contact', v)} />
                        </td>
                        <td style={{ padding: '10px 14px', minWidth: 180 }}>
                          <TextCell value={pro.note} placeholder="Commentaire" onSave={v => handleUpdate(dpe.id, 'note', v)} />
                        </td>
                        <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                          <StatutBadge dpeId={dpe.id} pro={pro} onUpdate={(f, v) => handleUpdate(dpe.id, f, v)} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => toggleFavori(dpe.id)}
                            style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}
                            title="Retirer des favoris">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#111" strokeWidth="1.5"><path d="M1 1l10 10M11 1L1 11"/></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px', borderTop: '1px solid #E8EAED' }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)}
                    style={{ width: 36, height: 36, borderRadius: '50%', border: currentPage === i ? 'none' : '1px solid #E8EAED', background: currentPage === i ? GRAD : '#fff', color: currentPage === i ? '#fff' : '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
