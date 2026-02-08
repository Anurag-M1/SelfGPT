from __future__ import annotations

import os
import re
import hashlib
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict, Optional

DB_PATH = os.getenv("DB_PATH", "chatbot.db")
DATABASE_URL = os.getenv("DATABASE_URL")

_IS_POSTGRES = bool(DATABASE_URL)

if _IS_POSTGRES:
    try:
        import psycopg
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("psycopg is required when DATABASE_URL is set") from exc


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect():
    if _IS_POSTGRES:
        return psycopg.connect(DATABASE_URL)
    return sqlite3.connect(DB_PATH)


_SAFE_USER_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _normalize_user_id(user_id: str | None) -> str:
    raw = (user_id or "default").strip()
    if not raw:
        return "default"
    if _SAFE_USER_RE.match(raw):
        return raw
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"user-{digest}"


def _scoped_thread_id(user_id: str | None, thread_id: str) -> str:
    return f"{_normalize_user_id(user_id)}::{thread_id}"


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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
        conn.commit()
    finally:
        conn.close()


def create_user(user_id: str, email: str, name: str, password_hash: str) -> Dict[str, str]:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            conn.execute(
                "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (%s, %s, %s, %s, %s)",
                (user_id, email, name, password_hash, _utc_now()),
            )
        else:
            conn.execute(
                "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, email, name, password_hash, _utc_now()),
            )
        conn.commit()
        return {"id": user_id, "email": email, "name": name}
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[Dict[str, str]]:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            row = conn.execute(
                "SELECT id, email, name, password_hash FROM users WHERE email = %s",
                (email,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, email, name, password_hash FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        if not row:
            return None
        return {"id": row[0], "email": row[1], "name": row[2], "password_hash": row[3]}
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> Optional[Dict[str, str]]:
    conn = _connect()
    try:
        if _IS_POSTGRES:
            row = conn.execute(
                "SELECT id, email, name, password_hash FROM users WHERE id = %s",
                (user_id,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, email, name, password_hash FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        if not row:
            return None
        return {"id": row[0], "email": row[1], "name": row[2], "password_hash": row[3]}
    finally:
        conn.close()


def list_threads(user_id: str | None) -> List[str]:
    conn = _connect()
    prefix = f"{_normalize_user_id(user_id)}::"
    try:
        if _IS_POSTGRES:
            rows = conn.execute(
                "SELECT thread_id FROM messages WHERE thread_id LIKE %s GROUP BY thread_id ORDER BY MAX(created_at) DESC",
                (f"{prefix}%",),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT thread_id FROM messages WHERE thread_id LIKE ? GROUP BY thread_id ORDER BY MAX(created_at) DESC",
                (f"{prefix}%",),
            ).fetchall()
        return [row[0][len(prefix):] for row in rows]
    finally:
        conn.close()


def get_messages(user_id: str | None, thread_id: str) -> List[Dict[str, str]]:
    conn = _connect()
    scoped = _scoped_thread_id(user_id, thread_id)
    try:
        if _IS_POSTGRES:
            rows = conn.execute(
                "SELECT role, content, created_at FROM messages WHERE thread_id = %s ORDER BY id",
                (scoped,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT role, content, created_at FROM messages WHERE thread_id = ? ORDER BY id",
                (scoped,),
            ).fetchall()
        return [
            {"role": role, "content": content, "created_at": created_at}
            for role, content, created_at in rows
        ]
    finally:
        conn.close()


def get_recent_messages(user_id: str | None, thread_id: str, limit: int = 12) -> List[Dict[str, str]]:
    conn = _connect()
    scoped = _scoped_thread_id(user_id, thread_id)
    try:
        if _IS_POSTGRES:
            rows = conn.execute(
                "SELECT role, content, created_at FROM messages WHERE thread_id = %s ORDER BY id DESC LIMIT %s",
                (scoped, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT role, content, created_at FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ?",
                (scoped, limit),
            ).fetchall()
        rows.reverse()
        return [
            {"role": role, "content": content, "created_at": created_at}
            for role, content, created_at in rows
        ]
    finally:
        conn.close()


def add_message(user_id: str | None, thread_id: str, role: str, content: str) -> None:
    conn = _connect()
    scoped = _scoped_thread_id(user_id, thread_id)
    try:
        if _IS_POSTGRES:
            conn.execute(
                "INSERT INTO messages (thread_id, role, content, created_at) VALUES (%s, %s, %s, %s)",
                (scoped, role, content, _utc_now()),
            )
        else:
            conn.execute(
                "INSERT INTO messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                (scoped, role, content, _utc_now()),
            )
        conn.commit()
    finally:
        conn.close()
