import { CircleAlert, CircleCheck, CircleX, LucideIcon, Minus, TriangleAlert } from 'lucide-react';
import { HardCheck } from '../../types';

const STATUS: Record<HardCheck['status'], { label: string; Icon: LucideIcon; cls: string }> = {
  pass:         { label: 'Met',        Icon: CircleCheck,   cls: 'text-good'  },
  warn:         { label: 'Check this', Icon: TriangleAlert, cls: 'text-warn'  },
  fail:         { label: 'Not met',    Icon: CircleX,       cls: 'text-bad'   },
  unknown:      { label: 'Can’t tell', Icon: CircleAlert,   cls: 'text-info'  },
  not_required: { label: 'Not stated', Icon: Minus,         cls: 'text-muted' },
};

export const HardChecks = ({ checks }: { checks: HardCheck[] }) => (
  <div className="card p-5 animate-fade-up">
    <p className="eyebrow">Requirement Checks</p>
    <p className="mb-3 text-xs text-muted">Rule-based checks. They don’t change the score above.</p>
    <ul className="divide-y divide-line">
      {checks.map(c => {
        const { label, Icon, cls } = STATUS[c.status];
        return (
          <li key={c.id} className="grid gap-1 py-2.5 sm:grid-cols-[110px_1fr_100px] sm:items-center sm:gap-3">
            <span className="text-sm font-semibold text-ink">{c.label}</span>
            <span className="text-xs leading-relaxed text-body">{c.detail}</span>
            <span className={`flex items-center gap-1 text-xs font-semibold sm:justify-end ${cls}`}>
              <Icon className="h-4 w-4 flex-shrink-0" /> {label}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);
