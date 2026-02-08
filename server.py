from __future__ import annotations

import os
import uuid
import time
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

try:
    from langsmith import traceable
except Exception:  # pragma: no cover - optional dependency
    def traceable(*_args, **_kwargs):
        def decorator(func):
            return func
        return decorator

from app_config import (
    APP_NAME,
    APP_VERSION,
    PROMPT_TEMPLATES,
    TECH_STACK,
    DEFAULT_MODEL as APP_DEFAULT_MODEL,
    DEFAULT_SYSTEM_PROMPT as APP_DEFAULT_SYSTEM_PROMPT,
)
from rag_engine import ingest_pdf, retrieve_context, thread_document_metadata
from storage import (
    init_db,
    list_threads,
    get_messages,
    add_message,
    get_recent_messages,
    create_user,
    get_user_by_email,
    get_user_by_id,
)

DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", "groq")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", APP_DEFAULT_MODEL)
DEFAULT_SYSTEM_PROMPT = os.getenv("DEFAULT_SYSTEM_PROMPT", APP_DEFAULT_SYSTEM_PROMPT)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "60"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_MESSAGE_LEN = int(os.getenv("MAX_MESSAGE_LEN", "8000"))
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", "7"))
MAX_HISTORY_MESSAGES = os.getenv("MAX_HISTORY_MESSAGES")
if MAX_HISTORY_MESSAGES is not None:
    try:
        MAX_HISTORY_MESSAGES = int(MAX_HISTORY_MESSAGES)
    except ValueError:
        MAX_HISTORY_MESSAGES = None


def _normalize_cse_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = value.strip()
    if "cx=" in raw or raw.startswith("http"):
        try:
            parsed = urlparse(raw)
            qs = parse_qs(parsed.query)
            cx = (qs.get("cx") or [None])[0]
            return cx or raw
        except Exception:
            return raw
    return raw


_RATE_LIMIT: Dict[str, List[float]] = {}


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_rate_limit(request: Request) -> Optional[JSONResponse]:
    if RATE_LIMIT_PER_MIN <= 0:
        return None
    ip = _client_ip(request)
    now = time.time()
    window_start = now - 60
    bucket = _RATE_LIMIT.get(ip, [])
    bucket = [ts for ts in bucket if ts >= window_start]
    if len(bucket) >= RATE_LIMIT_PER_MIN:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded"})
    bucket.append(now)
    _RATE_LIMIT[ip] = bucket
    return None


def _read_upload_limited(file_obj, max_bytes: int) -> bytes:
    data = bytearray()
    chunk_size = 1024 * 1024
    while True:
        chunk = file_obj.read(chunk_size)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > max_bytes:
            raise ValueError("File too large")
    return bytes(data)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _get_user_from_request(request: Request) -> Optional[Dict[str, str]]:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return get_user_by_id(str(user_id))


def _require_user(request: Request) -> Optional[Dict[str, str]]:
    user = _get_user_from_request(request)
    if not user:
        return None
    return user

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app = FastAPI(title=APP_NAME, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# --------------------
# Provider config
# --------------------
PROVIDERS: Dict[str, Dict[str, str]] = {
    "groq": {
        "label": "Groq",
        "type": "openai",
        "base_url": "https://api.groq.com/openai/v1",
        "models_url": "https://api.groq.com/openai/v1/models",
        "key_env": "GROQ_API_KEY",
    },
    "openai": {
        "label": "OpenAI",
        "type": "openai",
        "base_url": "https://api.openai.com/v1",
        "models_url": "https://api.openai.com/v1/models",
        "key_env": "OPENAI_API_KEY",
    },
    "deepseek": {
        "label": "DeepSeek",
        "type": "openai",
        "base_url": "https://api.deepseek.com",
        "models_url": "https://api.deepseek.com/models",
        "key_env": "DEEPSEEK_API_KEY",
    },
    "grok": {
        "label": "xAI Grok",
        "type": "openai",
        "base_url": "https://api.x.ai/v1",
        "models_url": "https://api.x.ai/v1/models",
        "key_env": "XAI_API_KEY",
    },
    "anthropic": {
        "label": "Anthropic",
        "type": "anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "models_url": "https://api.anthropic.com/v1/models",
        "key_env": "ANTHROPIC_API_KEY",
    },
    "gemini": {
        "label": "Gemini",
        "type": "gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "models_url": "https://generativelanguage.googleapis.com/v1beta/models",
        "key_env": "GEMINI_API_KEY",
    },
    "mistral": {
        "label": "Mistral",
        "type": "openai",
        "base_url": "https://api.mistral.ai/v1",
        "models_url": "https://api.mistral.ai/v1/models",
        "key_env": "MISTRAL_API_KEY",
    },
}


# --------------------
# Helpers
# --------------------

def _get_key(provider_id: str) -> Optional[str]:
    config = PROVIDERS.get(provider_id)
    if not config:
        return None
    return os.getenv(config["key_env"])


@traceable(name="llm_openai_request")
def _openai_request(base_url: str, api_key: str, model: str, messages: List[Dict[str, str]]) -> str:
    url = f"{base_url}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
    }
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


