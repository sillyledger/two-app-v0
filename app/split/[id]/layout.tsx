export default function SplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
