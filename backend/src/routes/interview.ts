import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { InterviewSession, IInterviewSession } from "../models/InterviewSession";
import { getJobById } from "../services/jdParser";
import { getResumeById } from "../services/resumeParser";
import {
  buildReport, DEFAULT_QUESTIONS, evaluateExchange, MAX_ANSWER_CHARS, MAX_QUESTIONS, MIN_QUESTIONS, planInterview, streamFollowUp,
} from "../services/interview";
import { InterviewSessionState, ParsedResume } from "../types";

const router = Router();

const toState = (session: IInterviewSession): InterviewSessionState => ({
  sessionId: String(session._id),
  jobId: session.jobId,
  resumeId: session.resumeId,
  status: session.status,
  exchanges: session.exchanges,
  report: session.report,
});

const getSession = async (id: string): Promise<IInterviewSession> => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Interview not found: ${id}`, 404);
  const session = await InterviewSession.findById(id);
  if (!session) throw new AppError(`Interview not found: ${id}`, 404);
  return session;
};

router.post("/sessions", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object({
    jobId: z.string().min(1), resumeId: z.string().min(1),
    questionCount: z.number().int().min(MIN_QUESTIONS).max(MAX_QUESTIONS).default(DEFAULT_QUESTIONS),
  }).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.issues[0].message, 400);
  const [job, resume] = await Promise.all([getJobById(body.data.jobId), getResumeById(body.data.resumeId)]);
  const exchanges = await planInterview(job.parsed, resume.toObject().parsed as ParsedResume, body.data.questionCount);
  const session = await InterviewSession.create({ jobId: body.data.jobId, resumeId: body.data.resumeId, exchanges });
  res.status(201).json({ success: true, ...toState(session) });
}));

router.get("/sessions/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  res.json({ success: true, ...toState(await getSession(req.params.id)) });
}));

/**
 * Answers the current question. Scoring happens before the response starts, so a failure there is an ordinary error
 * and the answer isn't saved. Then the response becomes a server-sent event stream:
 *   evaluation  the checked scores for this exchange
 *   token       a piece of the follow-up question, when there is one
 *   error       the follow-up failed part way; the exchange is closed without it
 *   done        the session as saved
 */
router.post("/sessions/:id/answers", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = z.object({
    text: z.string().trim().min(1, "Answer can't be empty").max(MAX_ANSWER_CHARS, `Keep answers under ${MAX_ANSWER_CHARS} characters`),
  }).safeParse(req.body);
  if (!body.success) throw new AppError(body.error.issues[0].message, 400);
  const session = await getSession(req.params.id);
  if (session.status === "finished") throw new AppError("This interview has finished", 409);
  const index = session.exchanges.findIndex(e => !e.done);
  if (index < 0) throw new AppError("Every question has been answered. Finish the interview to see the report.", 409);

  const [job, resume] = await Promise.all([getJobById(session.jobId), getResumeById(session.resumeId)]);
  const parsed = resume.toObject().parsed as ParsedResume;
  const exchange = { ...session.exchanges[index], turns: [...session.exchanges[index].turns, { role: "candidate" as const, kind: "answer" as const, text: body.data.text }] };
  const evaluation = await evaluateExchange(job.parsed, parsed, resume.rawText, exchange);

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("evaluation", { index, evaluation });

  let updated = { ...exchange, evaluation, done: !evaluation.followUp.needed };
  if (evaluation.followUp.needed) {
    try {
      const question = await streamFollowUp(job.parsed, exchange, evaluation, "", text => send("token", { text }));
      updated = question
        ? { ...updated, followUpAsked: true, turns: [...updated.turns, { role: "interviewer", kind: "follow_up", text: question }] }
        : { ...updated, done: true };
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : "The follow-up question failed" });
      updated = { ...updated, done: true };
    }
  }
  session.exchanges[index] = updated;
  session.markModified("exchanges");
  await session.save();
  send("done", toState(session));
  res.end();
}));

/** Closes the current question without an answer, for when the candidate wants to move on. */
router.post("/sessions/:id/skip", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const session = await getSession(req.params.id);
  const index = session.exchanges.findIndex(e => !e.done);
  if (session.status === "finished" || index < 0) throw new AppError("There's no open question to skip", 409);
  session.exchanges[index] = { ...session.exchanges[index], done: true };
  session.markModified("exchanges");
  await session.save();
  res.json({ success: true, ...toState(session) });
}));

router.post("/sessions/:id/finish", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const session = await getSession(req.params.id);
  session.report = buildReport(session.exchanges);
  session.status = "finished";
  session.markModified("report");
  await session.save();
  res.json({ success: true, ...toState(session) });
}));

export default router;
