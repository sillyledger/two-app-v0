import { createClient } from "@liveblocks/client"
import { createRoomContext } from "@liveblocks/react"

const client = createClient({
  authEndpoint: async (room) => {
    const response = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room }),
    })
    return response.json()
  },
})

type Presence = {}
type Storage = {
  content: string
}
type UserMeta = {
  info: {
    name: string
  }
}
type RoomEvent = {}

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client)
