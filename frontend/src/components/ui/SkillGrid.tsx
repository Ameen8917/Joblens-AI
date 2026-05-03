import { SkillMatch } from '../../types';

interface Props { skills: SkillMatch[]; missingNiceToHave?: string[]; }

const statusConfig = {
  matched: { icon: '✓', color: 'var(--score-high)',  bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',  label: 'Matched'  },
  partial: { icon: '~', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: 'Partial'  },
  missing: { icon: '✗', color: 'var(--score-low)',    bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)', label: 'Missing'  },
};

export const SkillGrid = ({ skills, missingNiceToHave = [] }: Props) => {
  const matched = skills.filter(s => s.status === 'matched');
  const partial  = skills.filter(s => s.status === 'partial');
  const missing  = skills.filter(s => s.status === 'missing');

  return (
    <div className="glass p-6 animate-fade-up delay-100">
      <h3 className="text-sm font-semibold font-mono tracking-widest uppercase mb-4" style={{ color: 'var(--text-secondary)' }}>
        Skills Analysis
      </h3>

      {/* Legend */}
      <div className="flex gap-4 mb-5">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{cfg.label} ({skills.filter(s=>s.status===key).length})</span>
          </div>
        ))}
      </div>

      {/* Required skills grid */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[...matched, ...partial, ...missing].map((s, i) => {
          const cfg = statusConfig[s.status];
          return (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium animate-fade-up"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, animationDelay: `${i * 0.03}s` }}>
              <span className="font-bold">{cfg.icon}</span>{s.skill}
            </span>
          );
        })}
      </div>

      {/* Nice to have missing */}
      {missingNiceToHave.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--bg-border)' }}>
          <p className="text-xs font-mono mb-2 tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Nice-to-Have (Missing)</p>
          <div className="flex flex-wrap gap-2">
            {missingNiceToHave.map((s, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs font-mono"
                style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--bg-border)', color: 'var(--text-muted)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
