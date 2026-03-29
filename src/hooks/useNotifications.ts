import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type Notification = {
  id: string
  user_id: string
  type: string
  message: string
  read: boolean
  link: string | null
  created_at: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    setNotifications((data ?? []) as Notification[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchNotifications()

    // Subscribe to new notifications via Supabase Realtime
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  const markAllRead = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userData.user.id)
      .eq('read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return { notifications, unreadCount, markRead, markAllRead, loading, refetch: fetchNotifications }
}

/** Helper to create a notification for the current user */
export async function createNotification(type: string, message: string, link?: string) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return
  await supabase.from('notifications').insert({
    user_id: userData.user.id,
    type,
    message,
    link: link ?? null,
  })
}
