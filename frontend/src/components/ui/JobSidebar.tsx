import { SavedJob } from "../../types";

interface Props {
  jobs: SavedJob[];
  activeId?: string;
  onSelect: (job: SavedJob) => void;
  onDelete: (id: string) => void;
}

const ScoreBadge = ({ score }: { score: number | null }) => {
  if (score === null) return (
    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-border)', color: 'var(--text-muted)' }}>
      —
    </span>
  );
  const color = score >= 75 ? 'var(--score-high)' : score >= 50 ? 'var(--score-mid)' : 'var(--score-low)';
  const bg    = score >= 75 ? 'rgba(34,197,94,0.12)' : score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: bg, color }}>
      {score}%
    </span>
  );
};

export const JobSidebar = ({ jobs, activeId, onSelect, onDelete }: Props) => (
  <aside className="glass rounded-xl p-4 h-full flex flex-col">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        Saved Jobs
      </h2>
      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-border)', color: 'var(--text-muted)' }}>
        {jobs.length}
      </span>
    </div>

    {jobs.length === 0 ? (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
        <span className="text-2xl opacity-30">◎</span>
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>No saved jobs yet</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Analyze a job to save it here</p>
      </div>
    ) : (
      <ul className="space-y-1.5 flex-1 overflow-y-auto">
        {jobs.map(job => {
          const isActive = job.id === activeId;
          return (
            <li key={job.id}>
              <div
                onClick={() => onSelect(job)}
                className="relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all duration-150 group"
                style={{
                  background: isActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(245,158,11,0.25)' : 'transparent'}`,
                }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {job.title}
                  </p>
                  <p className="text-xs font-mono truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {job.company}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <ScoreBadge score={job.score} />
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(job.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 font-mono text-sm leading-none"
                    style={{ color: 'var(--text-muted)' }}>
                    ×
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </aside>
);
