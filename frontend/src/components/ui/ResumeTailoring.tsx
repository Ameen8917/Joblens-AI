import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CircleAlert, CircleX, Copy, Download, LoaderCircle, Pencil, Sparkles, TriangleAlert, X } from 'lucide-react';
import { downloadTailoredResume, scoreTailored, suggestRewrites } from '../../api/tailor';
import { BulletRewrite, ClaimFlag, ParsedResume, TailoredScore } from '../../types';

interface Props { jobId: string; resumeId: string; resume: ParsedResume; }

type Decision = 'accepted' | 'rejected';

const FLAG_STYLE: Record<ClaimFlag['severity'], { label: string; Icon: typeof CircleX; cls: string }> = {
  unsupported: { label: 'Not on your resume', Icon: CircleX,       cls: 'bg-bad-soft text-bad'   },
  check:       { label: 'Check this',         Icon: TriangleAlert, cls: 'bg-warn-soft text-warn' },
  dropped:     { label: 'Left out',           Icon: CircleAlert,   cls: 'bg-info-soft text-info' },
};

const SCORE_DELAY_MS = 600;
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const Flags = ({ flags }: { flags: ClaimFlag[] }) => (
  <ul className="mt-2 space-y-1">
    {flags.map(f => {
      const { label, Icon, cls } = FLAG_STYLE[f.severity];
      return (
        <li key={`${f.severity}-${f.kind}-${f.claim}`} className={`flex items-start gap-1.5 rounded-md px-2 py-1 text-[11px] leading-relaxed ${cls}`}>
          <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span><span className="font-semibold">{label}:</span> {f.detail}</span>
        </li>
      );
    })}
  </ul>
);

const Delta = ({ before, after }: { before: number; after: number }) => {
  const change = after - before;
  const cls = change > 0 ? 'text-brand' : change < 0 ? 'text-bad' : 'text-muted';
  return <span className={`text-xs font-semibold ${cls}`}>{change > 0 ? '+' : ''}{change}</span>;
};

