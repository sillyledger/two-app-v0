# Shared Workspaces Audit

Full sanity pass over the shared-workspace surface (move-to-folder, workspace homepage,
`is_shared`, and the role hierarchy / member management built most recently). Investigation
only — nothing in this report has been fixed. Findings are grouped by the request's five
points, each tagged **BUG**, **GAP** (missing feature/check, not necessarily wrong on
purpose), **OPEN QUESTION** (needs a product decision), or **CONFIRMED CORRECT**.

---

## 1. Build health

**Type checking is silently skipped on every build.** [next.config.mjs](next.config.mjs):

```js
typescript: {
  ignoreBuildErrors: true,
},
```

This is why the Vercel log shows "Skipping validation of types" — `next build` runs but
never fails on a TS error, so type errors accumulate invisibly. `package.json`'s `build`
script is plain `next build` with no separate `tsc` step, and `vercel.json` has no build
command override, so nothing else in the pipeline catches this either. ESLint is not
disabled in `next.config.mjs` (no `eslint.ignoreDuringBuilds`), so lint errors, unlike type
errors, would still fail the build — worth confirming that's still true if ESLint config
changes.

**`npx tsc --noEmit` output** (every error, file:line, none fixed):

None of these are in the shared-workspace surface touched this session — all pre-existing.

- `.next/dev/types/validator.ts:288` / `.next/types/validator.ts:297` — TS2344, generated
  route-type-checker file complaining that `app/api/[id]/route.ts`'s `PUT` signature doesn't
  match the expected `{ params: Promise<...> }` shape (uses the old sync `params` shape).
