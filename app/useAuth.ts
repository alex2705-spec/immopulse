import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

export type UserAccess = {
  userId: string
  email: string
  codesPostaux: string[]
}

export function useAuth() {
  const router = useRouter()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Récupérer les codes postaux attribués
      const { data: rows } = await supabase
        .from('user_access')
        .select('code_postal')
        .eq('user_id', session.user.id)

      if (!rows || rows.length === 0) {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      setAccess({
        userId: session.user.id,
        email: session.user.email || '',
        codesPostaux: rows.map(r => r.code_postal),
      })
      setLoading(false)
    }

    check()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return { access, loading, logout }
}