@traceable(name="llm_anthropic_request")
def _anthropic_request(api_key: str, model: str, system_prompt: str, user_content: str) -> str:
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_content}],
    }
    resp = requests.post(
        url,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


@traceable(name="llm_gemini_request")
def _gemini_request(api_key: str, model: str, user_content: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": user_content}]},
        ]
    }
    resp = requests.post(url, params={"key": api_key}, json=payload, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return "No response returned from Gemini."
    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        return "No response returned from Gemini."
    return "".join(part.get("text", "") for part in parts)


@traceable(name="web_search")
def _web_search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    cse_id = _normalize_cse_id(GOOGLE_CSE_ID)
    if not (GOOGLE_API_KEY and cse_id):
        return []
    try:
        params = {
            "key": GOOGLE_API_KEY,
            "cx": cse_id,
            "q": query,
            "num": max_results,
        }
        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", []) or []
        return [
            {
                "title": item.get("title") or "Result",
                "url": item.get("link"),
                "snippet": item.get("snippet") or "",
            }
            for item in items
        ]
    except Exception:
        return []


@traceable(name="build_prompt")
def _build_prompt(
    system_prompt: str,
    user_message: str,
    rag_context: List[str],
    web_results: List[Dict[str, str]],
    history: List[Dict[str, str]],
) -> str:
    sections = []
    if system_prompt:
        sections.append(f"System:\n{system_prompt}")

    if history:
        lines = []
        for item in history:
            role = (item.get("role") or "user").capitalize()
            content = item.get("content") or ""
            if content:
                lines.append(f"{role}: {content}")
        if lines:
            sections.append("Conversation so far:\n" + "\n".join(lines))

    if rag_context:
        context_block = "\n\n".join(rag_context)
        sections.append(f"Document context:\n{context_block}")

    if web_results:
        web_lines = []
        for idx, item in enumerate(web_results, start=1):
            web_lines.append(
                f"{idx}. {item.get('title')}: {item.get('snippet')} ({item.get('url')})"
            )
        sections.append("Web results:\n" + "\n".join(web_lines))

    sections.append(f"User:\n{user_message}")
    return "\n\n".join(sections)


def _normalize_user_id(user_id: Optional[str]) -> str:
    raw = (user_id or "default").strip()
    if not raw:
        return "default"
    return raw


def _scoped_thread_id(user_id: Optional[str], thread_id: str) -> str:
    return f"{_normalize_user_id(user_id)}::{thread_id}"


def _list_models(provider_id: str) -> Dict[str, Any]:
    config = PROVIDERS.get(provider_id)
    if not config:
        return {"error": "Unknown provider"}

    api_key = _get_key(provider_id)
    if not api_key:
        return {"error": f"Missing {config['key_env']}"}

    url = config["models_url"]
    headers = {}
    params = None

    if provider_id == "gemini":
        params = {"key": api_key}
    else:
        headers = {"Authorization": f"Bearer {api_key}"}

    if provider_id == "anthropic":
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    resp = requests.get(url, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if provider_id == "gemini":
        models = [m.get("name", "") for m in data.get("models", [])]
        models = [m.replace("models/", "") for m in models if m]
        return {"models": sorted(set(models))}

    if provider_id == "anthropic":
        models = [m.get("id") for m in data.get("data", []) if m.get("id")]
        return {"models": sorted(set(models))}

    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
    return {"models": sorted(set(models))}


# --------------------
# Routes
# --------------------

@app.get("/")
def index():
    return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}


@app.get("/api/config")
def config():
    return {
        "app": APP_NAME,
        "version": APP_VERSION,
        "templates": PROMPT_TEMPLATES,
        "tech": TECH_STACK,
        "providers": PROVIDERS,
    }

@app.post("/api/auth/signup")
def api_signup(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    name = (payload.get("name") or "").strip()
    if not email or not password or not name:
        return JSONResponse(status_code=400, content={"error": "Missing fields"})
    if get_user_by_email(email):
        return JSONResponse(status_code=409, content={"error": "Email already exists"})
    user_id = str(uuid.uuid4())
    password_hash = _hash_password(password)
    user = create_user(user_id, email, name, password_hash)
    token = _create_token(user_id)
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def api_login(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        return JSONResponse(status_code=400, content={"error": "Missing fields"})
    user = get_user_by_email(email)
    if not user or not _verify_password(password, user.get("password_hash", "")):
        return JSONResponse(status_code=401, content={"error": "Invalid credentials"})
    token = _create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.get("/api/auth/me")
def api_me(request: Request):
    user = _require_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    return {"user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.get("/api/threads")
def api_threads(request: Request):
    err = _check_rate_limit(request)
    if err:
        return err
    user = _require_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    return {"threads": list_threads(user["id"])}


@app.get("/api/threads/{thread_id}")
def api_thread(thread_id: str, request: Request):
    err = _check_rate_limit(request)
    if err:
        return err
    user = _require_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    return {"thread_id": thread_id, "messages": get_messages(user["id"], thread_id)}


@app.post("/api/threads")
def api_new_thread(request: Request):
    err = _check_rate_limit(request)
    if err:
        return err
    return {"thread_id": str(uuid.uuid4())}


@app.get("/api/models")
def api_models(provider: str, request: Request):
    err = _check_rate_limit(request)
    if err:
        return err
    try:
        return _list_models(provider)
    except Exception as exc:
        return {"error": str(exc)}


@app.post("/api/upload")
def api_upload(request: Request, thread_id: str = Form(...), files: List[UploadFile] = File(...)):
    err = _check_rate_limit(request)
    if err:
        return err
    user = _require_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    scoped_thread_id = _scoped_thread_id(user["id"], thread_id)
    summaries = []
    for f in files:
        if f.content_type not in {"application/pdf", "application/x-pdf"}:
            return JSONResponse(status_code=400, content={"error": "Only PDF files are supported."})
        if f.filename and not f.filename.lower().endswith(".pdf"):
            return JSONResponse(status_code=400, content={"error": "Only PDF files are supported."})
        try:
            content = _read_upload_limited(f.file, MAX_UPLOAD_BYTES)
        except ValueError:
            return JSONResponse(status_code=413, content={"error": "File too large"})
        summary = ingest_pdf(content, thread_id=scoped_thread_id, filename=f.filename)
        summaries.append(summary)
    return {"thread_id": thread_id, "summaries": summaries}


@app.get("/api/docs/{thread_id}")
def api_docs(thread_id: str, request: Request):
    err = _check_rate_limit(request)
    if err:
        return err
    user = _require_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    scoped_thread_id = _scoped_thread_id(user["id"], thread_id)
    return {"thread_id": thread_id, "metadata": thread_document_metadata(scoped_thread_id)}


@app.post("/api/chat")
def api_chat(payload: Dict[str, Any], request: Request):
    err = _check_rate_limit(request)
    if err:
        return err
    user = _require_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    thread_id = payload.get("thread_id") or str(uuid.uuid4())
    scoped_thread_id = _scoped_thread_id(user["id"], thread_id)
    provider_id = payload.get("provider") or DEFAULT_PROVIDER
    model = payload.get("model") or DEFAULT_MODEL
    system_prompt = payload.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    user_message = payload.get("message") or ""
    use_web = payload.get("use_web")
    if use_web is None:
        use_web = True
    elif isinstance(use_web, str):
        use_web = use_web.strip().lower() in {"1", "true", "yes", "y"}
    else:
        use_web = bool(use_web)

    if not user_message:
        return JSONResponse(status_code=400, content={"error": "Empty message"})
    if len(user_message) > MAX_MESSAGE_LEN:
        return JSONResponse(status_code=400, content={"error": "Message too long"})

    add_message(user["id"], thread_id, "user", user_message)

    rag = retrieve_context(user_message, scoped_thread_id)
    web_results = _web_search(user_message) if use_web else []

    if MAX_HISTORY_MESSAGES is None:
        history = get_messages(user["id"], thread_id)
    else:
        history = get_recent_messages(user["id"], thread_id, limit=MAX_HISTORY_MESSAGES)
    if history and history[-1].get("role") == "user" and history[-1].get("content") == user_message:
        history = history[:-1]
    prompt = _build_prompt(system_prompt, user_message, rag["context"], web_results, history)

    provider = PROVIDERS.get(provider_id)
    if not provider:
        return JSONResponse(status_code=400, content={"error": "Unknown provider"})

    api_key = _get_key(provider_id)
    if not api_key:
        return JSONResponse(status_code=400, content={"error": f"Missing {provider['key_env']}"})

    try:
        if provider["type"] == "openai":
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ]
            response = _openai_request(provider["base_url"], api_key, model, messages)
        elif provider["type"] == "anthropic":
            response = _anthropic_request(api_key, model, system_prompt, prompt)
        elif provider["type"] == "gemini":
            response = _gemini_request(api_key, model, prompt)
        else:
            response = "Provider not supported."
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})

    add_message(user["id"], thread_id, "assistant", response)

    return {
        "thread_id": thread_id,
        "message": response,
        "citations": rag["citations"],
        "web": web_results,
    }
