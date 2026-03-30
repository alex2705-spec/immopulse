'use client'

import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useFavoris() {
  const [favoris, setFavoris] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  // Charger l'userId et les favoris depuis Supabase
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      setUserId(uid)

      const { data } = await supabase
        .from('favoris')
        .select('dpe_id')
        .eq('client_id', uid)

      if (data) setFavoris(new Set(data.map((r: any) => r.dpe_id)))
    }
    load()
  }, [])

  async function toggleFavori(id: string) {
    if (!userId) return

    setFavoris(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

    const isFav = favoris.has(id)
    if (isFav) {
      await supabase
        .from('favoris')
        .delete()
        .eq('client_id', userId)
        .eq('dpe_id', id)
    } else {
      await supabase
        .from('favoris')
        .insert({ client_id: userId, dpe_id: id })
    }
  }

  return { favoris, toggleFavori }
}