export const ResumeTailoring = ({ jobId, resumeId, resume }: Props) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rewrites, setRewrites] = useState<BulletRewrite[]>([]);
  const [discarded, setDiscarded] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [result, setResult] = useState<TailoredScore | null>(null);
  // The server's claim check for the exact text it was sent, so edited text never shows stale flags.
  const [checked, setChecked] = useState<Record<string, { text: string; flags: ClaimFlag[]; counted: boolean }>>({});
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const scoreRequest = useRef(0);

  const load = async () => {
    setStatus('loading'); setError(null);
    try {
      const data = await suggestRewrites(jobId, resumeId);
      setRewrites(data.rewrites); setDiscarded(data.discarded);
      setTexts(Object.fromEntries(data.rewrites.map(r => [r.id, r.rewritten])));
      setDecisions({}); setResult(null); setChecked({});
      setStatus('ready');
    } catch (e) { setError(errorText(e)); setStatus('error'); }
  };

  const accepted = useMemo(
    () => rewrites.filter(r => decisions[r.id] === 'accepted').map(r => ({ id: r.id, rewritten: texts[r.id] ?? r.rewritten })),
    [rewrites, decisions, texts],
  );

  useEffect(() => {
    const request = ++scoreRequest.current;
    if (!accepted.length) { setResult(null); setScoring(false); setScoreError(null); return; }
    setScoring(true);
    const timer = setTimeout(async () => {
      try {
        const data = await scoreTailored(jobId, resumeId, accepted);
        if (request !== scoreRequest.current) return;
        setResult(data); setScoreError(null);
        setChecked(prev => ({
          ...prev,
          ...Object.fromEntries(data.edits.map(e => [e.id, { text: accepted.find(a => a.id === e.id)!.rewritten, flags: e.flags, counted: e.counted }])),
        }));
      } catch (e) {
        if (request === scoreRequest.current) setScoreError(errorText(e));
      } finally {
        if (request === scoreRequest.current) setScoring(false);
      }
    }, SCORE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [accepted, jobId, resumeId]);

  const flagsFor = (r: BulletRewrite): ClaimFlag[] | null => {
    const text = texts[r.id] ?? r.rewritten;
    if (checked[r.id]?.text === text) return checked[r.id].flags;
    return text === r.rewritten ? r.flags : null;
  };

  // Clicking the current decision again undoes it.
  const decide = (id: string, decision: Decision) => setDecisions(prev => {
    const next = { ...prev };
    if (next[id] === decision) delete next[id]; else next[id] = decision;
    return next;
  });

  const saveEdit = () => {
    if (!editing) return;
    const text = editing.draft.trim();
    if (text) {
      setTexts(prev => ({ ...prev, [editing.id]: text }));
      setDecisions(prev => ({ ...prev, [editing.id]: 'accepted' }));
    }
    setEditing(null);
  };

  const tailoredHistory = useMemo(() => resume.workHistory.map((w, wi) => ({
    ...w,
    bullets: w.highlights.map((text, hi) => {
      const edit = accepted.find(a => a.id === `${wi}-${hi}`);
      return edit ? { text: edit.rewritten, changed: true } : { text, changed: false };
    }),
  })), [resume, accepted]);

  const copyBullets = async () => {
    const plain = tailoredHistory.map(w => [`${w.role}, ${w.company}`, ...w.bullets.map(b => `- ${b.text}`)].join('\n')).join('\n\n');
    try { await navigator.clipboard.writeText(plain); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  if (status === 'idle' || status === 'error') {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center animate-fade-up">
        <Sparkles className="h-7 w-7 text-brand" />
        <p className="max-w-md text-sm text-body">
          Gemini rewrites your work bullets for this job. Every number and skill in a rewrite is then checked against your resume.
        </p>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button onClick={load} className="btn-primary">
          {status === 'error' ? 'Try again' : 'Suggest rewrites'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 py-14">
        <LoaderCircle className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm text-body">Rewriting bullets and checking every claim…</p>
      </div>
    );
  }

  const notCounted = accepted.filter(a => checked[a.id]?.text === a.rewritten && !checked[a.id].counted).length;
  const flaggedAccepted = rewrites.filter(r => decisions[r.id] === 'accepted' && flagsFor(r)?.some(f => f.severity === 'unsupported')).length;

  const download = async (format: 'pdf' | 'docx') => {
    setDownloading(format); setDownloadError(null);
    try { await downloadTailoredResume(resumeId, accepted, format); }
    catch (e) { setDownloadError(errorText(e)); }
    finally { setDownloading(null); }
  };

  return (
    <div className="grid items-start gap-4 animate-fade-up lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {rewrites.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-body">
            Your bullets already read well for this job, so there's nothing to rewrite.
          </div>
        ) : rewrites.map(r => {
          const decision = decisions[r.id];
          const text = texts[r.id] ?? r.rewritten;
          const flags = flagsFor(r);
          const isEditing = editing?.id === r.id;
          return (
            <div key={r.id} className={`card p-4 transition-colors ${decision === 'accepted' ? 'border-brand-line' : ''} ${decision === 'rejected' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-ink">{r.role}<span className="font-normal text-muted"> · {r.company}</span></p>
                {r.targetSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.targetSkills.map(s => <span key={s} className="rounded bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-body">{s}</span>)}
                  </div>
                )}
              </div>

              <p className="mt-2 text-xs leading-relaxed text-muted line-through decoration-muted/50">{r.original}</p>
              {isEditing ? (
                <textarea value={editing.draft} onChange={e => setEditing({ id: r.id, draft: e.target.value })} rows={3} maxLength={400} autoFocus
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:border-brand focus:outline-none" />
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{text}</p>
              )}
              {r.reason && !isEditing && <p className="mt-1 text-[11px] text-muted">{r.reason}</p>}

              {!isEditing && (flags === null
                ? <p className="mt-2 text-[11px] text-muted">Your edit is checked when you accept it.</p>
                : flags.length > 0 && <Flags flags={flags} />)}

              <div className="mt-3 flex flex-wrap gap-2">
                {isEditing ? <>
                  <button onClick={saveEdit} className="btn-primary px-3 py-1.5 text-xs"><Check className="h-3.5 w-3.5" /> Save and accept</button>
                  <button onClick={() => setEditing(null)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                </> : <>
                  <button onClick={() => decide(r.id, 'accepted')} aria-pressed={decision === 'accepted'}
                    className={`${decision === 'accepted' ? 'btn-primary' : 'btn-secondary'} px-3 py-1.5 text-xs`}>
                    <Check className="h-3.5 w-3.5" /> {decision === 'accepted' ? 'Accepted' : 'Accept'}
                  </button>
                  <button onClick={() => decide(r.id, 'rejected')} aria-pressed={decision === 'rejected'} className="btn-secondary px-3 py-1.5 text-xs">
                    <X className="h-3.5 w-3.5" /> {decision === 'rejected' ? 'Rejected' : 'Reject'}
                  </button>
                  <button onClick={() => setEditing({ id: r.id, draft: text })} className="btn-secondary px-3 py-1.5 text-xs">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </>}
              </div>
            </div>
          );
        })}
        {discarded > 0 && (
          <p className="px-1 text-[11px] text-muted">
            {discarded} suggestion{discarded === 1 ? ' was' : 's were'} dropped because {discarded === 1 ? 'it' : 'they'} didn't match a bullet on your resume or changed nothing.
          </p>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Score Change</p>
            {scoring && <LoaderCircle className="h-4 w-4 animate-spin text-brand" />}
          </div>
          {!accepted.length ? (
            <p className="mt-2 text-xs text-body">Accept a rewrite to rescore your resume with it.</p>
          ) : scoreError ? (
            <p className="mt-2 text-xs text-bad">{scoreError}</p>
          ) : result && (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-muted">{result.before.finalScore}</span>
                <ArrowRight className="h-4 w-4 self-center text-muted" />
                <span className="text-2xl font-extrabold text-ink">{result.after.finalScore}</span>
                <Delta before={result.before.finalScore} after={result.after.finalScore} />
              </div>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><dt className="text-body">Semantic match</dt>
                  <dd className="flex gap-2 text-ink">{result.before.semanticScore} → {result.after.semanticScore} <Delta before={result.before.semanticScore} after={result.after.semanticScore} /></dd></div>
                <div className="flex justify-between"><dt className="text-body">Skill coverage</dt>
                  <dd className="flex gap-2 text-ink">{result.before.programmaticScore} → {result.after.programmaticScore} <Delta before={result.before.programmaticScore} after={result.after.programmaticScore} /></dd></div>
              </dl>
              {result.evidenceUpgrades.length > 0 && (
                <p className="mt-3 text-xs text-body">
                  Now shown in your work, not just listed: <span className="font-semibold text-brand-dark">{result.evidenceUpgrades.join(', ')}</span>
                </p>
              )}
              {notCounted > 0 && (
                <p className="mt-3 rounded-md bg-bad-soft px-2 py-1 text-[11px] text-bad">
                  {notCounted} accepted rewrite{notCounted === 1 ? '' : 's'} with a claim your resume can't back up {notCounted === 1 ? 'is' : 'are'} left out of this score.
                </p>
              )}
            </>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Rescored with the same model as your match score. Rewording usually moves it only a few points, because the score measures what you did rather than how it's phrased.
          </p>
        </div>

        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Tailored Experience</p>
            <button onClick={copyBullets} className="flex items-center gap-1 text-[11px] font-semibold text-body hover:text-ink">
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {tailoredHistory.map((w, wi) => (
              <div key={`${w.company}-${wi}`}>
                <p className="text-xs font-semibold text-ink">{w.role}</p>
                <p className="text-[11px] text-muted">{[w.company, w.duration].filter(Boolean).join(' · ')}</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {w.bullets.map((b, bi) => (
                    <li key={bi} className={`text-[11px] leading-relaxed ${b.changed ? 'font-medium text-brand-dark' : 'text-body'}`}>{b.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <p className="eyebrow mb-2">Download</p>
            <div className="flex gap-2">
              {(['docx', 'pdf'] as const).map(format => (
                <button key={format} onClick={() => download(format)} disabled={!!downloading} className="btn-secondary flex-1 px-3 py-1.5 text-xs">
                  {downloading === format ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            {flaggedAccepted > 0 && (
              <p className="mt-2 rounded-md bg-warn-soft px-2 py-1 text-[11px] text-warn">
                {flaggedAccepted} accepted rewrite{flaggedAccepted === 1 ? ' has' : 's have'} a claim your resume can't back up, and {flaggedAccepted === 1 ? 'it is' : 'they are'} included in the download.
              </p>
            )}
            {downloadError && <p className="mt-2 text-[11px] text-bad">{downloadError}</p>}
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              One column, standard headings, no tables or images. Built from your parsed resume, so add your phone number and links before sending. DOCX keeps every character; PDF uses a standard font that lacks some non-Latin letters.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
