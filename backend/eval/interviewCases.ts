/**
 * Hand-written interview answers with the scores a fair interviewer would give, for checking the answer scorer.
 * Bands are wide on purpose: the point is to catch a scorer that praises a vague answer or misses a contradiction,
 * not to pin exact numbers.
 */

export type Criterion = "structure" | "specifics" | "relevance";

export interface InterviewCase {
  id: string;
  /** "claim" asks about the resume line matched by `bullet`; "behavioral" has no resume line. */
  focus: "claim" | "behavioral";
  question: string;
  answer: string;
  /** Allowed score range per criterion, 1 to 5. Criteria left out aren't checked. */
  bands: Partial<Record<Criterion, [number, number]>>;
  followUp: boolean;
  /** Whether the answer contradicts the resume line. */
  contradiction: boolean;
}

export const INTERVIEW_PAIR = { resume: "backend-mid", job: "backend-senior" } as const;

/** Picks the resume line the claim questions are about, from the parsed resume. */
export const CLAIM_BULLET = /900ms/;

const CLAIM_QUESTION = "Your resume says you cut p95 query latency from 900ms to 120ms. Walk me through how you did that.";
const BEHAVIORAL_QUESTION = "Tell me about a time you disagreed with a teammate about a technical decision.";

export const INTERVIEW_CASES: InterviewCase[] = [
  {
    id: "claim-strong", focus: "claim", question: CLAIM_QUESTION,
    answer: "Our reconciliation dashboard was timing out at month end, with p95 query latency around 900ms. I owned the fix. I ran EXPLAIN ANALYZE on the ten slowest queries and found sequential scans on the transactions table, which had grown to 80 million rows. I added a composite index on account_id and created_at, rewrote two queries to use keyset pagination instead of OFFSET, and tested both against a copy of production. After the release p95 dropped to 120ms and the month-end timeouts stopped.",
    bands: { structure: [4, 5], specifics: [4, 5], relevance: [4, 5] }, followUp: false, contradiction: false,
  },
  {
    id: "claim-vague", focus: "claim", question: CLAIM_QUESTION,
    answer: "I worked on the database and optimized the queries so things got a lot faster. It went really well and the team was happy with the results.",
    bands: { specifics: [1, 2] }, followUp: true, contradiction: false,
  },
  {
    id: "claim-off-topic", focus: "claim", question: CLAIM_QUESTION,
    answer: "I really enjoy frontend work. Last year I redesigned our React settings page, moved it to a new component library and made it work on mobile, and users liked it much more.",
    bands: { relevance: [1, 2] }, followUp: true, contradiction: false,
  },
  {
    id: "claim-contradicts-resume", focus: "claim", question: CLAIM_QUESTION,
    answer: "The dashboard was timing out, with p95 around 900ms. I profiled the slowest queries with EXPLAIN ANALYZE, added a composite index on account_id and created_at, and switched pagination to keyset. That brought p95 down to 300ms.",
    bands: { specifics: [3, 5], relevance: [3, 5] }, followUp: true, contradiction: true,
  },
  {
    id: "claim-rambling", focus: "claim", question: CLAIM_QUESTION,
    answer: "So indexes, yeah, we had a lot of them, some were wrong. And Postgres was version 13 at the time I think, and also we had Redis but that's another story. Account_id was involved. There was also a migration later. Anyway the queries were slow and then they weren't, and there was EXPLAIN, and partitioning came up at some point too.",
    bands: { structure: [1, 2] }, followUp: true, contradiction: false,
  },
  {
    id: "behavioral-strong", focus: "behavioral", question: BEHAVIORAL_QUESTION,
    answer: "On the healthcare team a teammate wanted to cache appointment slots in Redis to speed up the booking page. I was worried about showing patients slots that were already taken. Instead of arguing in the pull request, I suggested we measure first: I wrote a quick load test and we found the slow part was one unindexed query, not the reads in general. We agreed to fix the index first and only cache if it was still slow. The page went from 2 seconds to 300ms without the cache, and we wrote the decision up so the next person had the context.",
    bands: { structure: [4, 5], specifics: [4, 5], relevance: [4, 5] }, followUp: false, contradiction: false,
  },
  {
    id: "behavioral-weak", focus: "behavioral", question: BEHAVIORAL_QUESTION,
    answer: "I always try to listen to other people and find a compromise.",
    bands: { structure: [1, 2], specifics: [1, 2] }, followUp: true, contradiction: false,
  },
];
