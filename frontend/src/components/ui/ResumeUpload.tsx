import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { CircleCheck, CloudUpload, LoaderCircle } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  loading?: boolean;
  parsed?: boolean;
  name?: string;
}

export const ResumeUpload = ({ onFile, loading, parsed, name }: Props) => {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return; }
    setError(null);
    onFile(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handle(file);
    e.target.value = '';
  };
  const input = <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onChange} />;

  if (parsed && name && !loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3.5 animate-fade-up">
        <CircleCheck className="h-6 w-6 flex-shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs text-brand-dark">Resume parsed successfully</p>
        </div>
        <button onClick={() => inputRef.current?.click()} className="btn-secondary px-3 py-1.5 text-xs">Replace</button>
        {input}
      </div>
    );
  }

  return (
    <div>
      <div
        role="button" tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[176px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
          dragging ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand-line hover:bg-brand-soft/40'}`}>
        {loading ? (
          <>
            <LoaderCircle className="h-8 w-8 animate-spin text-brand" />
            <p className="text-sm font-medium text-body">Parsing resume with Gemini…</p>
          </>
        ) : (
          <>
            <CloudUpload className="h-9 w-9 text-brand" strokeWidth={1.75} />
            <p className="text-sm font-semibold text-ink">Drop your resume here or click to upload</p>
            <p className="text-xs text-muted">Supports PDF (max 5MB)</p>
          </>
        )}
        {input}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-bad">{error}</p>}
    </div>
  );
};
