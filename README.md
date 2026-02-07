# SelfGPT

SelfGPT is a private, production‑ready **LangChain + LangSmith** chat application. It ships a Next.js UI with a FastAPI backend, supports multiple LLM providers, PDF‑based RAG, and optional live web search via Google Custom Search. LangSmith tracing is built in for observability when enabled.

## Tech Stack

**Frontend**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Radix UI components

**Backend**
- FastAPI (Python)
- Requests (provider HTTP calls)
- FAISS + SentenceTransformers (RAG)
- LangChain (community loaders/splitters for PDF ingestion)
- LangSmith (tracing + observability)
- Google Custom Search API (web search)

**LLM Providers (OpenAI‑compatible or native)**
- Groq
- OpenAI
- DeepSeek
- xAI Grok
- Anthropic
- Gemini
- Mistral

**LangChain & LangSmith**
- LangChain powers PDF loading, chunking, embeddings, and retrieval for RAG.
- LangSmith provides end‑to‑end tracing for RAG and LLM calls when enabled via environment variables.

## Key Features
- Multi‑provider LLM support with model selection
- PDF upload + retrieval‑augmented generation (RAG)
- Optional web search integration (Google CSE)
- Persistent chat history (SQLite)
- Streaming‑style typewriter responses
- Responsive UI (desktop + mobile)
- Security controls: API key auth, rate limiting, upload limits
- LangSmith observability (optional, secure, key‑gated)

## Project Structure
```
app/                     # Next.js app (UI)
components/              # UI components
context/                 # React contexts (chat, settings, auth)
server.py                # FastAPI backend
rag_engine.py            # RAG pipeline (FAISS + embeddings)
storage.py               # SQLite chat persistence
requirements.txt         # Python deps
package.json             # JS deps
```

## Setup

### 1) Install frontend deps
```bash
npm install
```

### 2) Install backend deps
```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```
**Note:** LangSmith currently does not publish wheels for Python 3.14. If you want tracing enabled, use Python 3.12 or 3.11 for the backend venv.

## Environment Variables
Create `.env` in the project root.

### Required (at least one LLM provider key)
```bash
GROQ_API_KEY=...
# or
OPENAI_API_KEY=...
# or
DEEPSEEK_API_KEY=...
# or
XAI_API_KEY=...
# or
ANTHROPIC_API_KEY=...
# or
GEMINI_API_KEY=...
# or
MISTRAL_API_KEY=...
```

### Web Search (Google CSE)
```bash
GOOGLE_API_KEY=...
GOOGLE_CSE_ID=...   # cx= value from your CSE
```

### LangSmith (Tracing / Observability)
```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=SelfGPT
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

### Backend Defaults / Limits
```bash
DEFAULT_PROVIDER=groq
DEFAULT_MODEL=llama-3.3-70b-versatile
DEFAULT_SYSTEM_PROMPT="You are a helpful assistant."

# Security
SELFGPT_API_KEY=YOUR_INTERNAL_API_KEY
RATE_LIMIT_PER_MIN=60
MAX_UPLOAD_MB=10
MAX_MESSAGE_LEN=6000
MAX_HISTORY_MESSAGES=24

# CORS (add your frontend origin if using a different host)
CORS_ORIGINS=http://localhost:3000

# SQLite DB path (set to a persistent disk on the backend host)
DB_PATH=/var/data/chatbot.db

# Postgres (use this instead of DB_PATH when you don't have a disk)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# RAG store path (set to a persistent disk on the backend host)
RAG_STORE_DIR=/var/data/rag_store
```

### Frontend (optional)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_LLM_PROVIDER=groq
NEXT_PUBLIC_LLM_MODEL=llama-3.3-70b-versatile
NEXT_PUBLIC_SYSTEM_PROMPT="You are a helpful assistant."
NEXT_PUBLIC_USE_WEB=true
NEXT_PUBLIC_API_KEY=YOUR_INTERNAL_API_KEY   # must match SELFGPT_API_KEY if auth is enabled
```
If `NEXT_PUBLIC_API_BASE_URL` is not set, the Next.js dev server will proxy `/api/*` to the FastAPI backend at `http://localhost:8000`.

## Run

### Development (two servers)
```bash
npm run dev:full
```
This starts:
- FastAPI on `http://localhost:8000`
- Next.js on `http://localhost:3000`

## Security Notes (Production‑Grade Defaults)
- **API key auth**: all `/api/*` routes require `SELFGPT_API_KEY` if set.
- **Rate limiting**: per‑IP, per minute.
- **Upload limits**: defaults to 10MB per file.
- **Thread ID sanitization**: prevents path traversal.
- **Safe FAISS loading**: no dangerous deserialization.
- **LangSmith is opt‑in**: tracing only occurs when `LANGSMITH_TRACING=true` and a valid key is set.

## API Endpoints (Backend)
- `GET /api/config` – app + provider config
- `GET /api/models?provider=...` – list models
- `POST /api/chat` – send message
- `POST /api/upload` – upload PDFs
- `GET /api/threads` – list threads
- `GET /api/threads/{thread_id}` – messages
- `GET /api/docs/{thread_id}` – document metadata

## Troubleshooting
- **Hydration warning**: If you see `vsc-initialized` in a hydration error, a browser extension is injecting DOM changes. Disable the extension or use Incognito.

---

If you want a separate production deployment guide (Docker, reverse proxy, TLS, etc.), ask and I’ll add it.
