# JobLens AI walkthrough: transcript

Narrated walkthrough of the running app, 4:40 long. Voice: Microsoft neural voice en-US-AndrewNeural, generated from the script in [demo/narration.json](../demo/narration.json).
Every result on screen is a real Gemini 2.5 Flash response, recorded once and replayed so the screen keeps time with the voice.

**0:00 · Introduction**  
This is JobLens AI, a job-fit tool built on Google's Gemini models. Instead of matching keywords, it uses a large language model to turn a resume and a job description into structured data. Then it scores, explains and coaches, with plain code checking the model's work at every step.

**0:18 · Resume parsing**  
First, I upload a resume as a PDF. Gemini 2.5 Flash reads the PDF directly, as a multimodal model, and returns JSON that must match a strict schema. Every response is validated with Zod, and invalid output is retried.

**0:36 · Job description parsing**  
Next, the job description. The same structured-output pipeline extracts the required skills, years of experience, seniority, location and visa rules.

**0:47 · Hybrid score and evidence**  
The match score is hybrid. Sixty percent is semantic: both documents are embedded with Gemini's embedding model and compared by cosine similarity. Forty percent is deterministic skill matching. Requirement checks are plain rules. Here the resume shows 3.8 years against the five the job asks for, so it's flagged, even though every skill matches. And each matched skill is backed by a quote that the backend found in the PDF's own text, so the model can't invent evidence.

**1:17 · Fit analysis**  
Now the generation modes. Fit analysis asks Gemini for strengths, gaps and a one-line verdict, grounded in the parsed resume and the score.

**1:31 · Gap analysis**  
Gap analysis ranks what's missing by priority, with a concrete fix for each one.

**1:45 · Resume tailoring**  
Resume tailoring is where hallucination control matters most. Gemini rewrites work bullets for this job, then code compares every rewrite with the original. A vague claim like improving reliability, which the resume doesn't back up, gets flagged for review. Accepted rewrites are rescored with the real scorer. Rewording moves the score by a point, not by ten. Then the tailored resume exports as an ATS-friendly Word or PDF file.

**2:13 · Cover letter**  
The cover letter is generated from the candidate's actual experience, citing real projects and numbers instead of generic phrases.

**2:28 · Interview prep**  
Interview prep produces nine behavioral, technical and role-specific questions, each with an answer framework tied to this resume.

**2:55 · Mock interview**  
The live mock interview is planned by Gemini from the resume and the job. About half the questions dig into specific lines on the resume.

**3:04 · Answer scoring and resume check**  
I'll answer the first question, and deliberately claim five million transactions a day, when the resume says two million. The answer is scored on a rubric. Any score above three must quote my own words, and code confirms each quote. The consistency check catches the mismatch, and because of it, the interviewer streams a follow-up over server-sent events.

**3:24 · Streamed follow-up**  
I correct the figure, and the feedback updates to cover both answers.

**3:37 · Second answer**  
The second question is about the PostgreSQL work. This time the numbers match the resume, and the answer scores higher.

**3:55 · Interview report**  
The final report is built in code from the stored scores: results for each criterion, the strongest and weakest answers, and what to practise.

**4:04 · A weaker match**  
For contrast, the same resume against a frontend role scores much lower, because both the semantic match and the skill match drop.

**4:15 · History**  
Every analysis is saved with its score.

**4:19 · Evaluation and wrap-up**  
Behind all of this is an evaluation harness. It runs the real Gemini pipeline over hand-labelled resume and job pairs, measures extraction, quote checks and ranking, and fails if quality drops below the baseline. That's JobLens AI: generative AI, with code that checks its work.
