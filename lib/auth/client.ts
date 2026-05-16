'use client'

import { createAuthClient } from '@neondatabase/auth/next'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

export const authClient = createAuthClient({
  adapter: BetterAuthReactAdapter(),
})

export const { useSession, signIn, signUp, signOut } = authClient
