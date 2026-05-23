import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await verifyToken(token)

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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`

    console.log('Uploading to R2:', filename)
    console.log('Bucket:', process.env.R2_BUCKET_NAME)
    console.log('Endpoint:', process.env.R2_ENDPOINT)

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: filename,
      Body: buffer,
      ContentType: file.type,
    }))

    const url = `${process.env.R2_PUBLIC_URL}/${filename}`
    console.log('Upload successful, URL:', url)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed', detail: String(error) }, { status: 500 })
  }
}
