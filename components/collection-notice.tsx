export function CollectionNotice({cloud=false}:{cloud?:boolean}){
 return <aside className="collection-notice" aria-label={cloud?'Before your first cloud save':'Account collection notice'}>
  <h2>{cloud?'Before we keep your profile':'About your information'}</h2>
  <p>{cloud?'Saving keeps your PINS, routines, moves, outcomes and AI choice in your account. Needs may include health information. Photos and QR companion names are saved only when you add them.':'Creating or accessing an account sends your email and sign-in details to Supabase. Google or Apple also processes sign-in details if you choose that option. Your device preview is not imported until you choose to keep it.'}</p>
  <p>ENOUGH uses Supabase and Vercel, configured in Sydney, to run your account. Fresh OpenAI ideas and pictures require a separate choice. You can browse the library without them.</p>
  <a className="privacy-link" href="/privacy" target="_blank" rel="noopener noreferrer">Draft privacy notice: storage, overseas processing, export, deletion and complaints <span className="sr-only">(opens in a new tab)</span></a>
 </aside>;
}
