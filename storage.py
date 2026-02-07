from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict

DB_PATH = os.getenv("DB_PATH", "chatbot.db")
DATABASE_URL = os.getenv("DATABASE_URL")

_IS_POSTGRES = bool(DATABASE_URL)

if _IS_POSTGRES:
    try:
        import psycopg2
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("psycopg2 is required when DATABASE_URL is set") from exc


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect():
    if _IS_POSTGRES:
        return psycopg2.connect(DATABASE_URL)
    return sqlite3.connect(DB_PATH)


def init_db() -> None:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
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
        else:
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
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT thread_id FROM messages GROUP BY thread_id ORDER BY MAX(created_at) DESC",
        ).fetchall()
        return [row[0] for row in rows]
    finally:
        conn.close()


def get_messages(thread_id: str) -> List[Dict[str, str]]:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE thread_id = %s ORDER BY id",
                (thread_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id",
                (thread_id,),
            ).fetchall()
        return [{"role": role, "content": content} for role, content in rows]
    finally:
        conn.close()


def get_recent_messages(thread_id: str, limit: int = 12) -> List[Dict[str, str]]:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE thread_id = %s ORDER BY id DESC LIMIT %s",
                (thread_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ?",
                (thread_id, limit),
            ).fetchall()
        rows.reverse()
        return [{"role": role, "content": content} for role, content in rows]
    finally:
        conn.close()


def add_message(thread_id: str, role: str, content: str) -> None:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            conn.execute(
                "INSERT INTO messages (thread_id, role, content, created_at) VALUES (%s, %s, %s, %s)",
                (thread_id, role, content, _utc_now()),
            )
        else:
            conn.execute(
                "INSERT INTO messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (thread_id, role, content, _utc_now()),
            )
        conn.commit()
    finally:
        conn.close()
