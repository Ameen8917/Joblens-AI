import { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, LucideIcon } from 'lucide-react';
import { EvidenceLevel, SkillMatch } from '../../types';

interface Props { skills: SkillMatch[]; missingNiceToHave?: string[]; }

const Stat = ({ icon: Icon, label, items, tone }: {
  icon: LucideIcon; label: string; items: string[]; tone: 'good' | 'info' | 'bad';
}) => {
  const cls = {
    good: { box: 'bg-surface border-line', icon: 'text-good', chip: 'bg-good-soft text-good' },
    info: { box: 'bg-surface border-line', icon: 'text-info', chip: 'bg-info-soft text-info' },
    bad:  { box: 'bg-bad-soft border-bad/20', icon: 'text-bad', chip: 'bg-surface text-bad' },
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${cls.box}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-7 w-7 flex-shrink-0 ${cls.icon}`} strokeWidth={2} />
        <div>
          <p className="text-xs text-body">{label}</p>
          <p className="text-lg font-bold text-ink">{items.length} {items.length === 1 ? 'Skill' : 'Skills'}</p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {items.map(s => <span key={s} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${cls.chip}`}>{s}</span>)}
        </div>
      )}
    </div>
  );
};

const EvidenceGroup = ({ title, hint, children }: { title: string; hint: string; children: ReactNode }) => (
  <div>
    <p className="text-sm font-semibold text-ink">{title}</p>
    <p className="mb-2 text-xs text-muted">{hint}</p>
    {children}
  </div>
);

const SkillChips = ({ skills, cls }: { skills: SkillMatch[]; cls: string }) => (
  <div className="flex flex-wrap gap-1.5">
    {skills.map(s => <span key={s.skill} title={s.quote ?? undefined} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>{s.skill}</span>)}
  </div>
);

const SkillEvidence = ({ skills }: { skills: SkillMatch[] }) => {
  const found = skills.filter(s => s.status !== 'missing');
  if (found.length === 0) return null;
  const at = (level: EvidenceLevel) => found.filter(s => s.evidence === level);
  const demonstrated = at('demonstrated');
  const listed = at('listed');
  const unverified = at('unverified');

  return (
    <div className="card space-y-4 p-5">
      <p className="eyebrow">Skill Evidence</p>
      {demonstrated.length > 0 && (
        <EvidenceGroup title={`Demonstrated (${demonstrated.length})`} hint="Used in work or a project. Each line was found in your resume.">
          <ul className="space-y-2">
            {demonstrated.map(s => (
              <li key={s.skill} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="w-fit flex-shrink-0 rounded-md bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good">{s.skill}</span>
                <q className="text-xs leading-relaxed text-body">{s.quote}</q>
              </li>
            ))}
          </ul>
        </EvidenceGroup>
      )}
      {listed.length > 0 && (
        <EvidenceGroup title={`Listed only (${listed.length})`} hint="Named on your resume, with no work or project line showing how you used them.">
          <SkillChips skills={listed} cls="bg-warn-soft text-warn" />
        </EvidenceGroup>
      )}
      {unverified.length > 0 && (
        <EvidenceGroup title={`Not confirmed (${unverified.length})`}
          hint={unverified.length === found.length
            ? 'No lines could be checked. This happens with scanned PDFs and resumes uploaded before this check existed, so try uploading it again.'
            : 'No line naming these skills could be confirmed in your resume text.'}>
          <SkillChips skills={unverified} cls="bg-subtle text-body" />
        </EvidenceGroup>
      )}
    </div>
  );
};

export const SkillGrid = ({ skills, missingNiceToHave = [] }: Props) => {
  const by = (st: SkillMatch['status']) => skills.filter(s => s.status === st).map(s => s.skill);
  return (
    <div className="space-y-3 animate-fade-up">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={CircleCheck} label="Matched Skills" items={by('matched')} tone="good" />
        <Stat icon={Info} label="Partial Match" items={by('partial')} tone="info" />
        <Stat icon={CircleAlert} label="Missing Skills" items={by('missing')} tone="bad" />
      </div>
      {missingNiceToHave.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-semibold text-body">Nice-to-have not on resume:</span> {missingNiceToHave.join(', ')}
        </p>
      )}
      <SkillEvidence skills={skills} />
    </div>
  );
};
