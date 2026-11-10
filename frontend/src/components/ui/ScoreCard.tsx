import { ReactNode } from 'react';
import { ScoreBreakdown } from '../../types';

interface Props { score: ScoreBreakdown; }

const tone = (n: number) =>
  n >= 75 ? { stroke: 'stroke-good', text: 'text-good', label: 'Excellent Match!', blurb: 'Your resume is a strong match for this job.', fit: 'A strong fit on paper, but' }
  : n >= 50 ? { stroke: 'stroke-warn', text: 'text-warn', label: 'Moderate Match', blurb: 'You cover the core of this role, with some gaps to close.', fit: 'A moderate fit on paper, but' }
  : { stroke: 'stroke-bad', text: 'text-bad', label: 'Weak Match', blurb: 'This role asks for a lot your resume doesn’t show yet.', fit: 'A weak fit, and' };

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// The score measures fit, not eligibility, so a failed check changes the headline and leaves the number alone.
const headline = (s: ScoreBreakdown) => {
  const t = tone(s.finalScore);
  const failed = s.hardChecks.filter(c => c.status === 'fail').map(c => c.label.toLowerCase());
  if (failed.length === 0) return t;
  const one = failed.length === 1;
  return {
    ...t,
    text: 'text-bad',
    label: one ? 'Requirement Not Met' : `${failed.length} Requirements Not Met`,
    blurb: `${t.fit} your resume doesn’t meet the job’s ${joinNames(failed)} ${one ? 'requirement' : 'requirements'}. See the checks below.`,
  };
};

// The two scorers are independent signals; when they agree, the final score is more trustworthy.
const confidence = (s: ScoreBreakdown) => {
  const gap = Math.abs(s.semanticScore - s.programmaticScore);
  if (gap <= 15) return { label: 'High Confidence', cls: 'bg-good-soft text-good' };
  if (gap <= 30) return { label: 'Medium Confidence', cls: 'bg-warn-soft text-warn' };
  return { label: 'Low Confidence', cls: 'bg-bad-soft text-bad' };
};

export const Ring = ({ value, strokeClass, size = 'h-36 w-36', children }: {
  value: number; strokeClass: string; size?: string; children?: ReactNode;
}) => {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className={`relative flex-shrink-0 ${size}`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-subtle" />
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          className={`animate-ring ${strokeClass}`} style={{ ['--ring-circ' as string]: c }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="text-4xl font-extrabold leading-none text-ink">{value}</span>
            <span className="mt-1 text-sm font-medium text-muted">/100</span>
          </>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) => (
  <div className="grid grid-cols-[1fr_88px_56px] items-center gap-3">
    <span className="truncate text-xs text-body" title={hint}>{label}</span>
    <div className="h-1.5 rounded-full bg-subtle">
      <div className="h-full rounded-full bg-brand animate-bar" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
    <span className="text-right text-xs font-semibold text-ink">{value} <span className="font-normal text-muted">/ {max}</span></span>
  </div>
);

export const ScoreCard = ({ score }: Props) => {
  const t = headline(score);
  const conf = confidence(score);
  const total = score.matchedSkills.length;
  const matched = score.matchedSkills.filter(s => s.status === 'matched').length;
  const delta = score.yearsOfExperienceDelta;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] animate-fade-up">
      <div className="card hero-wash flex flex-col items-center gap-6 p-6 sm:flex-row">
        <Ring value={score.finalScore} strokeClass={t.stroke} />
        <div className="text-center sm:text-left">
          <h2 className={`text-2xl font-extrabold ${t.text}`}>{t.label}</h2>
          <p className="mt-1 text-sm text-body">{t.blurb}</p>
          <span className={`mt-3 inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${conf.cls}`}
            title="How closely the semantic and skill-match scores agree">{conf.label}</span>
        </div>
      </div>

      <div className="card p-5">
        <p className="eyebrow mb-4">Score Breakdown</p>
        <div className="space-y-3.5">
          <Row label="Semantic Similarity" value={Math.round(score.semanticScore * 0.6)} max={60}
            hint="Embedding cosine similarity × 60% weight" />
          <Row label="Skills Match" value={Math.round(score.programmaticScore * 0.4)} max={40}
            hint="Deterministic required-skill coverage × 40% weight" />
          <Row label="Exact Skill Matches" value={matched} max={total} />
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-body">Experience vs. requirement</span>
            <span className={`font-semibold ${delta >= 0 ? 'text-good' : 'text-warn'}`}>
              {delta >= 0 ? '+' : ''}{delta} yrs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
