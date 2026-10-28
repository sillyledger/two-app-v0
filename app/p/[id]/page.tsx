import type { Metadata } from 'next'
import { getPublicDoc } from '@/lib/public-doc'
import { PublicDocContent, UpdatedDate } from './public-doc-content'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const doc = await getPublicDoc(id)
  return {
    title: doc ? `${doc.title.trim() || 'Untitled'} · TWO` : 'TWO',
    robots: { index: false },
  }
}

function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-4 sm:px-[28px]">
      <a href="https://two.so" className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 180 180" aria-hidden="true" style={{ fill: 'var(--text-1)' }}>
          <rect x="20" y="14" width="87" height="114" rx="21" opacity="0.55" />
          <rect x="57" y="42" width="87" height="114" rx="21" opacity="0.85" />
        </svg>
        <span className="text-[14px] font-semibold text-[var(--text-1)]">TWO</span>
      </a>
      <a
        href="https://two.so"
        className="rounded-[7px] border border-[var(--border-subtle)] px-[11px] py-[6px] text-[12px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
      >
        Try TWO free
      </a>
    </header>
  )
}

export default async function PublicDocPage({ params }: Props) {
  const { id } = await params
  const doc = await getPublicDoc(id)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--panel)' }}>
      <TopBar />

      {doc ? (
        <main className="mx-auto w-full max-w-[800px] px-[22px] pt-10 pb-16 sm:px-16 sm:pt-[72px]">
          <h1 className="mb-3 break-words text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground">
            {doc.title.trim() || 'Untitled'}
          </h1>
          {doc.updated_at && (
            <p className="mb-9 text-[13px] text-[var(--text-3)]">
              <UpdatedDate value={doc.updated_at} />
            </p>
          )}

          {/* The editor's 60vh minimum is for writing; a short shared doc
              shouldn't push the footer off screen */}
          <div className="[&_.editor-content]:min-h-0">
            <PublicDocContent content={doc.content} />
          </div>

          <footer className="mt-16 border-t border-[var(--border-subtle)] pt-4 text-right">
            <a href="https://two.so" className="text-[12px] text-[var(--text-2)]">
              Written in TWO. Two docs, one screen.
            </a>
          </footer>
        </main>
      ) : (
        <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[22px] text-center">
          <p className="text-[var(--text-2)]">This doc isn&apos;t shared, or it doesn&apos;t exist.</p>
        </main>
      )}
    </div>
  )
}
