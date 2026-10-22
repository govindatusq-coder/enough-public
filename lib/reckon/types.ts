/**
 * Reckon data model.
 *
 * The central distinction in this file: SOURCE CONTENT, AI INFERENCE and
 * USER-CONFIRMED MEANING are separate records with separate provenance.
 * Nothing the AI proposes becomes "true" for the Personal OS until the user
 * confirms or modifies it, and that status is explicit on every record.
 */

export type ISODate = string;

/** Who produced a record and how. Every meaningful entry carries one. */
export interface Provenance {
  kind: 'user' | 'ai' | 'system' | 'seed';
  at: ISODate;
  /** AI model id, or a short note such as "derived from reflections". */
  detail?: string;
}

export type Confidence = 'low' | 'medium' | 'high';

/**
 * Lifecycle of an inference. Only `user_confirmed` and `user_modified`
 * count as the user's own view. `rejected` is retained so it is never
 * re-proposed and never influences the Personal OS.
 */
export type ConfirmationStatus = 'proposed' | 'user_confirmed' | 'user_modified' | 'rejected';

interface Entity {
  id: string;
  userId: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  archived?: boolean;
}

export interface User extends Entity {
  name?: string;
}

/* ------------------------------------------------------------------ */
/* Sources and ingestion                                               */
/* ------------------------------------------------------------------ */

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'web' | 'manual' | 'upload';
export type SourceType =
  | 'reel' | 'post' | 'video' | 'short' | 'page' | 'article'
  | 'text' | 'quote' | 'thought' | 'transcript' | 'image';

export type RetrievalStatus =
  | 'not_attempted' // manual input; nothing to fetch
  | 'pending'
  | 'retrieved'      // enough legitimate content for AI interpretation
  | 'partial'        // some metadata, not enough for interpretation
  | 'unavailable'    // the platform declined (login wall, 4xx, blocked)
  | 'failed';        // network / parse error

export type IngestionMethod =
  | 'none' | 'manual' | 'upload'
  | 'open_graph'        // public HTML <meta property="og:*">
  | 'oembed'            // provider oEmbed endpoint
  | 'embed_page'        // provider's public embed HTML (Instagram /embed/captioned/)
  | 'readable_text';    // paragraph text of a generic web page

export interface IngestionAttempt {
  method: IngestionMethod;
  url: string;
  startedAt: ISODate;
  finishedAt: ISODate;
  httpStatus?: number;
  finalUrl?: string;
  ok: boolean;
  fields: string[];        // which fields this attempt yielded
  error?: string;
  note?: string;
}

/** Honest record of what was and was not retrieved for a source. */
export interface IngestionRecord {
  status: RetrievalStatus;
  method: IngestionMethod;       // the method that produced the content we kept
  attempts: IngestionAttempt[];
  startedAt: ISODate;
  finishedAt?: ISODate;
  fieldsRetrieved: string[];
  transcriptAvailable: boolean;
  contentAvailableToAi: boolean;
  error?: string;
  notes: string[];
}

