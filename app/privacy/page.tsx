import type {Metadata} from 'next';
import styles from './page.module.css';

export const metadata:Metadata={title:'Privacy notice · ENOUGH',description:'Draft privacy notice for the ENOUGH prototype, including account data and optional OpenAI ideas.'};
export default function Privacy(){return <>
 <a className="skip" href="#privacy-main">Skip to privacy notice</a>
 <main id="privacy-main" className={styles.page}>
  <a className={styles.back} href="/#pins">Back to ENOUGH</a>
  <span className="eyebrow">YOUR INFORMATION</span>
  <h1>Privacy, in plain language.</h1>
  <div className={styles.draft}><strong>Draft for legal review · 11 October 2026</strong><p>This describes the current prototype. The operating entity, public privacy contact, retention arrangements and overseas processing must be confirmed before public release. It is not a claim of legal compliance.</p></div>
  <section><h2>What we collect, and why</h2>
   <ul>
    <li><strong>Account details:</strong> email and sign-in information, including details returned by Google or Apple if you choose that provider. Supabase manages authentication. They let you access your own saved account.</li>
    <li><strong>Your profile:</strong> optional first name, PINS (preferences, interests, needs and strengths), life routines, country, currency and optional visual preferences. These help match movement ideas to your day. Needs can include health information, such as pain, low energy or accessibility needs.</li>
    <li><strong>Moves and feedback:</strong> saved and generated ideas, plans, reminders, cost assumptions, daily notes, confirmed outcomes and reflections. These support your matches and your own record of what worked.</li>
    <li><strong>Photos and check-ins:</strong> photos you choose to upload and companion names you add manually or through QR check-ins. They support your private moments gallery and meeting record. ENOUGH does not upload your address book.</li>
    <li><strong>Optional native health access:</strong> Apple Health or Android Health Connect daily steps and exercise minutes are read only after permission in the native app. Daily totals remain in screen memory. If you explicitly save a movement check for an activity, that selected reading becomes part of the activity record.</li>
    <li><strong>Technical information:</strong> authentication cookies and browser storage maintain your session and preview. Hosting and service providers may process IP addresses, request details and operational logs to deliver and protect the service.</li>
   </ul>
   <p>You can browse the library without an account or AI permission. Written answers are optional where marked. Avoid adding names, contact details or information about other people to written answers.</p>
  </section>
  <section><h2>Device preview and cloud storage</h2>
   <p>Before you choose a cloud profile, your preview profile and progress stay in this browser. Signing in does not automatically import them. We show a collection notice before you choose to keep a profile in your account.</p>
   <p>Cloud account records and private photos are stored using Supabase in Sydney. Vercel hosts the web app, with application functions configured for Sydney. An Australian region does not mean every provider operation, support process or log stays in Australia. Access rules restrict account records and private photos to their signed-in owner.</p>
  </section>
  <section><h2>OpenAI ideas and pictures are your choice</h2>
   <p>Before the first fresh AI request, choose one of these options in ENOUGH:</p>
   <ul>
    <li><strong>Use AI ideas:</strong> send PINS choices, routines, daily context and selected activity feedback to OpenAI. This can include health-related needs. Your usual-day activity and limits derived from needs help shape suggestions.</li>
    <li><strong>Use AI ideas without my health needs:</strong> send approved non-health choices only. Health needs, usual-day activity, written notes, previous outcome records and earlier AI text are excluded. ENOUGH still applies all your needs on its own server before offering an idea. Fewer ideas may fit. Missing pictures for older ideas are left alone because their text may include earlier health context.</li>
    <li><strong>Not now:</strong> continue with library ideas, with no new OpenAI idea or picture requests.</li>
   </ul>
   <p>Pictures use the suggested activity, movement, setting, pace, safety note and illustrative scene. They are generated when you request suggestions, then privately cached. Your profile name, uploaded photos, companion records and visual preferences are not sent to OpenAI. Written fields may contain personal information you enter; the reduced option excludes them.</p>
   <p>OpenAI processes requests in the United States. Its retention and processing depend on its service terms and account settings. ENOUGH sends idea requests with response storage disabled; that does not promise zero provider retention. Your choice is saved with its time and version. Change it in My Pins → AI and privacy. A changed choice stops later requests; it cannot recall data already sent. Existing ideas and cached pictures remain available.</p>
  </section>
  <section><h2>Who processes information</h2>
   <p>Supabase provides account authentication, database and private photo storage. Vercel provides hosting and application processing. OpenAI processes optional AI requests. Google or Apple processes its own sign-in flow if selected. The current web app also loads Google Fonts and may load externally hosted, licensed library images; those providers receive ordinary web request information, such as your IP address. ENOUGH does not send them your profile to load those assets.</p>
   <p>No selling of profile data or advertising integration is implemented in this prototype. No research participation is included in this notice; research would need its own information and consent process.</p>
  </section>
  <section><h2>Access, correction and export</h2>
   <p>Edit your profile in My Pins. Correct outcomes in My Wins. Open My account → Download my ENOUGH data for a JSON export of your current profile, consent choice, plans, check-ins and outcomes. Save original photo files separately from the gallery. The current export includes ideas retained in your account snapshot; it is not a complete export of the paged suggestion archive.</p>
   <p>Device previews use Account &amp; backup to download current changes. Browser reading preferences and native operating-system permissions are managed separately.</p>
  </section>
  <section><h2>Deletion and retention</h2>
   <p>My Pins or My account → Delete my ENOUGH data removes your cloud profile, plans, outcomes, suggestion archive and stored photos, including cached AI pictures. If deletion is interrupted, ENOUGH reports it so you can retry. This does not delete the separate Supabase sign-in identity or recall requests already processed by OpenAI.</p>
   <p>Reset this device’s preview clears the local preview. To remove provider sign-in records or ask about backup and log retention, make a privacy request. A fixed retention schedule, backup removal process and account-identity deletion route must be confirmed during legal review; this prototype does not promise immediate deletion from every provider backup or log.</p>
  </section>
  <section><h2>Questions and complaints</h2>
   <p>For the current prototype, contact the person who provided access to request access, correction or deletion, or to raise a privacy concern. Do not post health information, photos or account exports in a public issue tracker. A dedicated public privacy contact and the operator’s legal identity have not yet been published and must be confirmed before launch.</p>
   <p>If a concern is not resolved, you can read the <a href="https://www.oaic.gov.au/privacy/privacy-complaints">Office of the Australian Information Commissioner’s privacy complaint process</a>, including when it can consider a complaint and the requirement to complain to the organisation first.</p>
  </section>
  <a className={styles.back} href="/#pins">Return to My Pins</a>
 </main>
 </>}