- `.next/dev/types/validator.ts:683` — TS2307, can't find module `../../../app/auth/route.js`
  (a generated reference to a route that doesn't exist under `app/auth/route.ts`).
- `app/api/upload/route.ts:65` — TS2345, `Uint8Array<ArrayBufferLike>` not assignable to
  `ArrayBuffer`.
- `app/docs/[id]/page.tsx:258,262,263,278,279,282,283(x2),314` — TS2339/TS2322, the local
  `Doc` type is missing `error`, `is_public`, `priority`, `folder_name`, `folder_path`
  fields that the code reads off API responses, plus a `number`/`string` mismatch at 283.
- `app/docs/[id]/page.tsx:648` — TS2322, two structurally-different `Folder` types (one
  with a string index signature, one without) are being treated as the same type.
- `app/mac/docs/[id]/page.tsx:35`, `app/split/[id]/page.tsx:35` — same `Doc.error` issue as
  above, duplicated in the mac/split doc views.
- `components/editor.tsx:194` — TS2353, `inclusive` isn't a real `LinkOptions` property.
- `components/editor.tsx:641` — TS2339, `Node.TEXT_NODE` typed as missing.
- `components/editor.tsx:840` — TS2559, `false` passed where `SetContentOptions` expected.
- `components/note-card.tsx:6`, `components/note-modal.tsx:6` — TS2305, both import a
  `Note` type from `@/lib/db` that isn't exported there.

None of these touch `lib/workspaces.ts`, the folders/docs/members routes, or
`app/settings/page.tsx` — the role-hierarchy work introduced no new type errors. But since
`ignoreBuildErrors` is on, any future regression in those files also won't be caught by CI
in its current form.

---

## 2. Permission consistency across folders/docs

### 2a. Direct `user_id` ownership checks — inventory

| Location | Verdict |
|---|---|
| `lib/workspaces.ts:52,61` (`renameWorkspaceById`, `deleteWorkspaceById`) | **Correct by design** — workspace rename/delete is owner-only, unrelated to folder/doc roles. |
| `lib/workspaces.ts:122` (`isWorkspaceOwner`) | **Correct by design** — this *is* the owner check. |
| `app/api/folders/route.ts:237` (bare `DELETE`, body-based) | Explicitly out of scope per this session's instructions (unused, no frontend caller) — left as-is intentionally, not a new finding. |
| `app/api/docs/route.ts:26,72` (`GET`, no `folder_id`/`workspace_id`, and the default branch) | **Correct by design** — "my own docs" listings. |
| `app/api/docs/[id]/route.ts:229` (`PATCH`, `is_public` toggle) | **Likely a gap, not flagged by the original spec** — see 2c below. |
| `app/api/docs/[id]/route.ts:258-261` (`DELETE`) | Allows doc creator OR workspace owner only — **not** admin/editor. See 2c. |
| `app/api/docs/[id]/route.ts:117` (`PUT`, target-folder lookup for move) | **BUG** — see section 4, this is the one the task specifically asked about. |
| `app/api/docs/route.ts:26` (`GET ?folder_id=`) | **BUG** — see 2b. |
| `app/api/folders/route.ts` `GET` (all non-`all&&workspaceId` branches) | **BUG, largest finding of this audit** — see 2b. |

### 2b. `GET /api/folders` and `GET /api/docs?folder_id=` are still creator-scoped — folders and docs created by teammates are invisible in a shared workspace

This is pre-existing (the role-hierarchy session explicitly left `GET` untouched in both
files), but it undermines the whole premise of "shared" workspaces and is very much still
live. [app/api/folders/route.ts](app/api/folders/route.ts) has five query branches; only one
(`all && workspaceId`, lines 24-50) is correctly scoped to the whole workspace regardless of
creator. Every other branch filters on `folders.user_id = payload.userId` **in addition to**
`workspace_id`/`parent_id`:

- `all` only, no `workspace_id` (lines 51-76) — used by every "move to folder" picker
  (`?all=true`, no workspace scoping at all): `app/page.tsx:211`, `app/docs/page.tsx:172`,
  `app/workspaces/[id]/page.tsx:240`, `app/folders/[id]/page.tsx:192`,
  `components/doc-topbar.tsx:430`. None of these ever list a folder created by a teammate.
- `workspaceId && parentId` (lines 77-104) and `workspaceId` alone, `parent_id IS NULL`
  (lines 105-132) — used by `components/sidebar.tsx:340` (workspace folder tree),
  `app/workspaces/[id]/page.tsx:140` (workspace homepage top-level folders), and
  `app/library/page.tsx:136` (shared-workspace section). All three only show folders the
  *viewer* personally created inside the shared workspace.
- `parentId` alone, no `workspace_id` (lines 133-159) — used by
  `app/folders/[id]/page.tsx:145` for subfolders. Note this call doesn't even pass
  `workspace_id`, so it can't hit the correct branch even if that branch were fixed to not
  require ownership.

Practical effect: open a shared workspace's home page, its sidebar tree, the Library page's
shared section, or drill into one of its folders — in every one of those views, folders
created by other members simply don't appear, regardless of the viewer's role (owner, admin,
editor, viewer — none of it matters, since the ownership filter runs before any role logic).
The one correctly-scoped query branch (`all && workspaceId`) appears to have **no caller
anywhere in the frontend** — grepped every `/api/folders?` call site, none combine `all=true`
with `workspace_id=`.

Compounding this, [app/api/docs/route.ts:18-31](app/api/docs/route.ts#L18) (`GET
?folder_id=`, used by `app/folders/[id]/page.tsx:137`) filters
`docs.user_id = payload.userId AND docs.folder_id = ${folderId}` — same bug for docs. This
one is inconsistent with its own neighbor: `GET ?workspace_id=` on the very same file (lines
34-61) *correctly* returns every doc in the workspace regardless of creator. So on
`app/folders/[id]/page.tsx`, the folder's `doc_count` badge (from the now role-gated,
correctly-scoped `GET /api/folders/[id]`) reflects the true total across all members, while
the doc list actually rendered below it (from the buggy `folder_id`-filtered endpoint) shows
only the viewer's own docs — a visible count/list mismatch for any populated shared folder.

`app/folders/page.tsx:225` (`fetch("/api/folders")`, no params) is the one caller that's
correctly matched to its intent — that page is the personal "My folders" view, so creator
scoping there is by design, not a bug.

### 2c. Doc-level actions not covered by the role rules as specified

Two behaviors that weren't in the confirmed role rules, worth a decision:

- `PATCH /api/docs/[id]` (`is_public` toggle, line 229) is creator-only, even in a shared
  workspace — an admin can edit a teammate's doc's content but can't toggle its public-link
  sharing.
- `DELETE /api/docs/[id]` (lines 253-264) allows the doc's creator or the **workspace
  owner** — not admin. So per current behavior, an admin who can edit any doc and delete any
  folder still cannot delete a doc they didn't create. This may be intentional (mirrors the
  "admin can't touch the owner" line for members), but it's inconsistent with admin's broad
  folder-delete power and wasn't explicitly decided either way.

### 2d. `app/folders/page.tsx`, `app/library/page.tsx`, `components/doc-topbar.tsx`, `app/page.tsx`, `app/docs/page.tsx` — do they still work?

- `app/folders/page.tsx` — **confirmed correct**, personal-only by design (2b above), no
  interaction with the new role gates.
- `app/library/page.tsx` — **affected by 2b**: its shared-workspace folder listing
  (`?workspace_id=`) is creator-scoped even though its shared-workspace doc listing
  (`?workspace_id=` on docs) is correctly workspace-wide. Same count/list style mismatch as
  the folder page.
- `components/doc-topbar.tsx` — no role awareness at all (grepped for `role`/`canEdit`/
  `readOnly`, zero hits). "Move to folder" (line 520) is gated only on the `onDelete` prop
  being truthy, and "Delete doc" (line 609) isn't gated at all beyond the menu being open —
  neither checks the viewer's role in the doc's workspace. `onDelete` is wired from
  `app/docs/[id]/page.tsx:651` as `isLoggedIn ? handleDelete : undefined`, so for any
  logged-in viewer/commenter both buttons are live. See section 4/5 for what happens when
  they're used — Move silently no-ops, Delete actually surfaces a clean error (see 5).
- `app/page.tsx` — personal-only (`/api/folders`, `/api/docs`, no params), so not directly
  hit by 2b, but its `handleMove` (line 190) has the same "no `res.ok` check" issue as every
  other move handler — see section 4.
- `app/docs/page.tsx` — same pattern as `app/page.tsx`.

### 2e. Move/create as commenter or viewer — does the API fail cleanly?

**`handleMove` (move-to-folder): API fails cleanly server-side, but the UI doesn't check
the result and shows success anyway.** All five `handleMove` implementations —
`app/page.tsx:190`, `app/docs/page.tsx:151`, `app/workspaces/[id]/page.tsx:219`,
`app/folders/[id]/page.tsx:197`, `components/doc-topbar.tsx:436` — call `PUT
/api/docs/[id]` without checking `res.ok`, then unconditionally mutate local state as if the
move succeeded (`setDocs`/`setAllDocs` filtering the doc out, or in the topbar's case, a
"Moved" success toast). Server-side, a commenter or viewer's `PUT` request is correctly
rejected — the `accessCheck` in `app/api/docs/[id]/route.ts:93-108` only matches
`wm.role IN ('admin', 'editor')`, direct ownership, or workspace ownership, so a
commenter/viewer gets a clean 404. But since the frontend never looks at the response, the
doc visually disappears from the list (or the topbar shows "Moved") even though nothing
happened server-side — it reappears on next reload. This is the "UI silently no-ops"
failure mode the task asked me to check for, and it's present. Not role-specific in cause —
it'll also misfire any time a move is rejected for other reasons (e.g. hitting the same-bug
target-folder-ownership check in section 4) — but commenter/viewer is the reliable way to
trigger it.

**`handleNewDoc`/`handleCreateDoc` (doc creation): not merely "silently no-ops" — it
actually succeeds for a commenter or viewer.** `POST /api/docs`
([app/api/docs/route.ts:84-130](app/api/docs/route.ts#L84)) has zero membership/role check
before inserting a doc with the caller-supplied `workspace_id` — it only checks the free-plan
doc-count limit. Contrast with `POST /api/folders`, which this session's role-hierarchy work
correctly gated to owner/admin/editor
([app/api/folders/route.ts:203-212](app/api/folders/route.ts#L203)). Doc creation has no
equivalent gate. Combined with the "New Doc" button being unconditionally rendered in
`app/workspaces/[id]/page.tsx:362` and `app/folders/[id]/page.tsx:283` (no role check on
either), a commenter or viewer — who per the confirmed role rules should be read-only/blocked
— can create new docs directly in a shared workspace through the normal UI, no workaround
needed. This is the most actionable finding in this report.

---

## 3. Member-management feature

- **`GET /api/workspaces/[id]` member exposure — confirmed correct.**
  [app/api/workspaces/[id]/route.ts:16-25](app/api/workspaces/[id]/route.ts#L16) fetches the
  workspace, computes `isOwner` / `isMember` (accepted status required), and returns 403
  before the member list is ever serialized if neither is true. Not exposed to an arbitrary
  URL guesser.

- **Members section (`app/settings/page.tsx`) hides controls, doesn't just disable them —
  confirmed correct.** The `canManageMember(member) ? <select>… : <span>{member.role}</span>`
  and `{canManageMember(member) && <button>Remove</button>}` pattern (line 949 in the
  current file) means an unprivileged viewer of the page never gets the `<select>`/`<button>`
  elements in the DOM at all, not just visually disabled ones.

- **Server-side re-verification — confirmed correct.** Both handlers in
  `app/api/workspaces/[id]/members/[memberId]/route.ts` call `authorizeMemberAction`, which
  independently re-derives the caller's owner/role status from the database
  (`isWorkspaceOwner`, `getUserRoleInWorkspace`) rather than trusting anything from the
  request body or client state. Tested the reasoning through both directions: an editor
  hitting the endpoint directly falls through to `role === 'admin'` failing, landing on the
  final `Not authorized` 403; an admin attempting to set someone to `'admin'` is blocked by
  the explicit `!result.isOwner && role === 'admin'` check in `PATCH`. Client-side tampering
  with `canManageMember`'s backing state cannot produce a real mutation.

- **OPEN QUESTION (not fixed, flagging only): invite is still owner-only.**
  `app/api/workspaces/invite/route.ts:34-38` — `isWorkspaceOwner` gate, no admin bypass.
  Admins can manage (re-role, remove) every non-admin member but cannot bring new people in.
  Could be intentional defense-in-depth (same category as workspace delete/rename — owner-
  only, full stop), or could be an oversight from focusing the role-hierarchy work on
  managing *existing* members. The UI doesn't currently distinguish this: the entire
  workspace context menu in `components/sidebar.tsx:748-786` — "Rename" (line 776), "Invite
  people" (777), "Delete" (778) — renders unconditionally for every workspace in
  `extraWorkspaces` (`components/sidebar.tsx:592`, `workspaces.filter(w => w.id !==
  workspaceId)`), and `workspaces` itself is populated from **both** `owned` and `shared`
  results of `GET /api/workspaces` (`components/sidebar.tsx:383-388`). So a non-owner member
  — including a viewer — sees Rename/Invite/Delete for every shared workspace they belong to,
  not just the ones they own, with no client-side owner check anywhere in that block.
  Server-side behavior differs by action, so the actual failure mode differs too:
  - **Invite**: click it, fill the form, submit — gets a plain `Not authorized` inline error
    (the sidebar's invite-modal error handling only special-cases the `Pro plan
    required...` 403 for the upgrade prompt; this different 403 string falls through to
    `setInviteError(data.error)`). Round-trips before failing, but fails cleanly and visibly.
  - **Delete** (`deleteExtraWorkspace`, `components/sidebar.tsx:435-443`): does check `res.ok`
    and shows `alert("Failed to delete workspace.")` on failure — correctly handled despite
    the menu item being shown to people who can't use it.
  - **Rename** (`commitExtraWsRename`, `components/sidebar.tsx:429-434`) — **BUG**: renames
    optimistically in local state and `cacheSet`s it to `sb_workspaces` *before* the `PUT
    /api/workspaces/[id]` request resolves, and never checks `res.ok` afterward (bare `try {}
    catch {}`). `PUT /api/workspaces/[id]` → `renameWorkspaceById` is owner-scoped and 404s
    for a non-owner. So a non-owner member (any role) who renames a shared workspace from the
    sidebar sees the new name applied instantly in their own UI, and it's written into their
    localStorage cache — persisting across reloads until the next server refetch of
    `/api/workspaces` overwrites it — while the workspace's actual name in the database, and
    every other member's view of it, never changed. This is worse than the Move-doc silent
    no-op in section 2e because it's cached, not just transiently wrong until refresh.

---

## 4. Doc move / folder-permission interaction (this session's specific concern)

**Confirmed broken, as suspected.** `PUT /api/docs/[id]`'s target-folder validation was
never updated to use `getFolderPermission` when the rest of the role-hierarchy work went in.
[app/api/docs/[id]/route.ts:116-118](app/api/docs/[id]/route.ts#L116):

```ts
const targetFolder = await sql`
  SELECT workspace_id FROM folders WHERE id::text = ${folder_id} AND user_id = ${payload.userId}
`
if (targetFolder.length === 0) {
  return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
}
```

This still requires the *mover* to be the *target folder's creator*. Walking through the
scenario the audit asked about — an admin (not the folder's creator, not the workspace
owner) moving a doc into a teammate's folder — the initial `accessCheck` on lines 93-108
passes fine (admin role matches `wm.role IN ('admin', 'editor')`), but this second check
fails: `folders.user_id` won't equal the admin's `payload.userId`, so `targetFolder.length
=== 0` and the request 404s with `Folder not found`. **The admin cannot move a doc into any
folder they didn't personally create — including folders in a workspace they administer.**
This directly contradicts the confirmed rule that admins can manage folders workspace-wide,
and it's a strictly narrower check than `getFolderPermission` would give (which already
exists in `lib/workspaces.ts` and is used everywhere else folder access is checked). It was
simply missed — this file wasn't in the list of files touched by the role-hierarchy prompt.

Compounding factor: even before reaching this bug, the target folder likely wouldn't have
appeared in the move-to-folder picker in the first place, because of the `GET
/api/folders?all=true` creator-scoping bug in section 2b — the two bugs stack, so the failure
is currently invisible in normal UI use (the folder just never shows up as an option) rather
than surfacing as a visible 404.

### 4a. A pre-existing frontend call now breaks visibly because of the new role check

`components/sidebar.tsx:544-579` (`handleModalConfirm`) is the handler behind the sidebar's
per-workspace "+" → "New Doc"/"New Folder" quick actions
(`openModal("folder", ws.id)`/`openModal("doc", ws.id)`, wired at
`components/sidebar.tsx:767-768` for every workspace in `extraWorkspaces`, owned or not — same
unconditional-menu pattern documented in section 3's invite bullet). The `modalType ===
"folder"` branch (lines 557-564):

```ts
const res = await fetch("/api/folders", { method: "POST", ... })
const folder = await res.json()
if (targetId !== workspaceId) fetchFoldersForWorkspace(targetId, false)
else { const updated = [...folders, folder]; setFolders(updated); cacheSet("sb_folders", updated) }
```

never checks `res.ok`. Before this session's role-hierarchy work, `POST /api/folders` always
succeeded for any authenticated user creating their own folder, so this was safe. Now that
the same endpoint can return a 403 body (`{ error: 'Not authorized to create folders in this
workspace' }`) for a commenter/viewer, this code takes that error object, treats it as if it
were a folder, and pushes it straight into `folders` state (`{...folders, folder}` where
`folder = { error: '...' }`) — no `id`, no `name`. That's not a clean failure, it's a
malformed folder card rendered in the sidebar (undefined name, no usable id for the `key`
prop/menu actions) the next time this workspace's `+` → New Folder is used by a commenter or
viewer. This is a direct, concrete regression from the new role check landing on an endpoint
whose caller was never updated to expect a non-2xx response — exactly the kind of interaction
the audit asked about. The doc branch (`modalType === "doc"`, lines 546-555) doesn't have
this specific symptom only because `POST /api/docs` still has no role check at all (section
2e), so it never returns non-2xx for this reason.

---

## 5. Other structural issues noticed

- **Doc/folder deletion's failure handling is inconsistent depending on which screen you're
  standing on.** `app/docs/[id]/page.tsx:541-553` (the doc detail page's own delete, reached
  from `doc-topbar.tsx`'s "Delete doc") checks `res.ok` and shows an `alert()` with the
  server's error on failure — so a viewer/commenter clicking Delete from the topbar gets a
  correct, visible "Delete failed: ..." message, not a silent removal. That's the one
  well-behaved example. Every other `handleDelete`/`handleDeleteSubfolder` skips the check
  and mutates local state optimistically regardless of what the server did:
  - `app/folders/[id]/page.tsx:208-213` (doc delete from the folder listing) — no `res.ok`
    check, doc is filtered out of the list unconditionally.
  - `app/folders/[id]/page.tsx:230-236` (subfolder delete) — worse: state is filtered out
    *before* the `fetch` even starts, wrapped in a `try {} catch {}` that only swallows
    network-level failures, not 403s.
  - `app/page.tsx:201-205`, `app/docs/page.tsx` (doc delete) — same missing check.
  - Concretely: an editor (who per the confirmed rules cannot delete folders) clicking
    delete on a subfolder from `app/folders/[id]/page.tsx` will see it vanish from their
    screen immediately, even though `DELETE /api/folders/[id]` correctly rejects it
    server-side (`canDelete: false` for editor) — it reappears on next page load, with no
    error shown in between.
  - `handleCreateSubfolder` in the same file (`app/folders/[id]/page.tsx:215-228`) is the one
    creation-side example that does this right — checks `res.ok` before touching state.

- **Pending invites are manageable server-side but have no UI for it.**
  `authorizeMemberAction` in the members route doesn't special-case `status = 'pending'` —
  an owner/admin can `PATCH`/`DELETE` a pending invite's `workspace_members` row through the
  API today. But `app/settings/page.tsx`'s members section only renders management controls
  for `members.filter(m => m.status === 'accepted')`; the pending-invites block (further
  down) is read-only (email + "Pending · role" text, no buttons). There's currently no way to
  cancel a sent invite or fix its role before it's accepted, despite the backend supporting
  it.

- **`role` validation asymmetry between invite and member-update.** `POST
  /api/workspaces/invite` (`route.ts:29-32`) accepts `role` in
  `['admin', 'editor', 'commenter', 'viewer']` with no extra restriction beyond "must be
  valid" — since only the owner can invite at all (section 3), granting `admin` at invite
  time is implicitly owner-gated too, consistent with the member-update endpoint's explicit
  `Only the workspace owner can grant admin` check. No bug here, just noting the two
  endpoints enforce the same rule through different mechanisms (one via "only owner can call
  this at all," the other via an explicit role check) — worth keeping in sync if invite ever
  stops being owner-only per the open question in section 3.
