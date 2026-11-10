# Bear in Outlook (add-in)

A "Give to Bear" button in Outlook. The person opens an email, taps it, and the email (and any PDFs or
photos they tick) goes through the same capture → extraction → School pack → auto-setup pipeline as
everything else. Nothing is sent before that tap. The add-in asks Outlook for `ReadItem` only: the open
email, never the mailbox.

## Pieces
| Piece | Where |
|---|---|
| Manifest (XML; built per deployment host, own add-in id per host) | `app/outlook/manifest.xml/route.ts`, `lib/bear/outlook/item.ts` → `/outlook/manifest.xml` |
| Task pane | `app/bear/outlook/page.tsx`, `components/bear/outlook-pane.tsx` |
| Sign-in window (Office dialog) | `app/bear/outlook/connect/page.tsx`, `components/bear/outlook-connect.tsx` |
| Office.js glue, add-in session | `lib/bear/outlook/office-client.ts` |
| How-to page (linked from Settings) | `app/bear/outlook/help/page.tsx` |
| Icons | `public/outlook/icon-{16,32,64,80,128}.png` |
| Headers | `lib/content-security-policy.ts` (`outlook:true`), `next.config.ts` (only `/bear/outlook*`) |
| Tests | `tests/bear-outlook.test.mjs` |

## How it signs in
The pane can't rely on the browser's Bear cookie (Outlook frames the pane, and third-party cookie rules
vary). The sign-in window makes a **separate** Supabase session with email and password, hands it to the
pane with `messageParent`, and closes. The pane keeps it in its own storage and calls the existing
`/api/bear/captures` with `Authorization: Bearer`. The server already verifies bearer tokens with
Supabase on every request (the iPhone app uses the same path) and RLS applies. Signing out of the add-in
doesn't sign you out of the app, and the reverse.

## Headers
Only `/bear/outlook` pages may be framed, and only by Outlook hosts (`outlook.office.com`,
`outlook.office365.com`, `outlook.live.com`, `*.outlook.com`, `*.office.com`, `*.office365.com`,
`*.officeapps.live.com`, `*.cloud.microsoft`). They may also load `appsforoffice.microsoft.com`.
Everything else keeps `frame-ancestors 'none'`.

## Installing (testing)
Outlook on the web → `aka.ms/olksideload` → My add-ins → Add a custom add-in → Add from File (download `/outlook/manifest.xml` first; "Add from URL" is often greyed out) or Add from URL →
`https://<deployment>/outlook/manifest.xml`. It then shows up in the new Outlook for Windows, Outlook
for Mac and Outlook mobile on the same account. Work and school tenants may block custom add-ins.

## Not done yet (needs decisions or accounts)
- **Microsoft Marketplace (AppSource) listing**: Partner Center account, privacy policy and terms URLs,
  screenshots, and Microsoft's review. Org-wide rollout via the Microsoft 365 admin centre is the
  quicker path for a business pilot.
- **Validation with Microsoft's tool**: `npx office-addin-manifest validate` needs Microsoft's online
  service, which this build environment can't reach. Run it locally before submitting.
- **Single sign-on with a Microsoft account**: not needed for the MVP (Load Bear accounts are email and
  password).
- **Unified JSON manifest (Teams-style)**: XML is used because it works in every Outlook today.

## Bear's first read (off by default)
Set `BEAR_DECISIONS_ENABLED=on` to show a small "Bear's first read" card in the panel: Looks like something
for you / might matter / you're waiting / looks like a change / looks like a confirmation / nothing here
needs you. It comes from `lib/bear/engine/decide.ts` (rule-based) and is worked out inside the panel, so
the email isn't sent anywhere before the person taps. It only changes what the panel suggests; it never
adds, closes or changes anything by itself. "Is that right?" sends labels only (what Bear said, what it
should have said, which rule fired) to `/api/bear/decide/feedback`, never the email. Measured scores:
`evaluation/results/decisions-*.json`; read their caveats before quoting any number.

## Draft a reply (same flag)
With `BEAR_DECISIONS_ENABLED=on`, a scheduling question ("Could we do 3pm or 4pm on Tuesday 24th?") also shows
**Draft a reply**. It opens an Outlook reply (`displayReplyForm`, read-item permission only) with the times from
the question in [square brackets] for the person to choose from. Bear can't see a calendar, so the draft never
says a time works. Bear never sends; the person reads, edits and sends. Only scheduling questions get a draft.
Code: `lib/bear/outlook/draft.ts`; tests: `tests/bear-draft-reply.test.mjs`.
