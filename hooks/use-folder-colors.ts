import * as React from 'react'
import { folderAccent } from '@/lib/folder-colors'

// Colour lookup for places that only know a folder id (e.g. doc rows).
export function useFolderColors() {
  const [colors, setColors] = React.useState<Map<string, string>>(new Map())

  React.useEffect(() => {
    fetch('/api/folders?colors=true')
      .then(r => r.json())
      .then((data: { id: string; color?: string | null }[]) => {
        if (!Array.isArray(data)) return
        setColors(new Map(data.map((f, i) => [String(f.id), folderAccent(f, i)])))
      })
      .catch(() => {})
  }, [])

  return React.useCallback((folderId: string | null | undefined) => (folderId ? colors.get(String(folderId)) ?? null : null), [colors])
}
