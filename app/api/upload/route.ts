import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 })
    }

    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`
    const endpoint = process.env.R2_ENDPOINT!
    const bucket = process.env.R2_BUCKET_NAME!
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!

    // Sign the request manually using AWS Signature V4
    const url = `${endpoint}/${bucket}/${filename}`
    const now = new Date()
    const dateStr = now.toISOString().replace(/[:-]|\\.\\d{3}/g, '').slice(0, 15) + 'Z'
    const dateShort = dateStr.slice(0, 8)

    const arrayBuffer = await file.arrayBuffer()

    // Hash the file body
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const host = new URL(endpoint).host
    const canonicalHeaders = `content-type:${file.type}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateStr}\n`
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = `PUT\n/${bucket}/${filename}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

    const region = 'auto'
    const service = 's3'
    const credentialScope = `${dateShort}/${region}/${service}/aws4_request`

    const encoder = new TextEncoder()
    const crHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))
    const crHashHex = Array.from(new Uint8Array(crHash)).map(b => b.toString(16).padStart(2, '0')).join('')
    const stringToSign = `AWS4-HMAC-SHA256\n${dateStr}\n${credentialScope}\n${crHashHex}`

    const sign = async (key: ArrayBuffer, msg: string) => {
      const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(msg))
    }

    const kDate = await sign(encoder.encode(`AWS4${secretAccessKey}`), dateShort)
    const kRegion = await sign(kDate, region)
    const kService = await sign(kRegion, service)
    const kSigning = await sign(kService, 'aws4_request')
    const sigBuffer = await sign(kSigning, stringToSign)
    const signature = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-amz-date': dateStr,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authHeader,
      },
      body: arrayBuffer,
    })

    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      return NextResponse.json({ error: 'Upload failed', detail: text }, { status: 500 })
    }

    // Track storage usage — add this file's size to the user's total
    await sql`
      UPDATE users
      SET storage_used = COALESCE(storage_used, 0) + ${file.size}
      WHERE id = ${payload.userId}
    `

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${filename}`
    return NextResponse.json({ url: publicUrl })

  } catch (error) {
    return NextResponse.json({ error: 'Upload failed', detail: String(error) }, { status: 500 })
  }
}
