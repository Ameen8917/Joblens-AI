import { apiClient } from './client';
import { AnswerEvaluation, InterviewSessionState } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const toState = (data: InterviewSessionState): InterviewSessionState => ({
  sessionId: data.sessionId, jobId: data.jobId, resumeId: data.resumeId,
  status: data.status, exchanges: data.exchanges, report: data.report,
});

export const startInterview = async (jobId: string, resumeId: string, questionCount: number): Promise<InterviewSessionState> =>
  toState((await apiClient.post('/api/interview/sessions', { jobId, resumeId, questionCount })).data);

export const skipQuestion = async (sessionId: string): Promise<InterviewSessionState> =>
  toState((await apiClient.post(`/api/interview/sessions/${sessionId}/skip`)).data);

export const finishInterview = async (sessionId: string): Promise<InterviewSessionState> =>
  toState((await apiClient.post(`/api/interview/sessions/${sessionId}/finish`)).data);

export interface AnswerHandlers {
  onEvaluation: (index: number, evaluation: AnswerEvaluation) => void;
  onToken: (text: string) => void;
  onStreamError: (message: string) => void;
}

/**
 * Sends an answer and reads the server-sent events in the response: the evaluation, then the follow-up question as
 * it streams. EventSource can't send a POST body, so this reads the fetch stream directly. Resolves with the saved session.
 */
export const submitAnswer = async (sessionId: string, text: string, handlers: AnswerHandlers): Promise<InterviewSessionState> => {
  const res = await fetch(`${BASE_URL}/api/interview/sessions/${sessionId}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  // Scoring failures arrive as ordinary JSON errors, before the stream starts.
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let final: InterviewSessionState | null = null;
  const handle = (block: string) => {
    const event = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];
    if (!event || !data) return;
    const payload = JSON.parse(data);
    if (event === 'evaluation') handlers.onEvaluation(payload.index, payload.evaluation);
    else if (event === 'token') handlers.onToken(payload.text);
    else if (event === 'error') handlers.onStreamError(payload.message);
    else if (event === 'done') final = toState(payload);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      handle(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
    }
  }
  if (buffer.trim()) handle(buffer);
  if (!final) throw new Error('The connection closed before the interview was saved. Reload to see where you are.');
  return final;
};
