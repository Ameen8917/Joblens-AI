import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Search, Trash2 } from 'lucide-react';
import { SavedJob } from '../types';

interface Props {
  jobs: SavedJob[];
  onOpen: (job: SavedJob) => void;
  onDelete: (id: string) => void;
}

const FILTERS = [
  { id: 'all',      label: 'All',      test: () => true },
  { id: 'strong',   label: 'Strong',   test: (s: number | null) => s !== null && s >= 75 },
  { id: 'moderate', label: 'Moderate', test: (s: number | null) => s !== null && s >= 50 && s < 75 },
  { id: 'weak',     label: 'Weak',     test: (s: number | null) => s !== null && s < 50 },
];

const tone = (s: number) => (s >= 75 ? 'bg-good-soft text-good' : s >= 50 ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad');

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="card p-4">
    <p className="text-xs text-body">{label}</p>
    <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
  </div>
);

export default function HistoryPage({ jobs, onOpen, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const scores = jobs.map(j => j.score).filter((s): s is number => s !== null);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find(f => f.id === filter)!.test;
    return [...jobs]
      .filter(j => test(j.score) && (!q || `${j.title} ${j.company}`.toLowerCase().includes(q)))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [jobs, query, filter]);

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">History</h1>
        <p className="text-sm text-body">Every job you’ve scored, newest first.</p>
      </div>

      {jobs.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Clock className="h-8 w-8 text-muted" />
          <p className="text-sm text-body">You haven’t analyzed any jobs yet.</p>
          <Link to="/" className="btn-primary">Start an analysis <ArrowRight className="h-4 w-4" /></Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Jobs analyzed" value={String(jobs.length)} />
            <Stat label="Average score" value={scores.length ? String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)) : '—'} />
            <Stat label="Best score" value={scores.length ? String(Math.max(...scores)) : '—'} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title or company" aria-label="Search history"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand-soft" />
            </label>
            <div className="flex gap-1">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f.id ? 'bg-brand-soft text-brand-dark' : 'text-body hover:bg-subtle'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card divide-y divide-line overflow-hidden">
            {visible.length === 0 && <p className="px-5 py-10 text-center text-sm text-body">No jobs match your search.</p>}
            {visible.map(job => (
              <div key={job.id} className="flex items-center gap-4 px-5 py-3.5">
                {job.score !== null
                  ? <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${tone(job.score)}`}>{job.score}</span>
                  : <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-subtle text-sm text-muted">—</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                  <p className="truncate text-xs text-body">{job.company}</p>
                </div>
                <time dateTime={job.savedAt} className="hidden text-xs text-muted sm:block">
                  {new Date(job.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </time>
                <button onClick={() => onOpen(job)} className="btn-secondary px-3 py-1.5 text-xs">Open</button>
                <button onClick={() => onDelete(job.id)} aria-label={`Delete ${job.title}`} className="text-muted transition-colors hover:text-bad">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
