import { createClient } from "@liveblocks/client"
import { createRoomContext } from "@liveblocks/react"

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
})

type Presence = {
  name: string
  color: string
}

export const {
  RoomProvider,
  useOthers,
  useSelf,
  useRoom,
} = createRoomContext<Presence>(client)
