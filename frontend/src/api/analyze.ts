import { apiClient } from './client';
import { AnalysisMode, ScoreBreakdown } from '../types';

export const analyze = async <T>(mode: AnalysisMode, jobId: string, resumeId: string): Promise<T> => {
  const res = await apiClient.post('/api/analyze', { mode, jobId, resumeId });
  return res.data.data as T;
};

export const scoreOnly = async (jobId: string, resumeId: string): Promise<ScoreBreakdown> => {
  const res = await apiClient.post('/api/analyze/score-only', { jobId, resumeId });
  return res.data.scoreBreakdown as ScoreBreakdown;
};
