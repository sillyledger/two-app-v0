import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is not set')
}

const secret = new TextEncoder().encode(process.env.AUTH_SECRET)

export async function createToken(userId: string, email: string) {
  return await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return payload as { userId: string; email: string }
  } catch {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return await verifyToken(token)
}
