import { NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { renameWorkspaceById, deleteWorkspaceById } from "@/lib/workspaces"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("auth-token")?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
    const workspace = await renameWorkspaceById(payload.userId, id, name.trim())
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(workspace)
  } catch (error) {
    console.error("Workspace rename error:", error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("auth-token")?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    await deleteWorkspaceById(payload.userId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Workspace delete error:", error)
    return NextResponse.json(null, { status: 500 })
  }
}
