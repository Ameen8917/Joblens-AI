import { apiClient } from './client';
import { BulletEdit, TailoredScore, TailoringSuggestions } from '../types';

export const suggestRewrites = async (jobId: string, resumeId: string): Promise<TailoringSuggestions> => {
  const { data } = await apiClient.post('/api/tailor/suggest', { jobId, resumeId });
  return { rewrites: data.rewrites, discarded: data.discarded };
};

/** Downloads the resume with the given rewrites as an ATS-friendly file. */
export const downloadTailoredResume = async (resumeId: string, edits: BulletEdit[], format: 'pdf' | 'docx'): Promise<void> => {
  const res = await apiClient.post('/api/tailor/export', { resumeId, edits, format }, { responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? `resume.${format}`;
  const url = URL.createObjectURL(res.data as Blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const scoreTailored =async (jobId: string, resumeId: string, edits: BulletEdit[]): Promise<TailoredScore> => {
  const { data } = await apiClient.post('/api/tailor/score', { jobId, resumeId, edits });
  return { before: data.before, after: data.after, edits: data.edits, evidenceUpgrades: data.evidenceUpgrades };
};