export interface Source extends Entity {
  platform: Platform;
  type: SourceType;
  url?: string;
  canonicalUrl?: string;
  externalId?: string;         // e.g. Instagram shortcode, YouTube video id
  retrieval: IngestionRecord;
  /* Only ever populated from legitimate retrieval or the user. Never invented. */
  title?: string;
  caption?: string;
  transcript?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  author?: string;
  publishedAt?: string;
  /** Text the user pasted (manual) or an image data URL (upload). */
  manualText?: string;
  imageDataUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Reckon items, insights, routes                                      */
/* ------------------------------------------------------------------ */

export type ItemStatus = 'KEPT' | 'EXPLORING' | 'TRYING' | 'WORKING' | 'INTEGRATED' | 'RETIRED';

export type CaptureMode = 'reckoned' | 'told' | 'written' | 'kept';

/** The AI's reading of the source. Never the canonical meaning. */
export interface Insight {
  text: string;
  basis: 'source_content' | 'user_input' | 'both';
  confidence: Confidence;
  provenance: Provenance;
}

/** The user's confirmed meaning. This is the canonical meaning of an item. */
export interface Takeaway {
  text: string;
  status: 'user_confirmed' | 'user_modified';
  confirmedAt: ISODate;
  /** What the AI proposed, if anything, so the edit history is visible. */
  originalProposal?: string;
}

export type RouteFunction = 'KNOW' | 'THINK' | 'DO' | 'FEEL' | 'RELATE' | 'BECOME' | 'CREATE' | 'REMEMBER';

export interface Route {
  function: RouteFunction;
  status: ConfirmationStatus;
  alternatives: RouteFunction[];
  provenance: Provenance;
}

/** Structured semantic representation used by Find the Thread. */
export interface SemanticFeatures {
  topic: string;
  principle: string;
  value?: string;
  desiredChange?: string;
  behavioural?: string;
  cognitive?: string;
  emotional?: string;
  interpersonal?: string;
  contexts: string[];
  entities: string[];          // only people/things the user explicitly named
  facets: string[];            // controlled vocabulary, see facets.ts
  confidence: Confidence;
  provenance: Provenance;
}

export type EmbeddingStatus = 'not_available' | 'features_only' | 'embedded';

export interface ReckonItem extends Entity {
  sourceId: string;
  status: ItemStatus;
  captureMode: CaptureMode;
  /** What the user said about it in their own words before confirmation. */
  userNote?: string;
  distilled?: Insight;
  takeaway?: Takeaway;
  route?: Route;
  semantic?: SemanticFeatures;
  embeddingStatus: EmbeddingStatus;
  themeIds: string[];
  isSeed?: boolean;
}

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

export interface ThemeEvidence {
  itemId: string;
  weight: number;   // 0..1 contribution
  why?: string;
}

export type ThemeResponse = 'yes' | 'a_little' | 'not_really';

export interface Theme extends Entity {
  title: string;              // AI wording
  description: string;        // the cautious "I'm noticing…" explanation
  userWording?: string;       // if modified
  status: ConfirmationStatus;
  userResponse?: ThemeResponse;
  confidence: Confidence;
  evidence: ThemeEvidence[];
  sharedFacets: string[];
  clusterFingerprint: string; // sorted item ids, used to avoid re-proposing a rejected cluster
  provenance: Provenance;
  decidedAt?: ISODate;
}

/* ------------------------------------------------------------------ */
/* Goals, experiments, reflections                                     */
/* ------------------------------------------------------------------ */

/** A larger direction that matters to the user. Always user-stated. */
export interface Goal extends Entity {
  text: string;
  status: 'active' | 'paused' | 'done';
  provenance: Provenance;
}

export type ExperimentKind = 'behaviour' | 'thinking' | 'relationship' | 'practice';
export type ExperimentStatus = 'trying' | 'working' | 'generalising' | 'integrated' | 'retired';

export interface Experiment extends Entity {
  kind: ExperimentKind;
  status: ExperimentStatus;
  goalId?: string;
  whatMatters: string;
  noticing: string;
  testing: string;          // the hypothesis
  when: string;             // contextual cue
  try: string;              // behaviour / thought / practice
  successMeans: string;
  /* thinking experiments */
  currentInterpretation?: string;
  alternative?: string;
  /* relationship practices */
  oldResponse?: string;
  themeIds: string[];
  itemIds: string[];
  conversationId?: string;
  nextCheckIn?: ISODate;
  provenance: Provenance;
  userConfirmed: boolean;
  userModified: boolean;
}

export type Barrier =
  | 'forgot' | 'wrong_time' | 'didnt_fit' | 'too_vague' | 'didnt_know_how'
  | 'too_hard' | 'old_habit' | 'didnt_want_to' | 'couldnt_in_situation' | 'didnt_help';

export type Helped = 'yes' | 'somewhat' | 'no';

/** One reflection = one ExperimentAttempt record. */
export interface Reflection extends Entity {
  experimentId: string;
  opportunity: boolean;
  remembered?: boolean;
  tried?: boolean;
  helped?: Helped;
  barrier?: Barrier;
  note?: string;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

export interface ContextUsed {
  itemIds: string[];
  themeIds: string[];
  experimentIds: string[];
  factIds: string[];
  reflectionIds: string[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'reckon';
  content: string;
  at: ISODate;
  contextUsed?: ContextUsed;
  /** A proposed experiment attached to this message, awaiting the user. */
  proposal?: ExperimentProposal;
  provenance: Provenance;
  safety?: boolean;
}

export interface ExperimentProposal {
  kind: ExperimentKind;
  whatMatters: string;
  noticing: string;
  testing: string;
  when: string;
  try: string;
  successMeans: string;
  currentInterpretation?: string;
  alternative?: string;
  oldResponse?: string;
}

export interface Conversation extends Entity {
  title: string;
  themeId?: string;
  itemId?: string;
  experimentId?: string;
  messages: ConversationMessage[];
  /** Simple, visible stage so the AI does not rush to goals. */
  stage: 'opening' | 'situation' | 'mechanism' | 'offer' | 'experiment' | 'done';
}

/* ------------------------------------------------------------------ */
/* Personal OS                                                         */
/* ------------------------------------------------------------------ */

export type OSSection =
  | 'matters'        // What matters to me
  | 'returning'      // Ideas I keep returning to
  | 'patterns'       // Patterns I'm noticing
  | 'principles'     // Principles I want to live by
  | 'helps'          // What seems to help
  | 'doesnt_help'    // What doesn't seem to help
  | 'figuring_out';  // Things I'm still figuring out

export interface EvidenceRef {
  kind: 'item' | 'theme' | 'conversation' | 'experiment' | 'reflection';
  id: string;
  label?: string;
}

export interface PersonalOSFact extends Entity {
  section: OSSection;
  text: string;
  userWording?: string;
  status: ConfirmationStatus;
  confidence: Confidence;
  evidence: EvidenceRef[];
  provenance: Provenance;
  /** Stable key so the same inference is not proposed twice. */
  fingerprint: string;
  decidedAt?: ISODate;
}

export type PersonalPrinciple = PersonalOSFact & { section: 'principles' };
export type PersonalPattern = PersonalOSFact & { section: 'patterns' };

/* ------------------------------------------------------------------ */
/* Ingestion queue and lab                                             */
/* ------------------------------------------------------------------ */

export interface QueuedUrl {
  id: string;
  url: string;
  addedAt: ISODate;
  label?: string;
}

export interface AiCallLog {
  id: string;
  at: ISODate;
  fn: string;
  provider: 'anthropic' | 'fallback';
  model?: string;
  ms: number;
  ok: boolean;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ReckonState {
  version: 1;
  user: User;
  sources: Source[];
  items: ReckonItem[];
  themes: Theme[];
  goals: Goal[];
  experiments: Experiment[];
  reflections: Reflection[];
  conversations: Conversation[];
  facts: PersonalOSFact[];
  queue: QueuedUrl[];
  aiLog: AiCallLog[];
}
