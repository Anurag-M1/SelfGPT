from __future__ import annotations

import os

APP_NAME = "SelfGPT"
APP_VERSION = "1.3.0"

MODEL_CHOICES = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
]

DEFAULT_MODEL = os.getenv("GROQ_MODEL", MODEL_CHOICES[0])

DEFAULT_SYSTEM_PROMPT = (
    "You are a precise, fast assistant. Use the provided tools when needed, "
    "cite sources, and keep answers clear and actionable."
)

PROMPT_TEMPLATES = []


TECH_STACK = [
    'Next.js',
    'FastAPI',
    'Groq',
    'Llama 3',
    'LangChain',
    'LangSmith',
    'FAISS',
    'Sentence-Transformers',
]
