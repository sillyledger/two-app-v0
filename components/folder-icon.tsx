export function FolderIcon({ color, size = 20 }: { color: string; size?: number }) {
  const rectWidth = size * (50 / 54)
  const rectHeight = size * (36 / 54)
  const backTop = size * (4 / 54)
  const frontTop = size * (11 / 54)
  return (
    <div style={{ position: "relative", height: size, width: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: backTop, width: rectWidth, height: rectHeight, borderRadius: "5px", backgroundColor: color, opacity: 0.35 }} />
      <div style={{ position: "absolute", left: 0, top: frontTop, width: rectWidth, height: rectHeight, borderRadius: "5px", backgroundColor: color }} />
    </div>
  )
}
