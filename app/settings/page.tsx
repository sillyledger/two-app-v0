'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, Camera, User, Palette, FileText, Lock, X, CreditCard, Settings2 } from 'lucide-react'
import Sidebar from '@/components/sidebar'

type Section = 'account' | 'appearance' | 'preferences' | 'editor' | 'security' | 'billing'

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account',     label: 'Account',     icon: <User size={14} /> },
  { id: 'appearance',  label: 'Appearance',  icon: <Palette size={14} /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings2 size={14} /> },
  { id: 'editor',      label: 'Editor',      icon: <FileText size={14} /> },
  { id: 'security',    label: 'Security',    icon: <Lock size={14} /> },
  { id: 'billing',     label: 'Billing',     icon: <CreditCard size={14} /> },
]

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [fontSize, setFontSize] = useState(16)
  const [defaultWidth, setDefaultWidth] = useState<'narrow' | 'wide'>('narrow')
  const [timezone, setTimezone] = useState('UTC+8')
  const [dateFormat, setDateFormat] = useState('MMM D, YYYY')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed === 'true') setCollapsed(true)

    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') setTheme('light')

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
                    <p className={descClass} style={{ color: "var(--text-muted)" }}>Choose between dark and light mode</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { if (theme !== t) toggleTheme() }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-colors capitalize"
                        style={{
                          backgroundColor: theme === t ? "var(--bg-secondary)" : "transparent",
                          color: theme === t ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {t === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                        {t === 'dark' ? 'Dark' : 'Light'}
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

                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Plans</p>

                {/* Free plan */}
                <div
                  className="rounded-xl p-5 mb-3 flex items-center justify-between"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Free</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Current plan</span>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Personal use · Unlimited notes · 5MB storage</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>$0</span>
                    <span className="text-[12px] ml-1" style={{ color: "var(--text-muted)" }}>/mo</span>
                  </div>
                </div>

                {/* Team plan */}
                <div
                  className="rounded-xl p-5 flex items-center justify-between"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid #7C3AED40" }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Team</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7C3AED20] text-[#a78bfa]" style={{ border: "1px solid #7C3AED40" }}>Upgrade</span>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Shared workspaces · Priority support · Unlimited storage</p>
                  </div>
                  <div className="text-right">
                    <div>
                      <span className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>$12</span>
                      <span className="text-[12px] ml-1" style={{ color: "var(--text-muted)" }}>/mo</span>
                    </div>
                    <button
                      className="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors text-[#a78bfa]"
                      style={{ backgroundColor: "#7C3AED20", border: "1px solid #7C3AED40" }}
                    >
                      Upgrade
                    </button>
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
