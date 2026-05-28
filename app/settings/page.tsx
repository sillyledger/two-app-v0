'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, Monitor, Camera, User, Palette, FileText, Lock, X, CreditCard, Settings2, HardDrive } from 'lucide-react'
import Sidebar from '@/components/sidebar'

type Section = 'account' | 'appearance' | 'preferences' | 'editor' | 'security' | 'billing' | 'storage'
type Theme = 'dark' | 'light' | 'system'

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account',     label: 'Account',     icon: <User size={14} /> },
  { id: 'appearance',  label: 'Appearance',  icon: <Palette size={14} /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings2 size={14} /> },
  { id: 'editor',      label: 'Editor',      icon: <FileText size={14} /> },
  { id: 'security',    label: 'Security',    icon: <Lock size={14} /> },
  { id: 'billing',     label: 'Billing',     icon: <CreditCard size={14} /> },
  { id: 'storage',     label: 'Storage',     icon: <HardDrive size={14} /> },
]

function applyTheme(t: Theme) {
  if (t === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(t)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function SettingsPage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>('account')
  const [collapsed, setCollapsed] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')
  const [fontSize, setFontSize] = useState(16)
  const [defaultWidth, setDefaultWidth] = useState<'narrow' | 'wide'>('narrow')
  const [timezone, setTimezone] = useState('UTC+8')
  const [dateFormat, setDateFormat] = useState('MMM D, YYYY')
  const [plan, setPlan] = useState<string>('free')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [storageUsed, setStorageUsed] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed === 'true') setCollapsed(true)

    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      setTheme(savedTheme)
    }

    const savedFont = localStorage.getItem('font-size-px')
    if (savedFont) setFontSize(Number(savedFont))
    else setFontSize(16)

    const savedWidth = localStorage.getItem('doc-wide-mode')
    if (savedWidth === 'true') setDefaultWidth('wide')

    const savedTz = localStorage.getItem('timezone')
    if (savedTz) setTimezone(savedTz)

    const savedDf = localStorage.getItem('date-format')
    if (savedDf) setDateFormat(savedDf)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setName(data.user.name || '')
          setEmail(data.user.email || '')
          setAvatarUrl(data.user.avatar_url || null)
          setPlan(data.user.plan || 'free')
          setTrialEndsAt(data.user.trial_ends_at || null)
          setStorageUsed(data.user.storage_used || 0)
        } else {
          router.push('/login')
        }
        setLoading(false)
      })
      .catch(() => router.push('/login'))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const Paddle = (window as any).Paddle
      if (Paddle) {
        Paddle.Environment.set('production')
        Paddle.Initialize({ token: 'live_5d79c55970d6730fce490b94bc1' })
        clearInterval(interval)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [])

  const handleTheme = (t: Theme) => {
    setTheme(t)
    localStorage.setItem('theme', t)
    applyTheme(t)
    if (t === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.remove('dark', 'light')
        document.documentElement.classList.add(e.matches ? 'dark' : 'light')
      }
      mq.addEventListener('change', handler)
    }
  }

  const handleFontSizeChange = (delta: number) => {
    const next = Math.min(22, Math.max(12, fontSize + delta))
    setFontSize(next)
    localStorage.setItem('font-size-px', String(next))
    document.documentElement.style.setProperty('--editor-font-size', `${next}px`)
  }

  const handleDefaultWidth = (w: 'narrow' | 'wide') => {
    setDefaultWidth(w)
    localStorage.setItem('doc-wide-mode', w === 'wide' ? 'true' : 'false')
  }

  const handleTimezone = (tz: string) => {
    setTimezone(tz)
    localStorage.setItem('timezone', tz)
  }

  const handleDateFormat = (df: string) => {
    setDateFormat(df)
    localStorage.setItem('date-format', df)
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
        body: JSON.stringify({ name, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
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

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return
    setSavingEmail(true); setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })
      const data = await res.json()
      if (!res.ok) setMessage({ type: 'error', text: data.error || 'Something went wrong.' })
      else {
        setEmail(newEmail)
        setNewEmail('')
        setMessage({ type: 'success', text: 'Email updated successfully!' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setSavingEmail(false)
    }
  }

  const initial = name ? name.charAt(0).toUpperCase() : '?'

  const inputClass = "w-full px-3 py-2 rounded-lg text-[13px] placeholder-[#555] focus:outline-none"
  const rowClass = "flex items-center justify-between py-4 border-b"
  const labelClass = "text-[13px] font-medium"
  const descClass = "text-[11px] mt-0.5"

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'dark',   label: 'Dark',   icon: <Moon size={12} /> },
    { value: 'light',  label: 'Light',  icon: <Sun size={12} /> },
    { value: 'system', label: 'System', icon: <Monitor size={12} /> },
  ]

  // Storage limits by plan (in bytes)
  const storageLimit = plan === 'free' ? 1 * 1024 * 1024 * 1024 : 10 * 1024 * 1024 * 1024 // 1GB or 10GB
  const storagePercent = Math.min(100, (storageUsed / storageLimit) * 100)
  const storageBarColor = storagePercent > 90 ? '#ef4444' : storagePercent > 70 ? '#f59e0b' : '#534AB7'

  if (loading) return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <main className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </main>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 flex items-center justify-center overflow-y-auto px-4">
        <div
          className="w-full max-w-[820px] min-h-[560px] rounded-2xl shadow-2xl flex overflow-hidden my-8"
          style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          {/* Left nav */}
          <div className="w-[200px] shrink-0 flex flex-col p-4" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5 px-1">
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Settings</span>
              <button onClick={() => router.back()} style={{ color: "var(--text-muted)" }} className="hover:text-[var(--text-primary)] transition-colors">
                <X size={14} />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSection(item.id); setMessage(null) }}
                  className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-lg text-[13px] font-medium text-left transition-colors"
                  style={{
                    backgroundColor: section === item.id ? "var(--bg-tertiary)" : "transparent",
                    color: section === item.id ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                  onMouseEnter={e => {
                    if (section !== item.id) {
                      e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                      e.currentTarget.style.color = "var(--text-secondary)"
                    }
                  }}
                  onMouseLeave={e => {
                    if (section !== item.id) {
                      e.currentTarget.style.backgroundColor = "transparent"
                      e.currentTarget.style.color = "var(--text-muted)"
                    }
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right content */}
          <div className="flex-1 p-8 overflow-y-auto">

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
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Account</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Manage your profile information.</p>

                <div className="flex items-center gap-4 mb-6 pb-6" style={{ borderBottom: "1px solid var(--border)" }}>
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
                    <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Profile photo</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Click to upload · Max 2MB</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Display name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)" }}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {section === 'appearance' && (
              <div>
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Appearance</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Customize how TWO looks for you.</p>

                <div className={rowClass} style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className={labelClass} style={{ color: "var(--text-secondary)" }}>Interface theme</p>
                    <p className={descClass} style={{ color: "var(--text-muted)" }}>Dark, light, or follow your system setting</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                    {themeOptions.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => handleTheme(t.value)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
                        style={{
                          backgroundColor: theme === t.value ? "var(--bg-secondary)" : "transparent",
                          color: theme === t.value ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className={labelClass} style={{ color: "var(--text-secondary)" }}>Font size</p>
                    <p className={descClass} style={{ color: "var(--text-muted)" }}>Adjust editor text size</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFontSizeChange(-1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[16px] transition-colors"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >−</button>
                    <span className="text-[13px] w-10 text-center" style={{ color: "var(--text-primary)" }}>{fontSize}px</span>
                    <button
                      onClick={() => handleFontSizeChange(1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[16px] transition-colors"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >+</button>
                  </div>
                </div>
              </div>
            )}

            {/* PREFERENCES */}
            {section === 'preferences' && (
              <div>
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Preferences</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Regional and display settings.</p>

                <div className={rowClass} style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className={labelClass} style={{ color: "var(--text-secondary)" }}>Time zone</p>
                    <p className={descClass} style={{ color: "var(--text-muted)" }}>Used for timestamps in the app</p>
                  </div>
                  <select
                    value={timezone}
                    onChange={(e) => handleTimezone(e.target.value)}
                    className="px-3 py-2 rounded-lg text-[12px] outline-none"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="UTC-12">UTC−12</option>
                    <option value="UTC-8">UTC−8 — Los Angeles</option>
                    <option value="UTC-5">UTC−5 — New York</option>
                    <option value="UTC+0">UTC+0 — London</option>
                    <option value="UTC+1">UTC+1 — Amsterdam</option>
                    <option value="UTC+2">UTC+2 — Johannesburg</option>
                    <option value="UTC+3">UTC+3 — Dubai</option>
                    <option value="UTC+5:30">UTC+5:30 — Mumbai</option>
                    <option value="UTC+8">UTC+8 — Taipei / Singapore</option>
                    <option value="UTC+9">UTC+9 — Tokyo</option>
                    <option value="UTC+10">UTC+10 — Sydney</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className={labelClass} style={{ color: "var(--text-secondary)" }}>Date format</p>
                    <p className={descClass} style={{ color: "var(--text-muted)" }}>How dates are displayed across the app</p>
                  </div>
                  <select
                    value={dateFormat}
                    onChange={(e) => handleDateFormat(e.target.value)}
                    className="px-3 py-2 rounded-lg text-[12px] outline-none"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="MMM D, YYYY">May 21, 2026</option>
                    <option value="DD/MM/YYYY">21/05/2026</option>
                    <option value="MM/DD/YYYY">05/21/2026</option>
                    <option value="YYYY-MM-DD">2026-05-21</option>
                  </select>
                </div>
              </div>
            )}

            {/* EDITOR */}
            {section === 'editor' && (
              <div>
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Editor</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Configure your default writing experience.</p>

                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className={labelClass} style={{ color: "var(--text-secondary)" }}>Default page width</p>
                    <p className={descClass} style={{ color: "var(--text-muted)" }}>Applied to all new docs</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                    {(['narrow', 'wide'] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => handleDefaultWidth(w)}
                        className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors capitalize"
                        style={{
                          backgroundColor: defaultWidth === w ? "var(--bg-secondary)" : "transparent",
                          color: defaultWidth === w ? "var(--text-primary)" : "var(--text-muted)",
                        }}
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
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Security</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Manage your password and email address.</p>

                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Password</p>
                <div className="space-y-3 mb-4">
                  {[
                    { label: 'Current password', value: currentPassword, setter: setCurrentPassword },
                    { label: 'New password', value: newPassword, setter: setNewPassword },
                    { label: 'Confirm new password', value: confirmPassword, setter: setConfirmPassword },
                  ].map(({ label, value, setter }) => (
                    <div key={label}>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
                      <input
                        type="password"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass}
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mb-8">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)" }}
                  >
                    {saving ? 'Saving...' : 'Update password'}
                  </button>
                </div>

                <div className="pt-6" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Email address</p>
                  <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
                    Current: <span style={{ color: "var(--text-secondary)" }}>{email}</span>
                  </p>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@email.com"
                    className={inputClass}
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleUpdateEmail}
                      disabled={savingEmail}
                      className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                      style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)" }}
                    >
                      {savingEmail ? 'Saving...' : 'Update email'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING */}
            {section === 'billing' && (
              <div>
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Billing</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Manage your plan.</p>

                {plan === 'pro' && trialEndsAt && (
                  <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ backgroundColor: "rgba(83,74,183,0.1)", border: "1px solid rgba(83,74,183,0.3)" }}>
                    <span style={{ fontSize: '18px' }}>✦</span>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "#a78bfa" }}>Pro trial active</p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Your trial ends on {new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Add a payment method to keep Pro.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const Paddle = (window as any).Paddle
                        Paddle?.Checkout.open({ items: [{ priceId: 'pri_01ksjx3b0n6pg6fw44hbq9r03p', quantity: 1 }], settings: { successUrl: 'https://app.two.so/welcome' } })
                      }}
                      className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-medium shrink-0"
                      style={{ backgroundColor: "#534AB7", color: "#fff", border: "none", cursor: "pointer" }}
                    >
                      Add card
                    </button>
                  </div>
                )}

                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Plans</p>

                <div className="rounded-xl p-5 mb-3 flex items-center justify-between" style={{ backgroundColor: "var(--bg-tertiary)", border: `1px solid ${plan === 'free' ? 'var(--text-muted)' : 'var(--border)'}` }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Free</span>
                      {plan === 'free' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Current plan</span>
                      )}
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>30 docs · 1 private workspace · 1GB storage</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>$0</span>
                    <span className="text-[12px] ml-1" style={{ color: "var(--text-muted)" }}>/mo</span>
                  </div>
                </div>

                <div className="rounded-xl p-5 mb-3 flex items-center justify-between" style={{ backgroundColor: "var(--bg-secondary)", border: `1px solid ${plan === 'pro' ? '#534AB7' : '#534AB740'}` }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Pro</span>
                      {plan === 'pro' ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#534AB720", color: "#a78bfa", border: "1px solid #534AB740" }}>
                          {trialEndsAt ? 'Trial active' : 'Current plan'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#534AB720", color: "#a78bfa", border: "1px solid #534AB740" }}>Upgrade</span>
                      )}
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Unlimited docs · Unlimited workspaces · 10GB storage · Priority support</p>
                  </div>
                  <div className="text-right">
                    <div>
                      <span className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>$6</span>
                      <span className="text-[12px] ml-1" style={{ color: "var(--text-muted)" }}>/mo</span>
                    </div>
                    {plan !== 'pro' && (
                      <button
                        onClick={() => {
  const Paddle = (window as any).Paddle
  Paddle?.Checkout.open({ items: [{ priceId: 'pri_01ksjx3b0n6pg6fw44hbq9r03p', quantity: 1 }], settings: { successUrl: 'https://app.two.so/welcome' } })
}}
                        className="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                        style={{ backgroundColor: "#534AB7", color: "#fff", border: "none", cursor: "pointer" }}
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl p-5 flex items-center justify-between" style={{ backgroundColor: "var(--bg-secondary)", border: `1px solid ${plan === 'founding' ? '#BA7517' : '#BA751740'}` }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Founding Member</span>
                      {plan === 'founding' ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#BA751720", color: "#f59e0b", border: "1px solid #BA751740" }}>Current plan</span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#BA751720", color: "#f59e0b", border: "1px solid #BA751740" }}>500 slots</span>
                      )}
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Everything in Pro · Lifetime access · No subscription ever</p>
                  </div>
                  <div className="text-right">
                    <div>
                      <span className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>$49</span>
                      <span className="text-[12px] ml-1" style={{ color: "var(--text-muted)" }}>one-time</span>
                    </div>
                    {plan !== 'founding' && (
                      <button
                        onClick={() => {
                          const Paddle = (window as any).Paddle
                          Paddle?.Checkout.open({ items: [{ priceId: 'pri_01ksjx6e6xtrmq324ama45zyr0', quantity: 1 }], settings: { successUrl: 'https://app.two.so/welcome' } })
                        }}
                        className="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                        style={{ backgroundColor: "#BA7517", color: "#fff", border: "none", cursor: "pointer" }}
                      >
                        Get lifetime
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STORAGE */}
            {section === 'storage' && (
              <div>
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Storage</h2>
                <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>Track your image and file storage usage.</p>

                {/* Usage card */}
                <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Storage used</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Images uploaded to your docs</p>
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {formatBytes(storageUsed)} <span style={{ color: "var(--text-muted)" }}>/ {plan === 'free' ? '1 GB' : '10 GB'}</span>
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${storagePercent}%`, backgroundColor: storageBarColor }}
                    />
                  </div>

                  <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                    {storagePercent < 1 ? 'Less than 1%' : `${storagePercent.toFixed(1)}%`} used
                  </p>
                </div>

                {/* Plan context */}
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        {plan === 'free' ? 'Free plan · 1 GB storage' : plan === 'pro' ? 'Pro plan · 10 GB storage' : 'Founding Member · 10 GB storage'}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {plan === 'free' ? 'Upgrade to Pro for 10x more storage.' : 'You have plenty of storage available.'}
                      </p>
                    </div>
                    {plan === 'free' && (
                      <button
                        onClick={() => setSection('billing')}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium shrink-0 ml-4"
                        style={{ backgroundColor: "#534AB7", color: "#fff" }}
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
