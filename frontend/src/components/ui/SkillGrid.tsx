import { CircleAlert, CircleCheck, Info, LucideIcon } from 'lucide-react';
import { SkillMatch } from '../../types';

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
    </div>
  );
};
