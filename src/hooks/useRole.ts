import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type UserRole = 'admin' | 'sales'

export function useRole() {
  const [role, setRole] = useState<UserRole>('sales')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRole = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .single()

      setRole((data?.role as UserRole) || 'admin')
      setLoading(false)
    }

    void fetchRole()
  }, [])

  return { role, isAdmin: role === 'admin', loading }
}
