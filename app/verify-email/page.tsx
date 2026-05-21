'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || 'your inbox'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f0ef]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold">Check your email</h1>
        <p className="mb-6 text-sm text-gray-500">
          We sent a verification link to <span className="font-medium text-black">{email}</span>. Click the link to activate your account.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Didn't get it? Check your spam folder. The link expires in 24 hours.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-black underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
