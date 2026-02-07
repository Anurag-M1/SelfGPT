from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict

DB_PATH = os.getenv("DB_PATH", "chatbot.db")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);"
        )
        conn.commit()
    finally:
        conn.close()


def list_threads() -> List[str]:
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT DISTINCT thread_id FROM messages ORDER BY MAX(created_at) DESC",
        ).fetchall()
        return [row[0] for row in rows]
    finally:
        conn.close()


def get_messages(thread_id: str) -> List[Dict[str, str]]:
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id",
            (thread_id,),
        ).fetchall()
        return [{"role": role, "content": content} for role, content in rows]
    finally:
        conn.close()


def get_recent_messages(thread_id: str, limit: int = 12) -> List[Dict[str, str]]:
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ?",
            (thread_id, limit),
        ).fetchall()
        rows.reverse()
        return [{"role": role, "content": content} for role, content in rows]
    finally:
        conn.close()


def add_message(thread_id: str, role: str, content: str) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (thread_id, role, content, _utc_now()),
        )
        conn.commit()
    finally:
        conn.close()
