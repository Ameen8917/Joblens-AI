import { AnalysisMode } from '../../types';

interface Tab { id: AnalysisMode; label: string; icon: string; desc: string; }
const TABS: Tab[] = [
  { id: 'fit',           label: 'Fit Analysis',   icon: '◎', desc: 'Score + strengths & gaps'  },
  { id: 'gaps',          label: 'Gap Analysis',   icon: '△', desc: 'Missing skills with fixes'  },
  { id: 'cover-letter',  label: 'Cover Letter',   icon: '✦', desc: 'Tailored to JD & resume'   },
  { id: 'interview',     label: 'Interview Prep', icon: '⬡', desc: '9 questions with frameworks' },
];

interface Props {
  active: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  loading?: boolean;
}

export const ModeTabs = ({ active, onChange, loading }: Props) => (
  <div className="grid grid-cols-4 gap-2">
    {TABS.map(tab => {
      const isActive = tab.id === active;
      return (
        <button key={tab.id} onClick={() => !loading && onChange(tab.id)} disabled={loading}
          className="relative glass-elevated rounded-xl px-3 py-3 text-left transition-all duration-200 group disabled:opacity-50"
          style={isActive ? { borderColor: 'var(--accent-amber)', background: 'rgba(245,158,11,0.06)' } : undefined}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-base" style={{ color: isActive ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
              {tab.icon}
            </span>
            <span className="text-xs font-semibold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {tab.label}
            </span>
          </div>
          <p className="text-xs font-mono leading-relaxed hidden sm:block" style={{ color: 'var(--text-muted)' }}>
            {tab.desc}
          </p>
          {isActive && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: 'var(--accent-amber)' }} />
          )}
        </button>
      );
    })}
  </div>
);
