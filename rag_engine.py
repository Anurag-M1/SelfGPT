from __future__ import annotations

import json
import os
import tempfile
import hashlib
import re
from datetime import datetime, timezone
from typing import Dict, Optional, Any, List

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

try:
    from langsmith import traceable
except Exception:  # pragma: no cover - optional dependency
    def traceable(*_args, **_kwargs):
        def decorator(func):
            return func
        return decorator

RAG_STORE_DIR = os.getenv("RAG_STORE_DIR", ".rag_store")
EMBEDDINGS_MODEL = os.getenv(
    "EMBEDDINGS_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)

os.makedirs(RAG_STORE_DIR, exist_ok=True)

_THREAD_VECTOR_STORES: Dict[str, FAISS] = {}
_THREAD_METADATA: Dict[str, dict] = {}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


_SAFE_THREAD_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _safe_thread_id(thread_id: str) -> str:
    raw = str(thread_id)
    if _SAFE_THREAD_RE.match(raw):
        return raw
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"thread-{digest}"


def _thread_store_path(thread_id: str) -> str:
    return os.path.join(RAG_STORE_DIR, _safe_thread_id(thread_id))


def _load_thread_metadata(thread_id: str) -> dict:
    path = os.path.join(_thread_store_path(thread_id), "metadata.json")
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {"files": {}}
    return {"files": {}}


def _save_thread_metadata(thread_id: str, metadata: dict) -> None:
    store_path = _thread_store_path(thread_id)
    os.makedirs(store_path, exist_ok=True)
    path = os.path.join(store_path, "metadata.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def _get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=EMBEDDINGS_MODEL)


def _ensure_thread_loaded(thread_id: Optional[str]) -> None:
    if not thread_id:
        return
    if thread_id in _THREAD_VECTOR_STORES:
        return

    store_path = _thread_store_path(thread_id)
    index_path = os.path.join(store_path, "index.faiss")
    if os.path.exists(index_path):
        try:
            store = FAISS.load_local(
                store_path, _get_embeddings(), allow_dangerous_deserialization=False
            )
            _THREAD_VECTOR_STORES[thread_id] = store
        except Exception:
            # If loading fails, treat as missing store.
            pass

    if thread_id not in _THREAD_METADATA:
        _THREAD_METADATA[thread_id] = _load_thread_metadata(thread_id)


@traceable(name="rag_ingest_pdf")
def ingest_pdf(file_bytes: bytes, thread_id: str, filename: Optional[str] = None) -> dict:
    if not file_bytes:
        raise ValueError("No bytes received for ingestion.")

    _ensure_thread_loaded(thread_id)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        loader = PyPDFLoader(temp_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200, separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_documents(docs)

        file_key = filename or os.path.basename(temp_path)
        for idx, doc in enumerate(chunks):
            doc.metadata["source"] = file_key
            doc.metadata["chunk"] = idx

        store = _THREAD_VECTOR_STORES.get(str(thread_id))
        if store is None:
            store = FAISS.from_documents(chunks, _get_embeddings())
            _THREAD_VECTOR_STORES[str(thread_id)] = store
        else:
            store.add_documents(chunks)

        store_path = _thread_store_path(str(thread_id))
        store.save_local(store_path)

        metadata = _THREAD_METADATA.get(str(thread_id), {"files": {}})
        existing = metadata["files"].get(file_key, {})
        added_at = existing.get("added_at", _utc_now())
        metadata["files"][file_key] = {
            "documents": len(docs),
            "chunks": len(chunks),
            "pages": len(docs),
            "added_at": added_at,
            "updated_at": _utc_now(),
        }
        metadata["total_chunks"] = sum(
            f.get("chunks", 0) for f in metadata["files"].values()
        )
        _THREAD_METADATA[str(thread_id)] = metadata
        _save_thread_metadata(str(thread_id), metadata)

        return {
            "filename": file_key,
            "documents": len(docs),
            "chunks": len(chunks),
            "pages": len(docs),
            "total_chunks": metadata.get("total_chunks", len(chunks)),
            "files": list(metadata.get("files", {}).keys()),
        }
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


@traceable(name="rag_retrieve_context")
def retrieve_context(query: str, thread_id: Optional[str], k: int = 4) -> dict:
    retriever = None
    if thread_id:
        _ensure_thread_loaded(thread_id)
        store = _THREAD_VECTOR_STORES.get(str(thread_id))
        if store is not None:
            retriever = store.as_retriever(search_type="similarity", search_kwargs={"k": k})

    if retriever is None:
        return {"context": [], "citations": [], "files": []}

    result = retriever.invoke(query)
    context = [doc.page_content for doc in result]

    citations: List[dict[str, Any]] = []
    for idx, doc in enumerate(result, start=1):
        meta = doc.metadata or {}
        citations.append(
            {
                "id": idx,
                "source": meta.get("source", "document"),
                "page": meta.get("page"),
                "chunk": meta.get("chunk"),
            }
        )

    files = list({c.get("source") for c in citations if c.get("source")})
    return {"context": context, "citations": citations, "files": files}


def thread_document_metadata(thread_id: str) -> dict:
    _ensure_thread_loaded(thread_id)
    return _THREAD_METADATA.get(str(thread_id), {"files": {}})
