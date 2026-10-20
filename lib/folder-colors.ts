export const ACCENT_COLORS = [
  "#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B",
  "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5",
]

export function getAccent(index: number) {
  return ACCENT_COLORS[Math.max(index, 0) % ACCENT_COLORS.length]
}

// Stable colour from an id (subfolder colours, member avatars).
export function hashColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

// A folder's stored colour, falling back to the sidebar rule
// (position in the full folder list) when it has none.
export function folderAccent(folder: { color?: unknown }, index: number): string {
  return typeof folder.color === "string" && folder.color ? folder.color : getAccent(index)
}
