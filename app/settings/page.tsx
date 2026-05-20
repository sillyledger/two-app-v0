'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, Camera, User, Palette, FileText, Lock, X, ChevronRight } from 'lucide-react'
import Sidebar from '@/components/sidebar'

type Section = 'account' | 'appearance' | 'editor' | 'security'

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account',    label: 'Account',    icon: <User size={14} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={14} /> },
  { id: 'editor',     label: 'Editor',     icon: <FileText size={14} /> },
  { id: 'security',   label: 'Security',   icon: <Lock size={14} /> },
]

export default function SettingsPage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>('account')
  const [collapsed, setCollapsed] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [fontSize, setFontSize] = useState<'small' | 'default' | 'large'>('default')
  const [defaultWidth, setDefaultWidth] = useState<'narrow' | 'wide'>('narrow')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') setTheme('light')
    const savedFont = localStorage.getItem('font-size') as 'small' | 'default' | 'large' | null
    if (savedFont) setFontSize(savedFont)
    const savedWidth = localStorage.getItem('doc-wide-mode')
    if (savedWidth === 'true') setDefaultWidth('wide')
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setName(data.user.name || '')
          setEmail(data.user.email || '')
          setAvatarUrl(data.user.avatar_url || null)
        } else {
          router.push('/login')
        }
        setLoading(false)
      })
      .catch(() => router.push('/login'))
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(next)
  }

  const handleFontSize = (size: 'small' | 'default' | 'large') => {
    setFontSize(size)
    localStorage.setItem('font-size', size)
    const root = document.documentElement
    if (size === 'small') root.style.fontSize = '13px'
    else if (size === 'large') root.style.fontSize = '17px'
    else root.style.fontSize = ''
  }

  const handleDefaultWidth = (w: 'narrow' | 'wide') => {
    setDefaultWidth(w)
    localStorage.setItem('doc-wide-mode', w === 'wide' ? 'true' : 'false')
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setMessage(null)
    try {
      const params = new URLSearchParams({ filename: file.name, contentType: file.type, size: String(file.size) })
      const res = await fetch(`/api/avatar?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const text = await res.text()
      const data = text ? (() => { try { return JSON.parse(text) } catch { return {} } })() : {}
      if (!res.ok) setMessage({ type: 'error', text: data.error || 'Upload failed.' })
      else { setAvatarUrl(data.url); setMessage({ type: 'success', text: 'Profile photo updated!' }) }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed. Please try again.' })
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' }); return
    }
    if (newPassword && !currentPassword) {
      setMessage({ type: 'error', text: 'Please enter your current password.' }); return
    }
    setSaving(true); setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
      })
      const data = await res.json()
      if (!res.ok) setMessage({ type: 'error', text: data.error || 'Something went wrong.' })
      else {
        setMessage({ type: 'success', text: 'Saved successfully!' })
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  const initial = name ? name.charAt(0).toUpperCase() : '?'

  if (loading) return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <main className="flex-1 flex items-center justify-center">
        <p className="text-[#555]">Loading...</p>
      </main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 flex items-center justify-center overflow-y-auto px-4">
        {/* Modal */}
        <div className="w-full max-w-[780px] min-h-[520px] bg-[#1e1e1e] border border-white/8 rounded-2xl shadow-2xl flex overflow-hidden my-8">

          {/* Left nav */}
          <div className="w-[200px] shrink-0 border-r border-white/5 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-5 px-1">
              <span className="text-[13px] font-semibold text-[#e8e8e8]">Settings</span>
              <button onClick={() => router.back()} className="text-[#444] hover:text-[#888] transition-colors">
                <X size={14} />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSection(item.id); setMessage(null) }}
                  className={`flex items-center gap-2.5 px-2.5 py-[6px] rounded-lg text-[13px] font-medium text-left transition-colors ${
                    section === item.id
                      ? 'bg-white/8 text-[#e8e8e8]'
                      : 'text-[#666] hover:bg-white/5 hover:text-[#aaa]'
                  }`}
                >
                  <span className={section === item.id ? 'text-[#aaa]' : 'text-[#444]'}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right content */}
          <div className="flex-1 p-8 overflow-y-auto">

            {/* MESSAGE */}
            {message && (
              <div className={`mb-5 px-4 py-2.5 rounded-lg text-[12px] ${
                message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            {/* ACCOUNT */}
            {section === 'account' && (
              <div>
                <h2 className="text-[15px] font-semibold text-[#e8e8e8] mb-1">Account</h2>
                <p className="text-[12px] text-[#555] mb-6">Manage your profile information.</p>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="group relative w-14 h-14 rounded-full overflow-hidden shrink-0"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#7C3AED] flex items-center justify-center">
                        <span className="text-lg font-bold text-white">{initial}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploadingAvatar
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Camera size={14} className="text-white" />
                      }
                    </div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  <div>
                    <p className="text-[13px] font-medium text-[#ccc]">Profile photo</p>
                    <p className="text-[11px] text-[#555] mt-0.5">Click to upload · Max 2MB</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#666] mb-1.5">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-2 rounded-lg border border-white/8 bg-[#252525] text-[#e8e8e8] text-[13px] placeholder-[#444] focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#666] mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 rounded-lg border border-white/8 bg-[#252525] text-[#e8e8e8] text-[13px] placeholder-[#444] focus:outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#e8e8e8] text-[#1a1a1a] rounded-lg text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {section === 'appearance' && (
              <div>
                <h2 className="text-[15px] font-semibold text-[#e8e8e8] mb-1">Appearance</h2>
                <p className="text-[12px] text-[#555] mb-6">Customize how TWO looks for you.</p>

                {/* Theme */}
                <div className="flex items-center justify-between py-4 border-b border-white/5">
                  <div>
                    <p className="text-[13px] font-medium text-[#ccc]">Interface theme</p>
                    <p className="text-[11px] text-[#555] mt-0.5">Choose between dark and light mode</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#252525] border border-white/8 text-[12px] text-[#aaa] hover:bg-[#2a2a2a] transition-colors"
                  >
                    {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                </div>

                {/* Font size */}
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-[13px] font-medium text-[#ccc]">Font size</p>
                    <p className="text-[11px] text-[#555] mt-0.5">Adjust text size across the app</p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#252525] border border-white/8 rounded-lg p-0.5">
                    {(['small', 'default', 'large'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleFontSize(s)}
                        className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors capitalize ${
                          fontSize === s ? 'bg-[#333] text-[#e8e8e8]' : 'text-[#555] hover:text-[#aaa]'
                        }`}
                      >
                        {s === 'default' ? 'Default' : s === 'small' ? 'Small' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* EDITOR */}
            {section === 'editor' && (
              <div>
                <h2 className="text-[15px] font-semibold text-[#e8e8e8] mb-1">Editor</h2>
                <p className="text-[12px] text-[#555] mb-6">Configure your default writing experience.</p>

                <div className="flex items-center justify-between py-4 border-b border-white/5">
                  <div>
                    <p className="text-[13px] font-medium text-[#ccc]">Default page width</p>
                    <p className="text-[11px] text-[#555] mt-0.5">Choose the default width for new docs</p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#252525] border border-white/8 rounded-lg p-0.5">
                    {(['narrow', 'wide'] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => handleDefaultWidth(w)}
                        className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors capitalize ${
                          defaultWidth === w ? 'bg-[#333] text-[#e8e8e8]' : 'text-[#555] hover:text-[#aaa]'
                        }`}
                      >
                        {w === 'narrow' ? 'Narrow' : 'Wide'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY */}
            {section === 'security' && (
              <div>
                <h2 className="text-[15px] font-semibold text-[#e8e8e8] mb-1">Security</h2>
                <p className="text-[12px] text-[#555] mb-6">Update your password.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#666] mb-1.5">Current password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg border border-white/8 bg-[#252525] text-[#e8e8e8] text-[13px] placeholder-[#444] focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#666] mb-1.5">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg border border-white/8 bg-[#252525] text-[#e8e8e8] text-[13px] placeholder-[#444] focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#666] mb-1.5">Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg border border-white/8 bg-[#252525] text-[#e8e8e8] text-[13px] placeholder-[#444] focus:outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#e8e8e8] text-[#1a1a1a] rounded-lg text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Update password'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
