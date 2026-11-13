// Frontend stand-ins for endpoints that don't exist yet. Signatures are async so
// each function can later become an apiClient call without touching the screens.
import {
  InterviewQuestion, MockFeedback, ParsedJD,
} from '../types';

export const SAMPLE_QUESTIONS: InterviewQuestion[] = [
  { type: 'behavioral', question: 'Tell me about yourself.', answerFramework: ['current role', 'relevant experience', 'why this job'] },
  { type: 'behavioral', question: 'Describe a challenging project you worked on.', answerFramework: ['situation', 'task', 'action', 'result'] },
  { type: 'behavioral', question: 'How do you handle tight deadlines?', answerFramework: ['prioritize', 'communicate', 'example', 'outcome'] },
  { type: 'role-specific', question: 'Why do you want to work here?', answerFramework: ['company', 'mission', 'skills', 'growth'] },
  { type: 'technical', question: 'Walk me through a technical decision you made.', answerFramework: ['options', 'tradeoffs', 'decision', 'result'] },
];

const STOP_WORDS = new Set(['that', 'this', 'with', 'your', 'have', 'from', 'what', 'when', 'were', 'they', 'about', 'would', 'which', 'tell', 'describe']);
const terms = (text: string) => (text.toLowerCase().match(/[a-z0-9+#]{3,}/g) ?? []).filter(w => !STOP_WORDS.has(w));
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Rule-based placeholder for an LLM evaluation.
export const evaluateAnswer = async (
  question: InterviewQuestion, answer: string, jd?: ParsedJD | null,
): Promise<MockFeedback> => {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim()).length;
  const connectors = (answer.toLowerCase().match(/\b(first|then|because|so|finally|result|next)\b/g) ?? []).length;

  const structure = clamp(Math.min(sentences, 4) * 12.5 + Math.min(connectors, 4) * 12.5);
  const content = clamp((words / 120) * 85 + (/\d/.test(answer) ? 15 : 0));

  const expected = new Set(terms([question.question, ...question.answerFramework, ...(jd?.requiredSkills ?? [])].join(' ')));
  const said = new Set(terms(answer));
  const hits = [...expected].filter(t => said.has(t)).length;
  const relevance = clamp((hits / Math.max(Math.min(expected.size, 8), 1)) * 100);

  const tips: string[] = [];
  if (structure < 60) tips.push('Give your answer a clear order: situation, what you did, then the result.');
  if (content < 60) tips.push(/\d/.test(answer) ? 'Add more detail about what you personally did.' : 'Add specifics, ideally a number that shows the impact.');
  if (relevance < 60) tips.push('Tie your answer more directly to the question and the skills this job needs.');
  if (!tips.length) tips.push('Strong answer. Practise saying it in under two minutes.');

  return { overall: clamp((structure + content + relevance) / 3), structure, content, relevance, tips };
};
