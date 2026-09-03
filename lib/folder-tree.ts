export interface FolderTreeItem {
  id: string
  name: string
  parent_id?: string | null
  [key: string]: unknown
}

export function sortFoldersForMoveModal<T extends FolderTreeItem>(
  folders: T[]
): (T & { depth: number })[] {
  const byParent = new Map<string | null, T[]>()
  for (const folder of folders) {
    const key = folder.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(folder)
  }

  const result: (T & { depth: number })[] = []
  const visited = new Set<string>()

  const visit = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) || []
    for (const folder of children) {
      result.push({ ...folder, depth })
      visited.add(folder.id)
      visit(folder.id, depth + 1)
    }
  }

  visit(null, 0)

  // Orphans: parent not in the fetched set, render at top level rather
  // than silently dropping them
  for (const folder of folders) {
    if (!visited.has(folder.id)) result.push({ ...folder, depth: 0 })
  }

  return result
}
