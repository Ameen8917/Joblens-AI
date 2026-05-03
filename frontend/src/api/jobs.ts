import { apiClient } from './client';
import { ParsedJD } from '../types';

export const parseJD = async (text: string): Promise<{ jobId: string; parsed: ParsedJD }> => {
  const res = await apiClient.post('/api/jobs/parse', { text });
  return { jobId: res.data.jobId, parsed: res.data.parsed };
};

export const getJob = async (jobId: string): Promise<{ jobId: string; parsed: ParsedJD }> => {
  const res = await apiClient.get(`/api/jobs/${jobId}`);
  return { jobId: res.data.jobId, parsed: res.data.parsed };
};
