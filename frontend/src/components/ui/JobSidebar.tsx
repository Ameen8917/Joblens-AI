import { Bookmark, BrainCircuit, ChartNoAxesColumnIncreasing, House, X } from 'lucide-react';
import { SavedJob } from '../../types';

interface Props {
  jobs: SavedJob[];
  activeId?: string;
  onSelect: (job: SavedJob) => void;
  onDelete: (id: string) => void;
  onHome: () => void;
  homeActive: boolean;
}

const scoreTone = (s: number) =>
  s >= 75 ? 'bg-good-soft text-good' : s >= 50 ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad';

export const Logo = () => (
  <div className="flex items-center gap-2">
    <ChartNoAxesColumnIncreasing className="h-6 w-6 text-brand" strokeWidth={2.75} />
    <span className="text-lg font-bold tracking-tight text-ink">
      JobLens <span className="text-brand">AI</span>
    </span>
  </div>
);

export const JobSidebar = ({ jobs, activeId, onSelect, onDelete, onHome, homeActive }: Props) => (
  <aside className="flex h-full flex-col gap-6 px-4 py-5">
    <div className="px-2"><Logo /></div>

    <nav className="space-y-1">
      <button onClick={onHome}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          homeActive ? 'bg-brand-soft text-brand-dark' : 'text-body hover:bg-subtle'}`}>
        <House className="h-4 w-4" /> Home
      </button>
      <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-body">
        <Bookmark className="h-4 w-4" /> Saved Jobs
        <span className="ml-auto rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">{jobs.length}</span>
      </div>
    </nav>

    <div className="-mt-4 min-h-0 flex-1 overflow-y-auto">
      {jobs.length === 0 ? (
        <p className="px-3 py-2 text-xs leading-relaxed text-muted">Analyses you run are saved here automatically.</p>
      ) : (
        <ul className="space-y-1">
          {jobs.map(job => {
            const active = job.id === activeId;
            return (
              <li key={job.id}>
                <div onClick={() => onSelect(job)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg py-2 pl-10 pr-2 transition-colors ${
                    active ? 'bg-brand-soft' : 'hover:bg-subtle'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-semibold ${active ? 'text-ink' : 'text-body'}`}>{job.title}</p>
                    <p className="truncate text-[11px] text-muted">{job.company}</p>
                  </div>
                  {job.score !== null && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${scoreTone(job.score)}`}>{job.score}</span>
                  )}
                  <button aria-label={`Remove ${job.title}`}
                    onClick={e => { e.stopPropagation(); onDelete(job.id); }}
                    className="text-muted opacity-0 transition-opacity hover:text-bad group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>

    <div className="rounded-xl border border-line bg-gradient-to-br from-brand-soft to-surface p-4">
      <BrainCircuit className="mb-2 h-5 w-5 text-brand" />
      <p className="text-sm font-bold text-ink">Hybrid AI scoring</p>
      <p className="mt-1 text-[11px] leading-relaxed text-body">
        60% embedding similarity + 40% deterministic skill matching, with Gemini-parsed inputs.
      </p>
    </div>
  </aside>
);
