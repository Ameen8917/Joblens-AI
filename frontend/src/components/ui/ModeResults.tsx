import { useState } from 'react';
import { Check, CircleAlert, CircleCheck, CircleX, Copy, Download, Lightbulb, Mail, TriangleAlert } from 'lucide-react';
import { FitAnalysisData, GapAnalysisData, CoverLetterData, InterviewPrepData, ScoreBreakdown } from '../../types';

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
};

// ═══════════════════════════════════════════════════
// FIT ANALYSIS
// ═══════════════════════════════════════════════════
const Radar = ({ axes }: { axes: { label: string; value: number }[] }) => {
  const size = 240, c = size / 2, R = 78;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const poly = (r: (i: number) => number) => axes.map((_, i) => pt(i, r(i)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-full max-h-64 w-full" role="img"
      aria-label={axes.map(a => `${a.label} ${a.value}`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={poly(() => R * f)} fill="none" stroke="var(--border)" />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" />; })}
      <polygon points={poly(i => (R * Math.max(axes[i].value, 4)) / 100)}
        fill="var(--brand)" fillOpacity="0.18" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={a.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-[var(--text-primary)]" fontSize="11" fontWeight="600">
            {a.label}
            <tspan x={x} dy="13" fontWeight="500" className="fill-[var(--text-muted)]">{a.value}</tspan>
          </text>
        );
      })}
    </svg>
  );
};

