import { createClient } from "@liveblocks/client"
import { createRoomContext } from "@liveblocks/react"

export const client = createClient({
  authEndpoint: async (room) => {
    const response = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room }),
    })
    return response.json()
  },
})

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
} = createRoomContext(client)
