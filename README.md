# ◎ JobLens AI

> **Know your fit before you apply.**

A structured job-fit intelligence tool built with the MERN stack, TypeScript, and Google Gemini AI. JobLens goes beyond keyword matching — it parses both your resume and the job description into structured JSON, scores the match using a hybrid semantic + programmatic engine, and delivers four distinct AI-powered analysis modes.

---

## ✦ Features

### Hybrid Scoring Engine
- **Programmatic score (40%)** — direct skill array comparison with alias matching (e.g. `node` → `node.js`, `aws` → `amazon web services`)
- **Semantic score (60%)** — vector embeddings via `text-embedding-004` + cosine similarity to catch conceptual matches keyword search misses
- Single weighted final score (0–100) with a full breakdown

### Four AI Analysis Modes
| Mode | Output |
|------|--------|
| **Fit Analysis** | Score card + 3 strengths + 3 gaps + one-line verdict |
| **Gap Analysis** | Prioritized missing skills with specific actionable fixes |
| **Cover Letter** | Tailored letter citing your actual projects and experience |
| **Interview Prep** | 9 questions (behavioral / technical / role-specific) with resume-specific answer frameworks |

### Smart Parsing Pipeline
- JD text → Gemini Flash → structured JSON (required skills, nice-to-have, YOE, tools, culture signals, responsibilities)
- PDF resume → `pdf-parse` → Gemini Flash → structured JSON (skills, tools, work history, projects, education)
- Both stored in MongoDB Atlas with vector embeddings for semantic retrieval

### Job Tracker Sidebar
- Every analyzed job saved automatically with its score badge
- Switch between saved jobs instantly — no re-parsing
- Up to 20 jobs tracked per session

---

## ⬡ Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | MongoDB Atlas |
| AI Model | Google Gemini 1.5 Flash |
| Embeddings | text-embedding-004 |
| PDF Parsing | pdf-parse |
| Validation | Zod |
| File Upload | Multer |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| HTTP Client | Axios |
| Routing | React Router v6 |
| Fonts | Sora + IBM Plex Mono |

---

## ◎ Project Structure

```
joblens-ai/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # MongoDB Atlas connection
│   │   │   └── gemini.ts          # Gemini Flash + embedding init
│   │   ├── models/
│   │   │   ├── Job.ts             # Job schema (raw + parsed JSON + embedding)
│   │   │   └── Resume.ts          # Resume schema (raw + parsed JSON + embedding)
│   │   ├── services/
│   │   │   ├── jdParser.ts        # JD text → Gemini → structured JSON
│   │   │   ├── resumeParser.ts    # PDF → pdf-parse → Gemini → structured JSON
│   │   │   ├── scorer.ts          # Hybrid scoring engine (cosine + programmatic)
│   │   │   └── modePrompts.ts     # 4 mode-specific Gemini prompts
│   │   ├── routes/
│   │   │   ├── jobs.ts            # POST /api/jobs/parse, GET /api/jobs/:id
│   │   │   ├── resumes.ts         # POST /api/resumes/parse, GET /api/resumes/:id
│   │   │   └── analyze.ts         # POST /api/analyze, POST /api/analyze/score-only
│   │   ├── middleware/
│   │   │   ├── upload.ts          # Multer PDF config (5MB, memory storage)
│   │   │   └── errorHandler.ts    # Global error handler + asyncHandler wrapper
│   │   ├── types/index.ts         # All shared TypeScript interfaces
│   │   ├── app.ts                 # Express app setup + CORS + routes
│   │   └── server.ts              # Entry point — DB + Gemini init + listen
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── client.ts          # Axios instance with proxy
    │   │   ├── jobs.ts            # parseJD, getJob
    │   │   ├── resumes.ts         # parseResume (multipart)
    │   │   └── analyze.ts         # analyze (4 modes), scoreOnly
    │   ├── components/ui/
    │   │   ├── ScoreCard.tsx      # Score circle + semantic/programmatic bars
    │   │   ├── SkillGrid.tsx      # ✓ matched / ~ partial / ✗ missing pills
    │   │   ├── ModeTabs.tsx       # 4-tab switcher
    │   │   ├── ModeResults.tsx    # FitResult, GapResult, CoverLetterResult, InterviewResult
    │   │   ├── JDInput.tsx        # Textarea → collapses to badge on parse
    │   │   ├── ResumeUpload.tsx   # Drag-and-drop PDF zone
    │   │   └── JobSidebar.tsx     # Saved jobs with score badges
    │   ├── pages/
    │   │   └── Analyze.tsx        # Main page — full analysis flow
    │   ├── types/index.ts         # Frontend TypeScript types
    │   └── index.css              # CSS variables + animations
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    └── .env.example
```