const BulletList = ({ items, icon }: { items: string[]; icon: 'good' | 'warn' }) => (
  <ul className="space-y-2">
    {items.map((s, i) => (
      <li key={i} className="flex gap-2.5 text-sm text-body animate-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
        {icon === 'good'
          ? <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-good" />
          : <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" />}
        <span>{s}</span>
      </li>
    ))}
  </ul>
);

export const FitResult = ({ data }: { data: FitAnalysisData }) => {
  const s = data.scoreBreakdown;
  const total = s.matchedSkills.length || 1;
  const strict = Math.round((s.matchedSkills.filter(m => m.status === 'matched').length / total) * 100);
  const exp = s.yearsOfExperienceDelta >= 0 ? 100 : Math.max(0, Math.round(100 + s.yearsOfExperienceDelta * 20));
  const axes = [
    { label: 'Skills', value: s.programmaticScore },
    { label: 'Experience', value: exp },
    { label: 'Semantic', value: s.semanticScore },
    { label: 'Exact Match', value: strict },
  ];

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="card p-5">
          <p className="eyebrow">Overall Fit</p>
          <p className="mt-2 text-5xl font-extrabold text-brand">{s.finalScore}%</p>
          <div className="mt-4 h-2 rounded-full bg-subtle">
            <div className="h-full rounded-full bg-brand animate-bar" style={{ width: `${s.finalScore}%` }} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-body">{data.verdict}</p>
        </div>
        <div className="card flex items-center p-4">
          <Radar axes={axes} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-good-soft/60 p-5">
          <p className="eyebrow mb-3">Key Strengths</p>
          <BulletList items={data.strengths} icon="good" />
        </div>
        <div className="rounded-2xl border border-bad/15 bg-bad-soft/70 p-5">
          <p className="mb-3 text-[13px] font-semibold text-bad">Areas to Improve</p>
          <BulletList items={data.gaps} icon="warn" />
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// GAP ANALYSIS
// ═══════════════════════════════════════════════════
const priority = {
  high:   { label: 'High priority',   Icon: CircleX,       icon: 'text-bad',  box: 'border-bad/15 bg-bad-soft/50',   chip: 'text-bad'  },
  medium: { label: 'Medium priority', Icon: TriangleAlert, icon: 'text-warn', box: 'border-warn/20 bg-warn-soft/60', chip: 'text-warn' },
  low:    { label: 'Low priority',    Icon: CircleAlert,   icon: 'text-info', box: 'border-line bg-surface',         chip: 'text-info' },
} as const;

const Requirement = ({ label, met }: { label: string; met: boolean }) => (
  <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-sm">
    <span className="text-body">{label}</span>
    <span className={`flex items-center gap-1 text-xs font-semibold ${met ? 'text-good' : 'text-bad'}`}>
      {met ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}{met ? 'Met' : 'Not met'}
    </span>
  </div>
);

export const GapResult = ({ data, score }: { data: GapAnalysisData; score?: ScoreBreakdown | null }) => {
  const order = ['high', 'medium', 'low'] as const;
  const sorted = [...data.gaps].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
  const tip = sorted[0];

  return (
    <div className="space-y-4 animate-fade-up">
      <div className={`grid gap-4 ${score ? 'lg:grid-cols-[1fr_300px]' : ''}`}>
        <div className="space-y-3">
          {sorted.length === 0 && (
            <div className="card p-5 text-sm text-body">No meaningful gaps found for this role.</div>
          )}
          {sorted.map((gap, i) => {
            const p = priority[gap.priority];
            return (
              <div key={i} className={`rounded-2xl border p-4 animate-fade-up ${p.box}`} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-start gap-3">
                  <p.Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${p.icon}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-ink">{gap.skill}</p>
                      <span className={`text-xs font-semibold ${p.chip}`}>{p.label}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-body">{gap.reason}</p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-ink">→ {gap.suggestion}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {score && (
          <div className="card h-fit p-5">
            <p className="eyebrow mb-3">Requirements Check</p>
            <div className="space-y-2">
              <Requirement label="Years of experience" met={score.yearsOfExperienceDelta >= 0} />
              <Requirement label={`Required skills (${score.matchedSkills.length - score.missingRequired.length}/${score.matchedSkills.length})`}
                met={score.missingRequired.length === 0} />
              <Requirement label="Semantic alignment" met={score.semanticScore >= 60} />
            </div>
          </div>
        )}
      </div>

      {tip && (
        <div className="flex items-start gap-2.5 rounded-xl border border-info/15 bg-info-soft px-4 py-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" />
          <p className="text-body"><span className="font-semibold text-ink">Tip:</span> {tip.suggestion}</p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// COVER LETTER
// ═══════════════════════════════════════════════════
export const CoverLetterResult = ({ data }: { data: CoverLetterData }) => {
  const { copied, copy } = useCopy();
  const full = `Subject: ${data.subject}\n\n${data.body}`;

  const download = () => {
    const url = URL.createObjectURL(new Blob([full], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'cover-letter.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 animate-fade-up lg:grid-cols-[260px_1fr]">
      <div className="card flex h-fit flex-col items-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
          <Mail className="h-8 w-8 text-brand" />
        </div>
        <p className="mt-4 text-base font-bold text-ink">Your cover letter is ready!</p>
        <p className="mt-1 text-xs leading-relaxed text-body">Personalized from your resume and the job description · {data.wordCount} words</p>
        <div className="mt-5 flex w-full flex-col gap-2">
          <button onClick={download} className="btn-primary w-full"><Download className="h-4 w-4" /> Download .txt</button>
          <button onClick={() => copy(full)} className="btn-secondary w-full">
            {copied ? <><Check className="h-4 w-4 text-good" /> Copied</> : <><Copy className="h-4 w-4" /> Copy Text</>}
          </button>
        </div>
      </div>

      <article className="rounded-2xl border border-line bg-surface p-8 shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Subject</p>
        <p className="mt-1 text-sm font-semibold text-ink">{data.subject}</p>
        <div className="my-5 border-t border-line" />
        <div className="whitespace-pre-wrap text-sm leading-7 text-body">{data.body}</div>
      </article>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// INTERVIEW PREP
// ═══════════════════════════════════════════════════
const typeChip = {
  behavioral:      'bg-info-soft text-info',
  technical:       'bg-brand-soft text-brand-dark',
  'role-specific': 'bg-warn-soft text-warn',
};

export const InterviewResult = ({ data }: { data: InterviewPrepData }) => {
  const [sel, setSel] = useState(0);
  const { copied, copy } = useCopy();
  const q = data.questions[sel];

  return (
    <div className="grid gap-4 animate-fade-up lg:grid-cols-[1fr_1fr]">
      <div className="card p-5">
        <p className="eyebrow mb-3">Top Interview Questions</p>
        <ol className="space-y-1">
          {data.questions.map((item, i) => (
            <li key={i}>
              <button onClick={() => setSel(i)}
                className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  i === sel ? 'bg-brand-soft' : 'hover:bg-subtle'}`}>
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  i === sel ? 'bg-brand text-white' : 'bg-subtle text-body'}`}>{i + 1}</span>
                <span className={`text-sm ${i === sel ? 'font-semibold text-ink' : 'text-body'}`}>{item.question}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {q && (
        <div className="card h-fit p-5 lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Answer Framework</p>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${typeChip[q.type]}`}>{q.type.replace('-', ' ')}</span>
          </div>
          <div className="mt-3 rounded-xl bg-subtle p-4">
            <p className="text-sm font-bold text-ink">{q.question}</p>
            <ul className="mt-3 space-y-2">
              {q.answerFramework.map((tip, j) => (
                <li key={j} className="flex gap-2.5 text-sm text-body">
                  <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />{tip}
                </li>
              ))}
            </ul>
          </div>
          <button onClick={() => copy(`${q.question}\n\n${q.answerFramework.map(t => `- ${t}`).join('\n')}`)}
            className="btn-secondary mt-4">
            {copied ? <><Check className="h-4 w-4 text-good" /> Copied</> : <><Copy className="h-4 w-4" /> Copy Answer</>}
          </button>
        </div>
      )}
    </div>
  );
};
