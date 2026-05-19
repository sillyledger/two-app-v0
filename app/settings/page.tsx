'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'

export default function SettingsPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setName(data.user.name || '')
          setEmail(data.user.email || '')
        } else {
          router.push('/login')
        }
        setLoading(false)
      })
      .catch(() => router.push('/login'))
  }, [])

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (newPassword && !currentPassword) {
      setMessage({ type: 'error', text: 'Please enter your current password.' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Something went wrong.' })
      } else {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[#141414]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-neutral-500">Loading...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#141414] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-10">
          <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

          {/* Profile Section */}
          <div className="bg-[#1e1e1e] rounded-2xl p-6 mb-4 border border-white/5">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#2a2a2a] text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#2a2a2a] text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="bg-[#1e1e1e] rounded-2xl p-6 mb-6 border border-white/5">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Change Password</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#2a2a2a] text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#2a2a2a] text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#2a2a2a] text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-white text-black rounded-xl font-medium text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  )
}
