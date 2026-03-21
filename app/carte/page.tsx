'use client'

import { useAuth } from '../useAuth'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { supabase } from '../supabase'
import { useFavoris } from '../useFavoris'

type DPE = {
  id: string
  adresse: string
  code_postal: string
  ville: string
  classe_dpe: string | null
  consommation_energie: number | null
  emission_ges: string | null
  surface_habitable: number | null
  etage: string | null
  type_batiment: string | null
  annee_construction: number | null
  date_etablissement: string | null
  latitude: number | null
  longitude: number | null
  is_new: boolean
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

const FAV_COLOR  = '#1035A0'
const FAV_BG     = '#EEF2FF'
const FAV_BORDER = '#C7D2FE'
const GRAD       = 'linear-gradient(135deg,#0A2880,#1A4DC8)'

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function inDateRange(dateStr: string | null, days: number | null): boolean {
  if (!days || !dateStr) return true
  return (Date.now() - new Date(dateStr).getTime()) / 86400000 <= days
}

function inSelectedDates(dateStr: string | null, selectedDates: Set<string>): boolean {
  if (selectedDates.size === 0) return false
  if (!dateStr) return false
  return selectedDates.has(dateStr.split('T')[0])
}

const stdDateOptions = [
  { label: '7 derniers jours',  days: 7  },
  { label: '15 derniers jours', days: 15 },
  { label: '30 derniers jours', days: 30 },
  { label: 'Tout afficher',     days: null },
  { label: 'Personnalisé',      days: -1  },
]

export default function CartePage() {
  const { access, loading: authLoading, logout } = useAuth()

  const [dpes, setDpes] = useState<DPE[]>([])
  const [selected, setSelected] = useState<DPE | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const { favoris, toggleFavori } = useFavoris()
  const [filterClasse, setFilterClasse] = useState<string[]>([])
  const [filterEtage, setFilterEtage] = useState(false)
  const [filterFavoris, setFilterFavoris] = useState(false)
  const [filterDays, setFilterDays] = useState<number | null>(15)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [mapReady, setMapReady] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const dateBtnRef = useRef<HTMLButtonElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const leafletRef = useRef<any>(null)
  const initDoneRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const drawerRef = useRef<HTMLDivElement>(null)

  const isCustomMode = filterDays === -1

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!access) return
    async function load() {
      const { data } = await supabase
        .from('dpes').select('*')
        .in('code_postal', access!.codesPostaux)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('date_etablissement', { ascending: false })
        .limit(500)
      setDpes(data || [])
    }
    load()
  }, [access])

  const dateGroups = useMemo(() => {
    const map: Record<string, number> = {}
    dpes.forEach(dpe => {
      if (!dpe.date_etablissement) return
      const d = dpe.date_etablissement.split('T')[0]
      map[d] = (map[d] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({ date, count }))
  }, [dpes])

  const dpesFiltres = useMemo(() => dpes.filter(dpe => {
    if (filterClasse.length > 0 && !filterClasse.includes(dpe.classe_dpe || '')) return false
    if (filterEtage && (!dpe.etage || dpe.etage === '0')) return false
    if (filterFavoris && !favoris.has(dpe.id)) return false
    if (isCustomMode) {
      if (!inSelectedDates(dpe.date_etablissement, selectedDates)) return false
    } else {
      if (!inDateRange(dpe.date_etablissement, filterDays)) return false
    }
    return true
  }), [dpes, filterClasse, filterEtage, filterFavoris, filterDays, selectedDates, favoris, isCustomMode])

  useEffect(() => {
    if (authLoading || typeof window === 'undefined' || !mapRef.current || initDoneRef.current) return
    initDoneRef.current = true
    async function initMap() {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      leafletRef.current = L
      const container = mapRef.current as any
      if (container?._leaflet_id) container._leaflet_id = null
      const map = L.map(mapRef.current!, { center: [43.552, 7.017], zoom: 13, zoomControl: false })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      mapInstanceRef.current = map
      setMapReady(true)
    }
    initMap()
    return () => {
      initDoneRef.current = false
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      setMapReady(false)
    }
  }, [authLoading])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current || dpes.length === 0) return
    const L = leafletRef.current
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    dpesFiltres.forEach(dpe => {
      if (!dpe.latitude || !dpe.longitude) return
      const colors = dpe.classe_dpe ? DPE_COLORS[dpe.classe_dpe] : { bg: '#fff', text: '#111' }
      const isSelected = selected?.id === dpe.id
      const isHovered  = hoveredId === dpe.id
      const isFav      = favoris.has(dpe.id)
      const isActive   = isSelected || isHovered
      const adresseShort = dpe.adresse.length > 30 ? dpe.adresse.substring(0, 28) + '…' : dpe.adresse
      const shadow = isActive ? '0 4px 18px rgba(10,40,128,0.5)' : '0 2px 8px rgba(0,0,0,0.1)'
      const pinHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="width:36px;height:36px;border-radius:50%;background:${isActive?'linear-gradient(135deg,#0A2880,#1A4DC8)':isFav?'#EEF2FF':colors.bg};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;border:2px solid ${isActive?'#0A2880':'rgba(255,255,255,0.8)'};transition:all 0.2s;transform:${isActive?'scale(1.3)':'scale(1)'};">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="${isActive?'#fff':isFav?'#2260E8':colors.text}"><path d="M8 1a5 5 0 0 1 5 5c0 3.5-5 9-5 9S3 9.5 3 6a5 5 0 0 1 5-5zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
          </div>
          ${isActive?`<div style="margin-top:4px;background:linear-gradient(135deg,#0A2880,#1A4DC8);color:#fff;padding:4px 10px;border-radius:100px;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${adresseShort}</div>`:''}
        </div>`
      const icon = L.divIcon({ className: '', html: pinHtml, iconAnchor: [0, 0] })
      const marker = L.marker([dpe.latitude!, dpe.longitude!], {
        icon, zIndexOffset: isSelected ? 1000 : isHovered ? 900 : 0,
      }).addTo(mapInstanceRef.current).on('click', () => handleSelectDpe(dpe))
      markersRef.current.push(marker)
    })
  }, [dpesFiltres, selected, hoveredId, favoris, mapReady])

  useEffect(() => {
    if (selected && mapInstanceRef.current && selected.latitude && selected.longitude)
      mapInstanceRef.current.flyTo([selected.latitude, selected.longitude], 17, { duration: 0.8 })
  }, [selected])

  if (authLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', color: '#6B7280' }}>
      Chargement...
    </div>
  )

  function handleSelectDpe(dpe: DPE) {
    setSelected(dpe)
    if (isMobile) setDrawerOpen(true)
    setTimeout(() => {
      cardRefs.current[dpe.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function openDatePicker() {
    if (!dateBtnRef.current) return
    const rect = dateBtnRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 6, left: rect.left })
    setShowDatePicker(true)
  }

  function toggleClasse(c: string) {
    setFilterClasse(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function toggleDateSelection(date: string) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const activeFiltresCount = [
    filterClasse.length > 0, filterEtage, filterFavoris,
    isCustomMode ? selectedDates.size > 0 : filterDays !== null && filterDays !== 15
  ].filter(Boolean).length

  const DpeCard = ({ dpe }: { dpe: DPE }) => {
    const colors = dpe.classe_dpe ? DPE_COLORS[dpe.classe_dpe] : { bg: '#f3f4f6', text: '#6b7280' }
    const isSelected = selected?.id === dpe.id
    const isHovered  = hoveredId === dpe.id
    const isFav      = favoris.has(dpe.id)
    const isActive   = isSelected || isHovered
    return (
      <div
        ref={el => { cardRefs.current[dpe.id] = el }}
        onClick={() => handleSelectDpe(dpe)}
        onMouseEnter={() => !isMobile && setHoveredId(dpe.id)}
        onMouseLeave={() => !isMobile && setHoveredId(null)}
        style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 14, marginBottom: 7, cursor: 'pointer', background: isActive ? GRAD : isFav ? FAV_BG : '#fff', border: isActive ? '1.5px solid #0A2880' : isFav ? `1.5px solid ${FAV_BORDER}` : '1px solid #E8EAED', transition: 'all .2s', boxShadow: isActive ? '0 4px 18px rgba(10,40,128,0.25)' : 'none' }}>
        <div style={{ width: 42, height: 50, borderRadius: 10, flexShrink: 0, background: isActive ? 'rgba(255,255,255,0.15)' : colors.bg, color: isActive ? '#fff' : colors.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{dpe.classe_dpe || '?'}</span>
          <span style={{ fontSize: 9, opacity: 0.75 }}>DPE</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {dpe.date_etablissement && (
            <div style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.6)' : '#9CA3AF', marginBottom: 2 }}>
              {formatDateFR(dpe.date_etablissement)}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#fff' : '#111', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dpe.adresse}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {dpe.surface_habitable && (
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 100, background: isActive ? 'rgba(255,255,255,0.15)' : '#F5F3FF', color: isActive ? '#fff' : '#6D28D9', border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid #DDD6FE', flexShrink: 0 }}>
                {Math.round(dpe.surface_habitable)} m²
              </span>
            )}
            {dpe.etage && dpe.etage !== '0' && (
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 100, background: isActive ? 'rgba(255,255,255,0.15)' : '#EFF6FF', color: isActive ? '#fff' : '#1D4ED8', border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid #BFDBFE', flexShrink: 0 }}>
                Étage {dpe.etage}
              </span>
            )}
            {dpe.type_batiment && (
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 100, background: isActive ? 'rgba(255,255,255,0.15)' : '#F3F4F6', color: isActive ? '#fff' : '#6B7280', border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E5E7EB', flexShrink: 0 }}>
                {dpe.type_batiment.charAt(0).toUpperCase() + dpe.type_batiment.slice(1)}
              </span>
            )}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); toggleFavori(dpe.id) }}
          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: isActive ? 'rgba(255,255,255,0.15)' : isFav ? FAV_BG : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill={isFav ? (isActive ? '#fff' : FAV_COLOR) : 'none'} stroke={isFav ? (isActive ? '#fff' : FAV_COLOR) : isActive ? '#fff' : '#9CA3AF'} strokeWidth="1.5">
            <path d="M8 13S2 9 2 5.5A3.5 3.5 0 0 1 8 3a3.5 3.5 0 0 1 6 2.5C14 9 8 13 8 13z"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif', overflow: 'hidden' }}>

      {/* TOPBAR */}
      <div style={{ height: 56, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E8EAED', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#logo-grad)"/>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#0A2880"/>
                <stop offset="100%" stopColor="#1A4DC8"/>
              </linearGradient>
            </defs>
            <polyline points="4,18 9,18 11,12 14,22 17,10 20,20 23,18 28,18" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-jakarta), sans-serif', fontWeight: 800, fontSize: isMobile ? 18 : 22, color: '#0A2880', letterSpacing: -0.5 }}>immopulse</span>
        </div>

        {/* Desktop : boutons inline */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={logout} style={{ padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500, border: '1.5px solid #E8EAED', color: '#6B7280', background: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Déconnexion
            </button>
            <Link href="/prospection" style={{ padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500, border: '1.5px solid #E8EAED', color: '#6B7280', textDecoration: 'none' }}>Espace Prospection</Link>
          </div>
        )}

        {/* Mobile : menu hamburger */}
        {isMobile && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMobileMenu(!showMobileMenu)}
              style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E8EAED', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 1.5, background: '#6B7280', borderRadius: 2 }}/>
              <div style={{ width: 16, height: 1.5, background: '#6B7280', borderRadius: 2 }}/>
              <div style={{ width: 16, height: 1.5, background: '#6B7280', borderRadius: 2 }}/>
            </button>
            {showMobileMenu && (
              <div style={{ position: 'absolute', top: 44, right: 0, background: '#fff', border: '1px solid #E8EAED', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: 8, zIndex: 999999, minWidth: 180 }}>
                <Link href="/prospection" onClick={() => setShowMobileMenu(false)}
                  style={{ display: 'block', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#111', textDecoration: 'none', marginBottom: 4 }}>
                  Espace Prospection
                </Link>
                <button onClick={() => { setShowMobileMenu(false); logout() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTER BAR */}
      <div onClick={e => e.stopPropagation()} style={{ height: 54, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E8EAED', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', overflowX: 'auto', overflowY: 'hidden', zIndex: 490, WebkitOverflowScrolling: 'touch' as any }}>
        {['A','B','C','D','E','F','G'].map(c => {
          const colors = DPE_COLORS[c]; const active = filterClasse.includes(c)
          return (
            <button key={c} onClick={() => toggleClasse(c)} style={{ width: 34, height: 34, borderRadius: 10, cursor: 'pointer', border: 'none', background: active ? GRAD : colors.bg, color: active ? '#fff' : colors.text, fontSize: 13, fontWeight: 700, flexShrink: 0, transition: 'all .15s', outline: active ? 'none' : '1.5px solid #E8EAED' }}>{c}</button>
          )
        })}
        <div style={{ width: 1, height: 22, background: '#E8EAED', flexShrink: 0 }}/>
        <button onClick={() => setFilterEtage(!filterEtage)} style={{ padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 500, border: 'none', outline: filterEtage ? 'none' : '1.5px solid #E8EAED', background: filterEtage ? GRAD : '#fff', color: filterEtage ? '#fff' : '#6B7280', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          Étage
        </button>
        <button onClick={() => setFilterFavoris(!filterFavoris)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, border: filterFavoris ? `1.5px solid ${FAV_COLOR}` : '1.5px solid #E8EAED', background: filterFavoris ? FAV_BG : '#fff', color: filterFavoris ? FAV_COLOR : '#6B7280', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill={filterFavoris ? FAV_COLOR : 'none'} stroke={filterFavoris ? FAV_COLOR : '#9CA3AF'} strokeWidth="1.5"><path d="M8 13S2 9 2 5.5A3.5 3.5 0 0 1 8 3a3.5 3.5 0 0 1 6 2.5C14 9 8 13 8 13z"/></svg>
          Favoris {favoris.size > 0 && `(${favoris.size})`}
        </button>
        <button ref={dateBtnRef}
          onClick={e => { e.stopPropagation(); showDatePicker ? setShowDatePicker(false) : openDatePicker() }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 500, border: 'none', outline: (isCustomMode || (filterDays !== null && filterDays !== 15)) ? 'none' : '1.5px solid #E8EAED', background: (isCustomMode || (filterDays !== null && filterDays !== 15)) ? GRAD : '#fff', color: (isCustomMode || (filterDays !== null && filterDays !== 15)) ? '#fff' : '#6B7280', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 1v3M11 1v3M2 6h12" strokeLinecap="round"/></svg>
          {isCustomMode ? `Perso (${selectedDates.size})` : filterDays === 15 ? '15j' : filterDays !== null ? `${filterDays}j` : 'Tout'}
        </button>
        {activeFiltresCount > 0 && (
          <button onClick={() => { setFilterClasse([]); setFilterEtage(false); setFilterFavoris(false); setFilterDays(15); setSelectedDates(new Set()) }}
            style={{ padding: '7px 12px', borderRadius: 100, fontSize: 12, border: '1.5px solid #E8EAED', color: '#9CA3AF', background: '#fff', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
            ✕ ({activeFiltresCount})
          </button>
        )}
        <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto', flexShrink: 0, paddingRight: 4 }}>{dpesFiltres.length}</span>
      </div>

      {/* BODY */}
      {isMobile ? (
        /* ── MOBILE LAYOUT ── */
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Carte plein écran */}
          <div style={{ position: 'absolute', inset: 0, filter: 'grayscale(40%)' }}>
            <div ref={mapRef} style={{ position: 'absolute', inset: 0 }}/>
            {!mapReady && (
              <div style={{ position: 'absolute', inset: 0, background: '#C8D8EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 14 }}>
                Chargement de la carte...
              </div>
            )}
          </div>

          {/* Bouton ouvrir drawer */}
          {!drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: GRAD, color: '#fff', border: 'none', borderRadius: 100, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(10,40,128,0.4)', zIndex: 1000, fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10l5-5 5 5" strokeLinecap="round"/></svg>
              {dpesFiltres.length} DPE détectés
            </button>
          )}

          {/* Zoom controls */}
          {mapReady && (
            <div style={{ position: 'absolute', bottom: drawerOpen ? '45%' : 90, right: 16, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', border: '1px solid #E8EAED', overflow: 'hidden', zIndex: 1000, transition: 'bottom 0.3s' }}>
              <button onClick={() => mapInstanceRef.current?.zoomIn()} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: 'none', borderBottom: '1px solid #E8EAED', cursor: 'pointer', fontSize: 20, color: '#111', fontWeight: 300 }}>+</button>
              <button onClick={() => mapInstanceRef.current?.zoomOut()} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 20, color: '#111', fontWeight: 300 }}>−</button>
            </div>
          )}

          {/* Drawer bottom */}
          <div
            ref={drawerRef}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: drawerOpen ? '50%' : '0%',
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              transition: 'height 0.3s ease',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
            {/* Handle */}
            <div style={{ padding: '12px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer' }} onClick={() => setDrawerOpen(!drawerOpen)}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E8EAED' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 16px' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>DPE détectés</span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{dpesFiltres.length} résultats</span>
              </div>
            </div>
            {/* Liste */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
              {dpesFiltres.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Aucun DPE pour ces filtres</div>
              )}
              {dpesFiltres.map(dpe => <DpeCard key={dpe.id} dpe={dpe} />)}
            </div>
          </div>
        </div>
      ) : (
        /* ── DESKTOP LAYOUT ── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* DRAWER GAUCHE (mode personnalisé) */}
          {isCustomMode && (
            <div style={{ width: 280, flexShrink: 0, background: '#fff', borderRight: '1px solid #E8EAED', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 400, color: '#111', marginBottom: 3, fontFamily: 'DM Serif Display, serif' }}>Historique de diagnostics</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Cliquer pour sélectionner / désélectionner</div>
              </div>
              {selectedDates.size > 0 && (
                <div style={{ margin: '10px 10px 0', padding: '10px 12px', background: FAV_BG, borderRadius: 10, border: `1px solid ${FAV_BORDER}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: FAV_COLOR, marginBottom: 4 }}>SÉLECTION</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{selectedDates.size} date{selectedDates.size > 1 ? 's' : ''} sélectionnée{selectedDates.size > 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{dpesFiltres.length} DPE affichés</div>
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                {dateGroups.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 12 }}>Chargement...</div>}
                {dateGroups.map(({ date, count }) => {
                  const isActive = selectedDates.has(date)
                  return (
                    <div key={date} onClick={() => toggleDateSelection(date)}
                      style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', background: isActive ? GRAD : '#F7F8FA', border: isActive ? 'none' : '1px solid #E8EAED', transition: 'all .15s' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#fff' : '#111' }}>{formatDateFR(date)}</div>
                      <div style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.75)' : '#9CA3AF', marginTop: 2 }}>{count} DPE {isActive && '✓'}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '10px', flexShrink: 0, borderTop: '1px solid #F3F4F6' }}>
                <button onClick={() => { setFilterDays(null); setSelectedDates(new Set()) }}
                  style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1.5px solid #E8EAED', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  Tout afficher ({dpes.length} DPE)
                </button>
              </div>
            </div>
          )}

          {/* MAP */}
          <div style={{ flex: 1, position: 'relative', filter: 'grayscale(50%)' }}>
            <div ref={mapRef} style={{ position: 'absolute', inset: 0 }}/>
            {!mapReady && (
              <div style={{ position: 'absolute', inset: 0, background: '#C8D8EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 14 }}>
                Chargement de la carte...
              </div>
            )}
            {mapReady && (
              <div style={{ position: 'absolute', bottom: 24, right: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', border: '1px solid #E8EAED', overflow: 'hidden', zIndex: 1000 }}>
                <button onClick={() => mapInstanceRef.current?.zoomIn()}
                  style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: 'none', borderBottom: '1px solid #E8EAED', cursor: 'pointer', fontSize: 20, color: '#111', fontWeight: 300 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>+</button>
                <button onClick={() => mapInstanceRef.current?.zoomOut()}
                  style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 20, color: '#111', fontWeight: 300 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>−</button>
              </div>
            )}
          </div>

          {/* PANEL DROITE */}
          <div style={{ width: 370, flexShrink: 0, background: '#fff', borderLeft: '1px solid #E8EAED', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E8EAED', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>DPE détectés</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{dpesFiltres.length} résultats</span>
            </div>
            <div ref={panelRef} style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
              {dpesFiltres.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Aucun DPE pour ces filtres</div>
              )}
              {dpesFiltres.map(dpe => <DpeCard key={dpe.id} dpe={dpe} />)}
            </div>
          </div>
        </div>
      )}

      {/* DROPDOWN PÉRIODE */}
      {showDatePicker && typeof document !== 'undefined' && createPortal(
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, background: '#fff', border: '1px solid #E8EAED', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', padding: 6, zIndex: 99999, minWidth: 200 }}>
          {stdDateOptions.map(opt => {
            const isActive = opt.days === -1 ? isCustomMode : filterDays === opt.days && !isCustomMode
            return (
              <button key={opt.label}
                onClick={() => { setFilterDays(opt.days === -1 ? -1 : opt.days); if (opt.days !== -1) setSelectedDates(new Set()); setShowDatePicker(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: 'none', background: isActive ? FAV_BG : 'transparent', color: isActive ? FAV_COLOR : '#111', fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {isActive ? '✓ ' : ''}{opt.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
