import { useState } from 'react';
import { ArrowRight, CircleCheck, LoaderCircle } from 'lucide-react';

interface Props {
  onSubmit: (text: string) => void;
  loading?: boolean;
  parsed?: boolean;
  title?: string;
  company?: string;
}

const MIN = 50;

export const JDInput = ({ onSubmit, loading, parsed, title, company }: Props) => {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  if (parsed && title && !editing && !loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3.5 animate-fade-up">
        <CircleCheck className="h-6 w-6 flex-shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-brand-dark">{company}</p>
        </div>
        <button onClick={() => setEditing(true)} className="btn-secondary px-3 py-1.5 text-xs">Edit</button>
      </div>
    );
  }

  const ready = text.trim().length >= MIN;
  return (
    <div className="flex min-h-[176px] flex-col rounded-xl border border-line bg-surface focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste the full job description here…"
        aria-label="Job description"
        rows={5}
        className="w-full flex-1 resize-none rounded-t-xl bg-transparent px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-muted"
      />
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <span className={`text-xs ${ready ? 'text-muted' : 'text-warn'}`}>
          {ready ? `${text.trim().length} characters` : `${MIN - text.trim().length} more characters needed`}
        </span>
        <button
          onClick={() => { if (ready) { onSubmit(text.trim()); setEditing(false); } }}
          disabled={!ready || loading}
          className="btn-primary px-3 py-1.5 text-xs">
          {loading ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Parsing…</> : <>Parse JD <ArrowRight className="h-3.5 w-3.5" /></>}
        </button>
      </div>
    </div>
  );
};
