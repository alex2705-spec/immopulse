'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sigmap_favoris'

export function useFavoris() {
  const [favoris, setFavoris] = useState<Set<string>>(new Set())

  // Charger depuis localStorage au démarrage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setFavoris(new Set(JSON.parse(stored)))
      }
    } catch {}
  }, [])

  // Sauvegarder dans localStorage à chaque changement
  function toggleFavori(id: string) {
    setFavoris(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  return { favoris, toggleFavori }
}