---

## ▶ Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Google Gemini API key — [get one here](https://aistudio.google.com/app/apikey)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/joblens-ai.git
cd joblens-ai
```

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
```

Fill in your `.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/joblens?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_URL=http://localhost:5173
```

```bash
npm install
npm run dev
```

Backend runs at `http://localhost:5000`

### 3. Setup Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

> The Vite dev server proxies all `/api/*` requests to `localhost:5000` — no CORS config needed during development.

---

## ↑ API Reference

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs/parse` | Parse raw JD text → structured JSON + jobId |
| `GET` | `/api/jobs/:id` | Retrieve a previously parsed JD |

**Request — POST /api/jobs/parse**
```json
{
  "text": "We are looking for a Senior React Developer..."
}
```

**Response**
```json
{
  "success": true,
  "jobId": "664f1a2b3c4d5e6f7a8b9c0d",
  "parsed": {
    "title": "Senior React Developer",
    "company": "Acme Corp",
    "roleType": "IC",
    "requiredSkills": ["react", "typescript", "node.js"],
    "niceToHaveSkills": ["docker", "aws"],
    "yearsOfExperience": 3,
    "tools": ["jira", "figma"],
    "culturalSignals": ["fast-paced", "remote-first"],
    "responsibilities": ["Build scalable frontend components", "..."]
  }
}
```

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/resumes/parse` | Upload PDF → structured JSON + resumeId |
| `GET` | `/api/resumes/:id` | Retrieve a previously parsed resume |

**Request — POST /api/resumes/parse**
```
Content-Type: multipart/form-data
Field: resume (PDF file, max 5MB)
```

### Analyze
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Run a mode (fit / gaps / cover-letter / interview) |
| `POST` | `/api/analyze/score-only` | Get score without running a Gemini mode |

**Request — POST /api/analyze**
```json
{
  "mode": "fit",
  "jobId": "664f1a2b3c4d5e6f7a8b9c0d",
  "resumeId": "664f1a2b3c4d5e6f7a8b9c0e"
}
```

**Modes:** `fit` · `gaps` · `cover-letter` · `interview`

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |

---

## ◈ Scoring Logic

```
Final Score = (Semantic Score × 0.60) + (Programmatic Score × 0.40)
```

**Programmatic Score** — compares `jd.requiredSkills[]` against `resume.skills[] + resume.tools[]`
- Exact match or alias match → full credit
- Partial word overlap → 0.5 credit
- No match → 0 credit
- Score = earned credits / total required skills × 100

**Semantic Score** — cosine similarity between JD and resume embeddings
- Embeddings generated with `text-embedding-004`
- Similarity remapped from [-1, 1] to [0, 100]
- Catches conceptual matches that keyword comparison misses

**Score Interpretation**
| Score | Label |
|-------|-------|
| 75–100 | Strong Match |
| 50–74 | Moderate Match |
| 0–49 | Weak Match |

---

## ⚙ Environment Variables

### Backend `.env`
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `CLIENT_URL` | Frontend URL for CORS (default: http://localhost:5173) |

### Frontend `.env`
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (default: http://localhost:5000) |

---

## ⚠ Known Limitations

- **Scanned PDFs** are not supported — resume must be a text-based PDF
- **Gemini rate limits** — free tier has RPM limits; add retry logic for production
- **No auth** — MVP has no user accounts; saved jobs are stored in browser localStorage
- **MongoDB Vector Search index** must be created manually in Atlas UI for semantic search to work (the app falls back to cosine similarity computed in-memory for MVP)

---

## ✦ Roadmap

- [ ] User authentication (JWT)
- [ ] Export cover letter as `.docx`, interview prep as PDF
- [ ] Atlas Vector Search index for server-side semantic retrieval
- [ ] Multi-resume support (compare different resume versions against same JD)
- [ ] LinkedIn JD import via URL
- [ ] Deployment guide (Railway / Render)

---

## △ Author

**Ameen** — Senior Full-Stack & AI Engineer

Built with React · Express · MongoDB Atlas · Google Gemini AI · TypeScript

---

## ✦ License

MIT — free to use, modify, and distribute.