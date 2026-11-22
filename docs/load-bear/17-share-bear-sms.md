# Share Bear by text message

**Status:**
- Built and tested locally: unit tests, and a two-phone browser walkthrough in test mode.
- Real texts need Twilio credentials, and the owner's approval to spend money.
- Until then, production uses the "send it from your phone" fallback.

## What it does
**Her side**
1. On a task, she taps **🐻 Share Bear** and chooses who: a recent helper, a phone contact (where the browser offers a
   picker), or a typed mobile number.
2. She sees exactly what they'll get, including the full text, then taps **Send request**.
3. Bear texts them a link and tells her what they answer.
4. While they have it, the task waits on them and isn't suggested to her. If they say no, can't do it, or don't answer, it's
   back in her queue with its date as it was.

**Their side** (no app, no account, no password)
- They open the link and tap **Yes, I'll do it** or **Sorry, I can't**.
- Later they can mark it **done** (with a confirmation), say it's **still on track**, say **I can't do this anymore**, or
  turn reminders off.
- After answering they see an optional "Get Load Bear" link.

**Follow-up** (on the existing 15-minute schedule, 8am–8pm Sydney)
- One nudge if there's no answer after about 20 hours.
- One reminder on the day it's due.
- One "Still waiting on Daniel" note to her if the day ends without a "done".
- Expiry when the link runs out. Nothing is ever repeated.

## Where things live
**Logic and storage**
- `lib/bear/sharebear/core.ts`: phone numbers (AU first, E.164), the state machine, tokens, message wording, the public
  view, and follow-up timing.
- `lib/bear/sharebear/service.ts`: create and send, the recipient's answers, her actions, keeping her tasks in sync,
  follow-ups, and delivery reports.
- `lib/bear/sharebear/sms.ts`: the text providers (Twilio, mock, none) and Twilio signature checking.
- `lib/bear/sharebear/rows.ts` and `lib/bear/server/sharebear-rows.ts`: storage (memory locally; in production, rows of the
  delivery account).
- `lib/bear/server/sharebear.ts`: wiring, push to her phone, and the rate limit.

**Routes**
- `app/api/bear/share-bear` (GET, POST)
- `app/api/bear/share-bear/[id]`: her actions
- `app/api/bear/r/[token]`: the public side
- `app/api/bear/share-bear/sms-status`: Twilio delivery reports
- `app/api/bear/cron/share-bear`: follow-ups

**Screens**
- `components/bear/share-bear.tsx`: the sheet and the task panel.
- `app/bear/r/[token]/page.tsx`: the recipient's page.
- "Shared with others" in Bear Brain.
- Answers appear as notices on Drop Bear and are pushed to her phone outside quiet hours.

## Data
There is **no database migration**. Each request is one JSON record in `bear_push_subscriptions`, owned by the server's
delivery account (endpoint `sb:<id>`, protected by row-level security). It holds what the conceptual tables would:
- **The request:** id, task, owner, status, timestamps, expiry, reminder flags.
- **The recipient:** name and number.
- **A snapshot:** the shared title, date, time and message as she approved them (never her notes).
- **Token hashes:** SHA-256 only; every link sent stays valid until the request ends or expires.
- **The audit log:** every state change, with its source.
- **Messages:** provider id, kind, delivery status and error.
- **Notices.**

Writes compare a revision number, so two taps or two callbacks can't both win. Recent helpers are saved on her profile
(name and number only, nothing imported). Deleting her data deletes her requests.

**State machine:**
- `DRAFT → PENDING_SEND → SENT | SEND_FAILED`
- `SEND_FAILED → PENDING_SEND | CANCELLED`
- `SENT → ACCEPTED | DECLINED | EXPIRED | CANCELLED`
- `ACCEPTED → COMPLETED | UNABLE_TO_COMPLETE | CANCELLED`

Repeating the same move changes nothing.

## Configuration
| Variable | What it does |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Real texts. `TWILIO_FROM` is a number, or a Messaging Service SID (`MG…`, recommended, so Twilio handles STOP opt-outs). Without these, production offers "send it from your phone". |
| `SHARE_BEAR_SMS=mock` | Test mode: never sends, and the screen says so. This is automatic when there's no database (local development). |
| `SHARE_BEAR_BASE_URL` | The address links point to. Defaults to the address she's using; set it if a branded domain is added. |
| `NEXT_PUBLIC_LOADBEAR_IOS_URL`, `NEXT_PUBLIC_LOADBEAR_ANDROID_URL`, `NEXT_PUBLIC_LOADBEAR_LANDING_URL` | Where "Get Load Bear" goes. Without them it goes to the marketing site, https://getloadbear.app. |

**Twilio setup:**
1. Create an account and buy an Australian number, or register an alphanumeric sender ID.
2. Create a Messaging Service and add the number to it.
3. Put the three values in Vercel's environment variables.
4. Point delivery reports at `https://<site>/api/bear/share-bear/sms-status`. The app sets this per message automatically
   when it is served over https.

Australian texts cost roughly 5–8 cents each.

## Known limits
- **Rate limit:** per server instance only (40 page loads and 15 answers a minute per address), not shared across instances.
- **Recipient's time zone:** assumed to be Sydney's.
- **"Done" is what the helper says:** the task is completed as reported by them, and the app says Bear hasn't checked it.
- **A late delivery failure:** a report that a sent text couldn't be delivered cancels the request and tells her. The state
  machine has no SENT → SEND_FAILED move.
- **Changed tasks:** if she edits the task after they said yes, the panel offers "Ask them again". Nothing is changed for
  them silently; they still see what they agreed to.
- **Contact picker:** only browsers with the Contact Picker API offer it (mainly Android Chrome). iPhone uses typed numbers
  or recent helpers.

## Using getloadbear.app for links
getloadbear.app is the separate marketing site, hosted on Cloudflare; it does not serve this app. For text links to read
`app.getloadbear.app/bear/r/…`:
1. Add `app.getloadbear.app` to the Vercel project's Domains.
2. Add a Cloudflare DNS record: CNAME `app` → `cname.vercel-dns.com`, DNS only.
3. Set `LINK_HOST` in `lib/bear/server/sharebear.ts` (or `SHARE_BEAR_BASE_URL` in Vercel) to `https://app.getloadbear.app`.
