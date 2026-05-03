import { apiClient } from './client';
import { ParsedResume } from '../types';

export const parseResume = async (file: File): Promise<{ resumeId: string; parsed: ParsedResume }> => {
  const form = new FormData();
  form.append('resume', file);
  const res = await apiClient.post('/api/resumes/parse', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { resumeId: res.data.resumeId, parsed: res.data.parsed };
};

export const getResume = async (resumeId: string): Promise<{ resumeId: string; parsed: ParsedResume }> => {
  const res = await apiClient.get(`/api/resumes/${resumeId}`);
  return { resumeId: res.data.resumeId, parsed: res.data.parsed };
};
