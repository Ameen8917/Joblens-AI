import { useRef, useState, DragEvent, ChangeEvent } from 'react';

interface Props {
  onFile: (file: File) => void;
  loading?: boolean;
  parsed?: boolean;
  name?: string;
}

export const ResumeUpload = ({ onFile, loading, parsed, name }: Props) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    if (file.type !== 'application/pdf') return alert('Please upload a PDF file.');
    onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handle(file);
  };

  if (parsed && name) {
    return (
      <div className="glass-elevated rounded-xl px-5 py-4 flex items-center gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span className="font-mono font-bold" style={{ color: 'var(--score-high)' }}>✓</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
          <p className="text-xs font-mono" style={{ color: 'var(--score-high)' }}>Resume parsed successfully</p>
        </div>
        <button onClick={() => inputRef.current?.click()}
          className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--bg-border)', color: 'var(--text-secondary)' }}>
          Replace
        </button>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onChange} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="glass-elevated rounded-xl px-5 py-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
      style={{
        border: `2px dashed ${dragging ? 'var(--accent-amber)' : 'var(--bg-border)'}`,
        background: dragging ? 'rgba(245,158,11,0.04)' : undefined,
      }}>
      {loading ? (
        <>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-amber)', borderTopColor: 'transparent' }} />
          <p className="text-xs font-mono shimmer-text">Parsing resume with Gemini…</p>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-border)' }}>
            <span className="font-mono text-lg" style={{ color: 'var(--text-secondary)' }}>⬆</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drop your resume PDF</p>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>or click to browse · max 5MB</p>
          </div>
        </>
      )}
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onChange} />
    </div>
  );
};
