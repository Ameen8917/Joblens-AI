import { AddressInfo } from "net";
import { Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  evaluateExchange: vi.fn(),
  streamFollowUp: vi.fn(),
}));

vi.mock("../src/services/jdParser", () => ({ getJobById: async () => ({ parsed: { title: "Engineer" } }) }));
vi.mock("../src/services/resumeParser", () => ({
  getResumeById: async () => ({ rawText: "", toObject: () => ({ parsed: { skills: [], tools: [], workHistory: [] } }) }),
}));
vi.mock("../src/models/InterviewSession", () => ({ InterviewSession: { findById: mocks.findById } }));
vi.mock("../src/services/interview", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/services/interview")>()),
  evaluateExchange: mocks.evaluateExchange,
  streamFollowUp: mocks.streamFollowUp,
}));

import { createApp } from "../src/app";
import { AppError } from "../src/middleware/errorHandler";

const SESSION_ID = "65a1b2c3d4e5f6a7b8c9d0e1";

const evaluation = (needed: boolean) => ({
  structure: { score: 3, quotes: [], note: "", capped: false }, specifics: { score: 2, quotes: [], note: "", capped: false },
  relevance: { score: 4, quotes: [], note: "", capped: false }, overall: 50, tip: "", consistency: [],
  followUp: { needed, reason: needed ? "vague" : "none" },
});

const makeSession = () => ({
  _id: SESSION_ID, jobId: "j", resumeId: "r", status: "active", report: null,
  exchanges: [{ focus: { kind: "behavioral", requirement: "", bulletId: null, bullet: null }, turns: [{ role: "interviewer", kind: "question", text: "Why?" }], evaluation: null, followUpAsked: false, done: false }],
  markModified: vi.fn(),
  save: vi.fn(),
});

/** Splits a server-sent event stream into its events. */
const events = (body: string) => body.split("\n\n").filter(Boolean).map(block => ({
  event: /^event: (.+)$/m.exec(block)?.[1], data: JSON.parse(/^data: (.+)$/m.exec(block)![1]),
}));

let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const answer = (text: string) => fetch(`${base}/api/interview/sessions/${SESSION_ID}/answers`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
});

describe("POST /api/interview/sessions/:id/answers", () => {
  let session: ReturnType<typeof makeSession>;
  beforeEach(() => {
    vi.resetAllMocks();
    session = makeSession();
    mocks.findById.mockResolvedValue(session);
  });

  it("streams the evaluation, the follow-up as it's written, then the saved session", async () => {
    mocks.evaluateExchange.mockResolvedValue(evaluation(true));
    mocks.streamFollowUp.mockImplementation(async (_jd, _e, _ev, _hint, onChunk: (t: string) => void) => {
      onChunk("What did "); onChunk("you do?");
      return "What did you do?";
    });
    const res = await answer("I helped.");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const received = events(await res.text());
    expect(received.map(e => e.event)).toEqual(["evaluation", "token", "token", "done"]);
    expect(received[0].data).toMatchObject({ index: 0, evaluation: { overall: 50 } });
    const saved = received[3].data.exchanges[0];
    expect(saved.turns.map((t: { kind: string }) => t.kind)).toEqual(["question", "answer", "follow_up"]);
    expect(saved).toMatchObject({ followUpAsked: true, done: false });
    expect(session.save).toHaveBeenCalledTimes(1);
  });

  it("closes the question when no follow-up is needed", async () => {
    mocks.evaluateExchange.mockResolvedValue(evaluation(false));
    const received = events(await (await answer("A full answer.")).text());
    expect(received.map(e => e.event)).toEqual(["evaluation", "done"]);
    expect(received[1].data.exchanges[0].done).toBe(true);
    expect(mocks.streamFollowUp).not.toHaveBeenCalled();
  });

  it("returns an ordinary error and saves nothing when scoring fails", async () => {
    mocks.evaluateExchange.mockRejectedValue(new AppError("The AI service is busy. Please try again shortly.", 503));
    const res = await answer("I helped.");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ success: false, error: expect.stringContaining("busy") });
    expect(session.save).not.toHaveBeenCalled();
  });

  it("closes the question without a follow-up when streaming fails part way", async () => {
    mocks.evaluateExchange.mockResolvedValue(evaluation(true));
    mocks.streamFollowUp.mockImplementation(async (_jd, _e, _ev, _hint, onChunk: (t: string) => void) => {
      onChunk("What did");
      throw new Error("connection reset");
    });
    const received = events(await (await answer("I helped.")).text());
    expect(received.map(e => e.event)).toEqual(["evaluation", "token", "error", "done"]);
    expect(received[3].data.exchanges[0]).toMatchObject({ done: true, followUpAsked: false });
  });

  it("rejects an empty answer, an unknown session and a finished interview", async () => {
    expect((await answer("  ")).status).toBe(400);
    mocks.findById.mockResolvedValue(null);
    expect((await answer("Hi")).status).toBe(404);
    mocks.findById.mockResolvedValue({ ...makeSession(), status: "finished" });
    expect((await answer("Hi")).status).toBe(409);
  });
});
