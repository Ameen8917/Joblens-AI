import { ResultTab } from '../../types';

export const TABS: { id: ResultTab; label: string }[] = [
  { id: 'fit',          label: 'Fit Analysis'     },
  { id: 'gaps',         label: 'Gap Analysis'     },
  { id: 'tailor',       label: 'Resume Tailoring' },
  { id: 'cover-letter', label: 'Cover Letter'     },
  { id: 'interview',    label: 'Interview Prep'   },
  { id: 'mock',         label: 'Mock Interview'   },
];

export const modeLabel = (m: ResultTab) => TABS.find(t => t.id === m)!.label;

interface Props {
  active: ResultTab;
  onChange: (mode: ResultTab) => void;
  loading?: boolean;
}

export const ModeTabs = ({ active, onChange, loading }: Props) => (
  <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
    {TABS.map(tab => {
      const on = tab.id === active;
      return (
        <button key={tab.id} role="tab" aria-selected={on}
          onClick={() => !loading && onChange(tab.id)} disabled={loading && !on}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
            on ? 'border-brand text-brand-dark' : 'border-transparent text-body hover:text-ink'}`}>
          {tab.label}
        </button>
      );
    })}
  </div>
);
