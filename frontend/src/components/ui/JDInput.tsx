import { useState, ChangeEvent } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  loading?: boolean;
  parsed?: boolean;
  title?: string;
  company?: string;
}

export const JDInput = ({ onSubmit, loading, parsed, title, company }: Props) => {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const MIN = 50;

  if (parsed && title && !editing) {
    return (
      <div className="glass-elevated rounded-xl px-5 py-4 flex items-center gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span className="font-mono font-bold" style={{ color: 'var(--score-high)' }}>✓</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{company}</p>
        </div>
        <button onClick={() => setEditing(true)}
          className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--bg-border)', color: 'var(--text-secondary)' }}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="glass-elevated rounded-xl p-5 space-y-3 animate-fade-up">
      <label className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        Paste Job Description
      </label>
      <textarea
        value={text}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        placeholder="Paste the full job description here…"
        rows={7}
        className="w-full resize-none rounded-lg px-4 py-3 text-sm font-mono leading-relaxed outline-none transition-colors"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--bg-border)',
          color: 'var(--text-primary)',
          caretColor: 'var(--accent-amber)',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent-amber)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--bg-border)')}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono" style={{ color: text.length < MIN ? 'var(--score-low)' : 'var(--text-muted)' }}>
          {text.length} / {MIN} min chars
        </span>
        <button
          onClick={() => { if (text.trim().length >= MIN) { onSubmit(text.trim()); setEditing(false); } }}
          disabled={text.trim().length < MIN || loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold font-mono transition-all duration-200 disabled:opacity-40"
          style={{ background: 'var(--accent-amber)', color: '#0a0a0a' }}>
          {loading ? 'Parsing…' : 'Parse JD →'}
        </button>
      </div>
    </div>
  );
};
