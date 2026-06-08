"use client"
import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    const initial = saved === "light" ? "light" : "dark"
    setTheme(initial)
    // Do NOT touch html classes here — layout.tsx script already applied
    // the correct theme before paint. Overwriting it here causes the flicker.
  }, [])

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("theme", next)
    const html = document.documentElement
    html.classList.remove("dark", "light")
    html.classList.add(next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm transition-colors text-white/50 hover:bg-white/5 hover:text-white/80"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  )
}
