import { createClient } from "@liveblocks/client"
import { createRoomContext } from "@liveblocks/react"
import { LiveObject } from "@liveblocks/client"

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
})

type Presence = {
  name: string
  color: string
}

type Storage = {
  content: LiveObject<{ html: string }>
}

export const {
  RoomProvider,
  useOthers,
  useSelf,
  useRoom,
  useStorage,
  useMutation,
  useIsStorageLoading,
} = createRoomContext<Presence, Storage>(client)
