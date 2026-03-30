'use client'

import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useFavoris() {
  const [favoris, setFavoris] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[useFavoris] session:', session?.user?.id)
      if (!session) return
      const uid = session.user.id
      setUserId(uid)

      const { data, error } = await supabase
        .from('favoris')
        .select('dpe_id')
        .eq('client_id', uid)

      console.log('[useFavoris] load:', data, error)
      if (data) setFavoris(new Set(data.map((r: any) => r.dpe_id)))
    }
    load()
  }, [])

  async function toggleFavori(id: string) {
    if (!userId) {
      console.log('[useFavoris] no userId!')
      return
    }

    const isFav = favoris.has(id)
    console.log('[useFavoris] toggle', id, 'isFav:', isFav, 'userId:', userId)

    setFavoris(prev => {
      const next = new Set(prev)
      if (isFav) next.delete(id)
      else next.add(id)
      return next
    })

    if (isFav) {
      const { error } = await supabase
        .from('favoris')
        .delete()
        .eq('client_id', userId)
        .eq('dpe_id', id)
      console.log('[useFavoris] delete error:', error)
    } else {
      const { data, error } = await supabase
        .from('favoris')
        .insert({ client_id: userId, dpe_id: id })
      console.log('[useFavoris] insert data:', data, 'error:', error)
    }
  }

  return { favoris, toggleFavori }
}
