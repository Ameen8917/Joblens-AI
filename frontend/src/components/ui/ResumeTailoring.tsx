import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUp, Check } from 'lucide-react';
import { getTailoringSuggestions } from '../../api/preview';
import { ParsedJD, ParsedResume, ScoreBreakdown, TailoringSuggestion } from '../../types';
import { PreviewBadge } from './PreviewBadge';

interface Props { resume: ParsedResume; jd: ParsedJD; score: ScoreBreakdown; }

interface Bullet { text: string; note?: string; }
interface Paper {
  name: string;
  headline: string;
  headlineChanged?: boolean;
  skills: { label: string; added?: boolean }[];
  jobs: { key: string; role: string; meta: string; bullets: Bullet[] }[];
}

const toPaper = (r: ParsedResume): Paper => ({
  name: r.name,
  headline: r.workHistory[0]?.role ?? '',
  skills: r.skills.map(label => ({ label })),
  jobs: r.workHistory.slice(0, 2).map((w, i) => ({
    key: `${w.company}-${i}`,
    role: w.role,
    meta: [w.company, w.duration].filter(Boolean).join(' · '),
    bullets: w.highlights.slice(0, 3).map(text => ({ text })),
  })),
});

const tailor = (base: Paper, jd: ParsedJD, score: ScoreBreakdown, applied: TailoringSuggestion[]): Paper => {
  const paper: Paper = { ...base, skills: [...base.skills], jobs: base.jobs.map(j => ({ ...j, bullets: j.bullets.map(b => ({ ...b })) })) };

  if (applied.some(s => s.kind === 'headline')) { paper.headline = jd.title; paper.headlineChanged = true; }

  if (applied.some(s => s.kind === 'reorder-skills')) {
    const relevant = (skill: string) => score.matchedSkills.some(m => m.status !== 'missing'
      && (m.skill.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(m.skill.toLowerCase())));
    paper.skills = [...paper.skills.filter(s => relevant(s.label)), ...paper.skills.filter(s => !relevant(s.label))];
  }

  for (const s of applied) if (s.skill) paper.skills.push({ label: s.skill, added: true });

  if (applied.some(s => s.kind === 'quantify')) {
    // Never invent a number: leave a marker for the candidate to fill in.
    const bullet = paper.jobs.flatMap(j => j.bullets).find(b => !/\d/.test(b.text));
    if (bullet) bullet.note = '[add a real metric]';
  }
  return paper;
};

const ResumePaper = ({ title, paper, emphasis }: { title: string; paper: Paper; emphasis?: boolean }) => (
  <div className={`card min-w-0 p-5 ${emphasis ? 'border-brand-line' : ''}`}>
    <p className="eyebrow mb-3">{title}</p>
    <div className="rounded-xl border border-line bg-surface p-4 shadow-lift">
      <p className="text-sm font-bold text-ink">{paper.name}</p>
      <p className={`text-xs ${paper.headlineChanged ? 'font-semibold text-brand-dark' : 'text-body'}`}>{paper.headline}</p>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">Skills</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {paper.skills.map(s => (
          <span key={s.label} className={`rounded px-1.5 py-0.5 text-[11px] ${s.added ? 'bg-brand-soft font-semibold text-brand-dark' : 'bg-subtle text-body'}`}>{s.label}</span>
        ))}
      </div>

      {paper.jobs.length > 0 && <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">Experience</p>}
      {paper.jobs.map(j => (
        <div key={j.key} className="mt-2">
          <p className="text-xs font-semibold text-ink">{j.role}</p>
          <p className="text-[11px] text-muted">{j.meta}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {j.bullets.map((b, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-body">
                {b.text}{b.note && <span className="ml-1 font-semibold text-warn">{b.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export const ResumeTailoring = ({ resume, jd, score }: Props) => {
  const [suggestions, setSuggestions] = useState<TailoringSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    getTailoringSuggestions(resume, jd, score).then(items => {
      if (!live) return;
      setSuggestions(items);
      setSelected(new Set(items.map(s => s.id)));
    });
    return () => { live = false; };
  }, [resume, jd, score]);

  const original = useMemo(() => toPaper(resume), [resume]);
  const tailored = useMemo(
    () => tailor(original, jd, score, suggestions.filter(s => appliedIds.has(s.id))),
    [original, jd, score, suggestions, appliedIds],
  );

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const gain = suggestions.filter(s => selected.has(s.id)).reduce((sum, s) => sum + s.points, 0);
  const impact = Math.min(Math.round(gain), 100 - score.finalScore);

  return (
    <div className="grid items-start gap-4 animate-fade-up lg:grid-cols-[270px_1fr_auto_1fr]">
      <div className="space-y-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="eyebrow">Suggested Improvements</p>
            <PreviewBadge>Preview</PreviewBadge>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-xs text-body">Your resume already lines up with this job.</p>
          ) : (
            <ul className="space-y-1">
              {suggestions.map(s => {
                const on = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <button role="checkbox" aria-checked={on} onClick={() => toggle(s.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-subtle">
                      <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}>
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-ink">{s.title}</span>
                        <span className="block text-[11px] leading-relaxed text-body">{s.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button onClick={() => setAppliedIds(new Set(selected))} disabled={!suggestions.length} className="btn-primary mt-3 w-full">
            Apply Suggestions
          </button>
        </div>

        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="eyebrow">Score Impact</p>
            <p className="text-[11px] text-muted">Estimated, skills only</p>
          </div>
          <span className="flex items-center gap-1 text-base font-bold text-brand">
            <ArrowUp className="h-4 w-4" />+{impact} points
          </span>
        </div>
      </div>

      <ResumePaper title="Your Resume" paper={original} />
      <div className="hidden self-center lg:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white"><ArrowRight className="h-4 w-4" /></span>
      </div>
      <ResumePaper title="Tailored Resume" paper={tailored} emphasis />
    </div>
  );
};
