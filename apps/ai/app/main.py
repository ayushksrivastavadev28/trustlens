
import asyncio
import importlib.util
import ipaddress
import math
import os
import re
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional, Sequence, Tuple, Union

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None  # type: ignore[assignment]

try:
    import tldextract
except Exception:  # pragma: no cover
    tldextract = None  # type: ignore[assignment]

try:
    import whois
except Exception:  # pragma: no cover
    whois = None  # type: ignore[assignment]

load_dotenv()

app = FastAPI(title="TrustLens AI")

AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
MODEL_MODE = os.getenv("MODEL_MODE", "hf_api").lower()
LOG_LEVEL = os.getenv("LOG_LEVEL", "info").lower()

SMS_MODEL = os.getenv(
    "SMS_MODEL_ID",
    "mariagrandury/distilbert-base-uncased-finetuned-sms-spam-detection",
)
SMS_MODEL_ALT_1 = os.getenv(
    "SMS_MODEL_ALT_1_ID",
    "AventIQ-AI/SMS-Spam-Detection-Model",
)
SMS_MODEL_ALT_2 = os.getenv(
    "SMS_MODEL_ALT_2_ID",
    "mrm8488/bert-tiny-finetuned-enron-spam-detection",
)
PHISH_MODEL = os.getenv(
    "PHISH_MODEL_ID",
    "cybersectony/phishing-email-detection-distilbert_v2.1",
)
PHISH_MODEL_ALT_1 = os.getenv(
    "PHISH_MODEL_ALT_1_ID",
    "aamoshdahal/email-phishing-distilbert-finetuned",
)
JOB_SCAM_MODEL = os.getenv("JOB_SCAM_MODEL_ID", "").strip()
BEHAVIOR_MODEL = os.getenv(
    "BEHAVIOR_MODEL_ID",
    "tasksource/deberta-small-long-nli",
)
EMBED_MODEL = os.getenv(
    "EMBED_MODEL_ID",
    "intfloat/multilingual-e5-small",
)
INDIC_BERT_MODEL = os.getenv(
    "INDIC_BERT_MODEL_ID",
    "ai4bharat/indic-bert",
)

SMS_ENSEMBLE_MODELS = [SMS_MODEL, SMS_MODEL_ALT_1, SMS_MODEL_ALT_2]
PHISH_ENSEMBLE_MODELS = [PHISH_MODEL, PHISH_MODEL_ALT_1]

def _is_placeholder_secret(value: str) -> bool:
    candidate = (value or "").strip().lower()
    return not candidate or "replace_with" in candidate or "your_" in candidate


USE_HF_API = MODEL_MODE == "hf_api" and not _is_placeholder_secret(HF_API_TOKEN)
MAX_URLS = 5
HF_API_TIMEOUT_SECONDS = 45.0
URL_TIMEOUT_SECONDS = 4.0
URL_MAX_REDIRECTS = 5

TACTIC_LABELS = [
    "urgency",
    "authority",
    "fear",
    "scarcity",
    "reward",
    "impersonation",
    "payment_request",
    "credential_harvest",
]

SUSPICIOUS_TLDS = {
    "xyz",
    "top",
    "zip",
    "mov",
    "icu",
    "cfd",
    "gq",
    "tk",
    "click",
    "rest",
    "cyou",
    "work",
}

RISK_TERMS = [
    "otp",
    "verify",
    "urgent",
    "click",
    "payment",
    "upi",
    "bank",
    "suspend",
    "limited time",
    "invoice",
    "kyc",
    "credential",
    "password",
]

JOB_SCAM_TERMS = [
    "internship fee",
    "registration fee",
    "application fee",
    "training fee",
    "joining fee",
    "security deposit",
    "placement fee",
    "pay to unlock offer",
    "whatsapp interview",
    "guaranteed placement",
    "instant offer letter",
    "work from home salary",
    "resume shortlist charge",
    "background check fee",
    "limited seats pay now",
    "immediate joining pay",
    "refund after joining",
    "इंटर्नशिप फीस",
    "रजिस्ट्रेशन शुल्क",
    "जॉइनिंग फीस",
    "सिक्योरिटी डिपॉजिट",
]

HIGHLIGHT_PATTERNS: Sequence[Tuple[str, str]] = [
    (r"\bOTP\b|one[- ]time password", "otp"),
    (r"\bUPI\b|upi id|vpa", "upi"),
    (r"urgent|immediately|act now|within \d+ (minutes|hours)", "urgency"),
    (r"click here|verify now|login now|update now|open link", "action"),
    (r"payment|pay now|processing fee|charges|pending invoice", "payment"),
    (r"limited time|expires|last chance|offer ends", "scarcity"),
    (r"refund|cashback|reward|prize|lottery|winner", "reward"),
]


class AnalyzeInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    inputType: Literal["sms", "email", "message"]
    urls: List[str] = Field(default_factory=list)
    locale: Literal["en", "hi", "auto"] = "auto"
    requestId: str


class ProofCard(BaseModel):
    title: str
    detail: str
    severity: Literal["low", "med", "high"]
    tags: List[str]


class Highlight(BaseModel):
    start: int
    end: int
    label: str


class URLIntelItem(BaseModel):
    url: str
    finalUrl: str
    redirects: int
    https: bool
    domainAgeDays: Optional[int]
    flags: List[str]


class AnalyzeOutput(BaseModel):
    requestId: str
    trustScore: float
    riskLevel: Literal["LOW", "MEDIUM", "HIGH"]
    summary: str
    proof: List[ProofCard]
    highlights: List[Highlight]
    behavior: Dict[str, object]
    urlIntel: Dict[str, object]
    classifiers: Dict[str, object]
    embedding: List[float]
    suggestedActions: List[str]
    safeRewrite: Optional[str]


_http = httpx.AsyncClient(
    timeout=httpx.Timeout(URL_TIMEOUT_SECONDS, connect=URL_TIMEOUT_SECONDS)
)
_hf_disabled_models: set[str] = set()

_behavior_pipe = None
_embedder = None
_classifier_pipes: Dict[str, object] = {}
_feature_pipes: Dict[str, object] = {}
_interpreters: Dict[str, object] = {}


def _log(message: str) -> None:
    if LOG_LEVEL not in {"silent", "none"}:
        print(f"[trustlens-ai] {message}")


def _module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _normalize(vec: Sequence[float]) -> List[float]:
    clean = [float(v) for v in vec]
    norm = math.sqrt(sum(v * v for v in clean)) or 1.0
    return [v / norm for v in clean]


def _resize_vector(vec: Sequence[float], target_dim: int) -> List[float]:
    if np is None:
        folded = [0.0] * target_dim
        for idx, value in enumerate(vec):
            folded[idx % target_dim] += float(value)
        return _normalize(folded)

    source = np.array(vec, dtype=float).flatten()
    if source.size == 0:
        return [0.0] * target_dim
    if source.size == target_dim:
        return _normalize(source.tolist())

    bins = np.linspace(0, source.size, target_dim + 1, dtype=int)
    folded: List[float] = []
    for i in range(target_dim):
        start, end = bins[i], bins[i + 1]
        if end <= start:
            folded.append(float(source[start % source.size]))
        else:
            folded.append(float(source[start:end].mean()))
    return _normalize(folded)


def _is_indic_text(text: str) -> bool:
    return bool(re.search(r"[\u0900-\u0D7F]", text))


def _risk_from_label(label: str, score: float) -> float:
    normalized = (label or "").lower()
    risky = any(
        token in normalized
        for token in ("spam", "phish", "fraud", "malicious", "scam", "label_1", "yes")
    )
    safe = any(token in normalized for token in ("ham", "legit", "label_0", "no", "safe"))
    if risky:
        return _clip(score)
    if safe:
        return _clip(1 - score)
    return _clip(score)


def _cheap_embedding(text: str, dims: int = 384) -> List[float]:
    vec = [0.0] * dims
    for token in re.findall(r"[a-z0-9]+", text.lower()):
        vec[hash(token) % dims] += 1.0
    return _normalize(vec)


def _heuristic_text_classifier(
    text: str,
    kind: Literal["sms", "email", "job"],
) -> Dict[str, Union[float, str]]:
    lower = text.lower()
    if kind == "job":
        hit_count = sum(1 for term in JOB_SCAM_TERMS if term in lower)
        risk = _clip(0.15 + 0.11 * hit_count)
        label = "job_scam" if hit_count >= 1 else "legit_job"
        score = risk if label == "job_scam" else 1 - risk
        return {"label": label, "score": float(_clip(score))}

    hit_count = sum(1 for term in RISK_TERMS if term in lower)
    risk = _clip(0.14 + 0.12 * hit_count)
    if kind == "sms":
        label = "spam" if hit_count >= 2 else "ham"
    else:
        label = "phishing" if hit_count >= 2 else "legit"
    score = risk if label in {"spam", "phishing"} else 1 - risk
    return {"label": label, "score": float(_clip(score))}


def _heuristic_behavior(text: str) -> Dict[str, object]:
    lower = text.lower()
    hits: Dict[str, float] = {}
    heuristic_map: Dict[str, Sequence[str]] = {
        "urgency": ("urgent", "immediately", "act now", "expires"),
        "authority": ("government", "bank", "police", "customs"),
        "fear": ("blocked", "suspended", "penalty", "legal action"),
        "scarcity": ("limited time", "last chance", "only today"),
        "reward": ("prize", "winner", "reward", "lottery", "cashback"),
        "impersonation": ("official", "support team", "verified account"),
        "payment_request": ("payment", "upi", "fee", "transfer"),
        "credential_harvest": ("password", "otp", "verify account", "login now"),
    }
    for label, cues in heuristic_map.items():
        if any(cue in lower for cue in cues):
            hits[label] = 0.58

    tactics = list(hits.keys())
    confidence = max(hits.values()) if hits else 0.22
    return {"tactics": tactics, "confidence": float(_clip(confidence))}


def _job_keyword_signal(text: str) -> Dict[str, object]:
    lower = text.lower()
    hits = [term for term in JOB_SCAM_TERMS if term in lower]
    risk = _clip(0.1 + 0.1 * len(hits))
    return {
        "hits": hits[:8],
        "risk": float(risk),
    }


def _parse_hf_classification(data: object) -> Dict[str, Union[float, str]]:
    if isinstance(data, list) and data and isinstance(data[0], list):
        data = data[0]
    if isinstance(data, list) and data:
        top = max(
            [entry for entry in data if isinstance(entry, dict)],
            key=lambda item: float(item.get("score", 0)),
            default={"label": "unknown", "score": 0},
        )
        return {
            "label": str(top.get("label", "unknown")),
            "score": float(top.get("score", 0.0)),
        }
    if isinstance(data, dict) and "label" in data and "score" in data:
        return {"label": str(data["label"]), "score": float(data["score"])}
    return {"label": "unknown", "score": 0.0}


def _parse_zero_shot_result(data: object) -> Dict[str, List[object]]:
    if not isinstance(data, dict):
        return {"labels": [], "scores": []}
    labels = [str(label) for label in (data.get("labels") or [])]
    scores = [float(score) for score in (data.get("scores") or [])]
    return {"labels": labels, "scores": scores}


def _pool_embedding(raw: object) -> Optional[List[float]]:
    if np is None:
        if isinstance(raw, list):
            flat: List[float] = []
            stack = [raw]
            while stack:
                current = stack.pop()
                if isinstance(current, list):
                    stack.extend(current)
                else:
                    try:
                        flat.append(float(current))
                    except Exception:
                        pass
            if flat:
                return _normalize(flat[:384])
        return None

    try:
        arr = np.array(raw, dtype=float)
    except Exception:
        return None
    if arr.size == 0:
        return None
    if arr.ndim == 3:
        arr = arr[0]
    if arr.ndim == 2:
        vec = arr.mean(axis=0)
    elif arr.ndim == 1:
        vec = arr
    else:
        return None
    return _normalize(vec.tolist())


async def _hf_inference(model_id: str, payload: dict) -> object:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not configured")
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    body = {
        **payload,
        "options": {"wait_for_model": True, "use_cache": True},
    }

    urls = [f"https://router.huggingface.co/hf-inference/models/{model_id}"]

    last_error: Optional[str] = None
    for endpoint in urls:
        for attempt in range(3):
            response = await _http.post(
                endpoint,
                json=body,
                headers=headers,
                timeout=HF_API_TIMEOUT_SECONDS,
            )
            if response.status_code in {429, 503, 504} and attempt < 2:
                await asyncio.sleep(1 + attempt)
                continue

            text = response.text[:220]
            if not response.is_success:
                last_error = text
                # Retry only transient failures, not auth/not-found/bad-request errors.
                if response.status_code >= 500 and attempt < 2:
                    await asyncio.sleep(1 + attempt)
                    continue
                break

            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                err = str(data.get("error"))
                last_error = err
                if "router.huggingface.co" in err and "api-inference.huggingface.co" in endpoint:
                    break
                if attempt < 2:
                    await asyncio.sleep(1 + attempt)
                    continue
                break
            return data
    if last_error:
        raise RuntimeError(f"{model_id} inference failed: {last_error}")
    raise RuntimeError(f"{model_id} inference failed after retries")


async def _hf_feature_extraction(model_id: str, text: str) -> object:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not configured")
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    body = {
        "inputs": text,
        "options": {"wait_for_model": True, "use_cache": True},
    }

    urls = [f"https://router.huggingface.co/hf-inference/pipeline/feature-extraction/{model_id}"]
    last_error: Optional[str] = None
    for endpoint in urls:
        response = await _http.post(
            endpoint,
            json=body,
            headers=headers,
            timeout=HF_API_TIMEOUT_SECONDS,
        )
        if not response.is_success:
            last_error = response.text[:220]
            continue
        data = response.json()
        if isinstance(data, dict) and data.get("error"):
            last_error = str(data.get("error"))
            continue
        return data
    if last_error:
        raise RuntimeError(f"{model_id} feature extraction failed: {last_error}")
    raise RuntimeError(f"{model_id} feature extraction failed")


def _get_text_classifier_pipe(model_id: str):
    if model_id in _classifier_pipes:
        return _classifier_pipes[model_id]
    from transformers import pipeline

    _classifier_pipes[model_id] = pipeline(
        "text-classification",
        model=model_id,
        truncation=True,
        top_k=None,
    )
    return _classifier_pipes[model_id]


def _get_behavior_pipe():
    global _behavior_pipe
    if _behavior_pipe is None:
        from transformers import pipeline

        _behavior_pipe = pipeline(
            "zero-shot-classification",
            model=BEHAVIOR_MODEL,
        )
    return _behavior_pipe


def _get_feature_pipe(model_id: str):
    if model_id in _feature_pipes:
        return _feature_pipes[model_id]
    from transformers import pipeline

    _feature_pipes[model_id] = pipeline(
        "feature-extraction",
        model=model_id,
        truncation=True,
    )
    return _feature_pipes[model_id]


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _build_interpreter(model_id: str):
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    from transformers_interpret import SequenceClassificationExplainer

    model = AutoModelForSequenceClassification.from_pretrained(model_id)
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    return SequenceClassificationExplainer(model, tokenizer)


def _proof_tokens(text: str, preferred_model: str) -> List[str]:
    if USE_HF_API:
        return []
    if MODEL_MODE != "local":
        return []
    if not _module_available("transformers_interpret"):
        return []

    try:
        if preferred_model not in _interpreters:
            _interpreters[preferred_model] = _build_interpreter(preferred_model)
        explainer = _interpreters[preferred_model]
        attributions = explainer(text)
        ranked = sorted(attributions, key=lambda pair: abs(pair[1]), reverse=True)
        tokens: List[str] = []
        for token, _score in ranked:
            clean = token.strip()
            if not clean or clean in {"[CLS]", "[SEP]"}:
                continue
            if clean not in tokens:
                tokens.append(clean)
            if len(tokens) >= 6:
                break
        return tokens
    except Exception as exc:
        _log(f"transformers-interpret unavailable for proof mode: {exc}")
        return []


async def _classify_with_model(
    model_id: str,
    text: str,
    fallback_kind: Literal["sms", "email", "job"],
) -> Dict[str, object]:
    fallback = _heuristic_text_classifier(text, fallback_kind)
    model_ref = model_id or "heuristic"

    if not model_id:
        risk = _risk_from_label(str(fallback["label"]), float(fallback["score"]))
        return {
            "model": model_ref,
            "label": fallback["label"],
            "score": float(fallback["score"]),
            "risk": float(risk),
            "source": "heuristic",
        }

    if USE_HF_API and model_id not in _hf_disabled_models:
        try:
            result = await _hf_inference(model_id, {"inputs": text})
            parsed = _parse_hf_classification(result)
            risk = _risk_from_label(str(parsed["label"]), float(parsed["score"]))
            return {
                "model": model_id,
                "label": parsed["label"],
                "score": float(parsed["score"]),
                "risk": float(risk),
                "source": "hf_api",
            }
        except Exception as exc:
            _hf_disabled_models.add(model_id)
            _log(f"HF model failed for {model_id}: {exc}")

    if MODEL_MODE == "local" and _module_available("transformers"):
        try:
            pipe = _get_text_classifier_pipe(model_id)
            parsed = _parse_hf_classification(pipe(text))
            risk = _risk_from_label(str(parsed["label"]), float(parsed["score"]))
            return {
                "model": model_id,
                "label": parsed["label"],
                "score": float(parsed["score"]),
                "risk": float(risk),
                "source": "local",
            }
        except Exception as exc:
            _log(f"Local model failed for {model_id}: {exc}")

    risk = _risk_from_label(str(fallback["label"]), float(fallback["score"]))
    return {
        "model": model_id,
        "label": fallback["label"],
        "score": float(fallback["score"]),
        "risk": float(risk),
        "source": "heuristic",
    }


def _aggregate_binary_classifier(
    records: List[Dict[str, object]],
    risky_label: str,
    safe_label: str,
) -> Dict[str, object]:
    if not records:
        return {"label": safe_label, "score": 0.5, "risk": 0.5, "ensemble": []}

    risks = [float(item.get("risk", 0.5)) for item in records]
    avg_risk = _clip(sum(risks) / len(risks))
    label = risky_label if avg_risk >= 0.5 else safe_label
    score = avg_risk if label == risky_label else (1 - avg_risk)
    return {
        "label": label,
        "score": float(_clip(score)),
        "risk": float(avg_risk),
        "ensemble": records,
    }


async def _job_scam_zero_shot(text: str) -> Dict[str, object]:
    payload = {
        "inputs": text,
        "parameters": {
            "candidate_labels": [
                "fake internship or job scam",
                "legitimate job opportunity",
            ],
            "multi_label": False,
        },
    }
    parsed = {"labels": [], "scores": []}
    source = "none"

    if USE_HF_API and BEHAVIOR_MODEL not in _hf_disabled_models:
        try:
            parsed = _parse_zero_shot_result(await _hf_inference(BEHAVIOR_MODEL, payload))
            source = "hf_api"
        except Exception as exc:
            _log(f"Zero-shot job scam check failed on HF API: {exc}")

    if not parsed["labels"] and MODEL_MODE == "local" and _module_available("transformers"):
        try:
            pipe = _get_behavior_pipe()
            result = pipe(
                text,
                candidate_labels=payload["parameters"]["candidate_labels"],
                multi_label=False,
            )
            parsed = _parse_zero_shot_result(result)
            source = "local"
        except Exception as exc:
            _log(f"Zero-shot job scam check failed locally: {exc}")

    if not parsed["labels"]:
        return {"risk": 0.0, "source": source}

    labels = parsed["labels"]
    scores = parsed["scores"]
    risk = 0.0
    if labels and scores:
        top_label = labels[0].lower()
        top_score = float(scores[0])
        if "scam" in top_label or "fake" in top_label:
            risk = top_score
        else:
            risk = 1 - top_score
    return {"risk": float(_clip(risk)), "source": source}


async def detect_job_scam(text: str) -> Dict[str, object]:
    keyword = _job_keyword_signal(text)
    signals: List[Dict[str, object]] = [
        {
            "model": "keyword-job-signal",
            "label": "job_scam" if float(keyword["risk"]) >= 0.5 else "legit_job",
            "score": float(keyword["risk"] if float(keyword["risk"]) >= 0.5 else 1 - float(keyword["risk"])),
            "risk": float(keyword["risk"]),
            "source": "heuristic",
        }
    ]

    if JOB_SCAM_MODEL:
        model_result = await _classify_with_model(JOB_SCAM_MODEL, text, "job")
        signals.append(model_result)

    zero_shot = await _job_scam_zero_shot(text)
    if float(zero_shot.get("risk", 0.0)) > 0:
        signals.append(
            {
                "model": "tasksource/deberta-small-long-nli::job-zero-shot",
                "label": "job_scam" if float(zero_shot["risk"]) >= 0.5 else "legit_job",
                "score": float(
                    zero_shot["risk"] if float(zero_shot["risk"]) >= 0.5 else 1 - float(zero_shot["risk"])
                ),
                "risk": float(zero_shot["risk"]),
                "source": str(zero_shot.get("source", "none")),
            }
        )

    aggregate = _aggregate_binary_classifier(signals, "job_scam", "legit_job")
    aggregate["keywordHits"] = keyword["hits"]
    return aggregate


async def classify_sms(text: str) -> Dict[str, object]:
    tasks = [
        _classify_with_model(model_id, text, "sms")
        for model_id in SMS_ENSEMBLE_MODELS
        if model_id
    ]
    members = await asyncio.gather(*tasks) if tasks else []
    aggregate = _aggregate_binary_classifier(members, "spam", "ham")
    return {
        "label": aggregate["label"],
        "score": float(aggregate["score"]),
        "model": "sms-ensemble",
        "ensemble": aggregate["ensemble"],
    }


async def classify_phishing(text: str) -> Dict[str, object]:
    tasks = [
        _classify_with_model(model_id, text, "email")
        for model_id in PHISH_ENSEMBLE_MODELS
        if model_id
    ]
    members = await asyncio.gather(*tasks) if tasks else []
    aggregate = _aggregate_binary_classifier(members, "phishing", "legit")
    job_scam = await detect_job_scam(text)

    # Blend phishing score with job-scam-specific signal for recruitment scam scenarios.
    final_risk = _clip(0.8 * float(aggregate["risk"]) + 0.2 * float(job_scam["risk"]))
    label = "phishing" if final_risk >= 0.5 else "legit"
    score = final_risk if label == "phishing" else 1 - final_risk

    return {
        "label": label,
        "score": float(_clip(score)),
        "model": "phishing-ensemble",
        "ensemble": aggregate["ensemble"],
        "jobScam": job_scam,
    }


async def classify_behavior(text: str) -> Dict[str, object]:
    parsed = {"labels": [], "scores": []}

    if USE_HF_API and BEHAVIOR_MODEL not in _hf_disabled_models:
        try:
            result = await _hf_inference(
                BEHAVIOR_MODEL,
                {
                    "inputs": text,
                    "parameters": {
                        "candidate_labels": TACTIC_LABELS,
                        "multi_label": True,
                    },
                },
            )
            parsed = _parse_zero_shot_result(result)
        except Exception as exc:
            _log(f"HF behavior model failed ({exc}); falling back.")
            _hf_disabled_models.add(BEHAVIOR_MODEL)

    if (
        not parsed["labels"]
        and MODEL_MODE == "local"
        and _module_available("transformers")
    ):
        try:
            pipe = _get_behavior_pipe()
            result = pipe(text, candidate_labels=TACTIC_LABELS, multi_label=True)
            parsed = _parse_zero_shot_result(result)
        except Exception as exc:
            _log(f"Local behavior model failed ({exc}); heuristic fallback.")

    if not parsed["labels"]:
        return _heuristic_behavior(text)

    tactics = [
        label
        for label, score in zip(parsed["labels"], parsed["scores"])
        if float(score) >= 0.45
    ]
    confidence = max(parsed["scores"] or [0.0])
    return {"tactics": tactics, "confidence": float(_clip(confidence))}


async def _embed_indic(text: str) -> Optional[List[float]]:
    if USE_HF_API and INDIC_BERT_MODEL not in _hf_disabled_models:
        try:
            result = await _hf_feature_extraction(INDIC_BERT_MODEL, text)
            pooled = _pool_embedding(result)
            if pooled:
                return pooled
            raise RuntimeError("Indic embedding response shape was invalid")
        except Exception as exc:
            _log(f"IndicBERT HF embedding failed ({exc}); falling back.")
            _hf_disabled_models.add(INDIC_BERT_MODEL)

    if MODEL_MODE == "local" and _module_available("transformers"):
        try:
            pipe = _get_feature_pipe(INDIC_BERT_MODEL)
            pooled = _pool_embedding(pipe(text))
            if pooled:
                return pooled
        except Exception as exc:
            _log(f"IndicBERT local embedding failed ({exc}).")

    return None


async def embed_text(text: str, locale: Literal["en", "hi", "auto"] = "auto") -> List[float]:
    e5_input = f"query: {text}"
    base_embedding: Optional[List[float]] = None

    if USE_HF_API and EMBED_MODEL not in _hf_disabled_models:
        try:
            result = await _hf_inference(EMBED_MODEL, {"inputs": [e5_input]})
            pooled = _pool_embedding(result)
            if pooled:
                base_embedding = pooled
            else:
                result = await _hf_feature_extraction(EMBED_MODEL, e5_input)
                pooled = _pool_embedding(result)
                if pooled:
                    base_embedding = pooled
                else:
                    raise RuntimeError("Embedding response shape was invalid")
        except Exception as exc:
            _log(f"HF embedding failed ({exc}); falling back.")
            _hf_disabled_models.add(EMBED_MODEL)

    if base_embedding is None and MODEL_MODE == "local" and _module_available("sentence_transformers"):
        try:
            embedder = _get_embedder()
            vec = embedder.encode([e5_input], normalize_embeddings=True)[0].tolist()
            base_embedding = [float(v) for v in vec]
        except Exception as exc:
            _log(f"Local embedding failed ({exc}); cheap embedding fallback.")
            base_embedding = _cheap_embedding(text)

    if base_embedding is None:
        base_embedding = _cheap_embedding(text)

    use_indic = locale == "hi" or (locale == "auto" and _is_indic_text(text))
    if use_indic:
        indic_embedding = await _embed_indic(text)
        if indic_embedding:
            resized_indic = _resize_vector(indic_embedding, len(base_embedding))
            mixed = [
                (0.7 * float(base_embedding[i])) + (0.3 * float(resized_indic[i]))
                for i in range(len(base_embedding))
            ]
            return _normalize(mixed)

    return base_embedding


def find_highlights(text: str) -> List[Dict[str, object]]:
    spans: List[Dict[str, object]] = []
    for pattern, label in HIGHLIGHT_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            spans.append(
                {
                    "start": int(match.start()),
                    "end": int(match.end()),
                    "label": label,
                }
            )
    spans.sort(key=lambda item: (int(item["start"]), int(item["end"])))
    return spans[:30]


def _normalize_url(value: str) -> Optional[str]:
    candidate = (value or "").strip()
    if not candidate:
        return None
    if not re.match(r"^https?://", candidate, flags=re.IGNORECASE):
        candidate = f"http://{candidate}"
    try:
        parsed = httpx.URL(candidate)
        if parsed.host is None:
            return None
        return str(parsed)
    except Exception:
        return None


def _url_flags(original_url: str, final_url: str, redirects: int) -> List[str]:
    flags: List[str] = []
    if redirects > 2:
        flags.append("many_redirects")
    if not final_url.lower().startswith("https://"):
        flags.append("no_https")
    if len(original_url) > 120:
        flags.append("long_url")

    try:
        host = httpx.URL(final_url).host or ""
    except Exception:
        host = ""

    if host:
        if "xn--" in host.lower():
            flags.append("punycode")

        try:
            ipaddress.ip_address(host)
            flags.append("ip_url")
        except ValueError:
            pass

        if tldextract is not None:
            extracted = tldextract.extract(final_url)
            tld = extracted.suffix.lower()
            if tld in SUSPICIOUS_TLDS:
                flags.append("suspicious_tld")

    return flags


def _domain_age_days(url: str) -> Optional[int]:
    if whois is None or tldextract is None:
        return None
    try:
        host = httpx.URL(url).host
        if not host:
            return None
        extracted = tldextract.extract(url)
        domain = extracted.top_domain_under_public_suffix or host
        record = whois.whois(domain)
        created = record.creation_date
        if isinstance(created, list):
            created = created[0]
        if created is None:
            return None
        if isinstance(created, str):
            created = datetime.fromisoformat(created)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - created.astimezone(timezone.utc)
        if delta.days < 0:
            return None
        return int(delta.days)
    except Exception:
        return None


def _url_item_risk(flags: List[str], age_days: Optional[int], redirects: int) -> float:
    risk = 0.0
    risk += 0.16 * len(flags)
    if age_days is not None and age_days < 90:
        risk += 0.22
    if redirects >= 4:
        risk += 0.1
    return _clip(risk)


async def _analyze_single_url(raw_url: str) -> Dict[str, object]:
    normalized = _normalize_url(raw_url)
    if not normalized:
        return {
            "url": raw_url,
            "finalUrl": raw_url,
            "redirects": 0,
            "https": False,
            "domainAgeDays": None,
            "flags": ["invalid_url"],
            "_risk": 0.45,
        }

    final_url = normalized
    redirects = 0
    try:
        response = await _http.head(
            normalized,
            follow_redirects=True,
            max_redirects=URL_MAX_REDIRECTS,
            timeout=URL_TIMEOUT_SECONDS,
        )
        final_url = str(response.url)
        redirects = len(response.history)
    except Exception:
        final_url = normalized
        redirects = 0

    flags = _url_flags(normalized, final_url, redirects)
    try:
        age_days = await asyncio.wait_for(
            asyncio.to_thread(_domain_age_days, final_url),
            timeout=2.0,
        )
    except Exception:
        age_days = None
    item_risk = _url_item_risk(flags, age_days, redirects)
    return {
        "url": normalized,
        "finalUrl": final_url,
        "redirects": redirects,
        "https": final_url.lower().startswith("https://"),
        "domainAgeDays": age_days,
        "flags": flags,
        "_risk": item_risk,
    }


async def analyze_urls(urls: List[str]) -> Dict[str, object]:
    cleaned = [item.strip() for item in urls if item and item.strip()]
    if not cleaned:
        return {"overallRisk": 0, "items": []}

    cleaned = cleaned[:MAX_URLS]
    items = await asyncio.gather(*[_analyze_single_url(url) for url in cleaned])
    item_risks = [float(item.get("_risk", 0.0)) for item in items]
    overall = int(round((sum(item_risks) / max(1, len(item_risks))) * 100))
    for item in items:
        item.pop("_risk", None)

    return {"overallRisk": overall, "items": items}


def _build_graph_features(
    url_items: List[Dict[str, object]],
    text_risk: float,
    behavior_risk: float,
) -> List[List[float]]:
    rows: List[List[float]] = []
    if not url_items:
        return [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, text_risk, behavior_risk]]

    for item in url_items:
        flags = set(item.get("flags", []))
        age_days = item.get("domainAgeDays")
        redirects = int(item.get("redirects", 0))
        age_risk = 1.0 if isinstance(age_days, int) and age_days < 90 else 0.0
        rows.append(
            [
                _clip(redirects / URL_MAX_REDIRECTS),
                1.0 if "no_https" in flags else 0.0,
                1.0 if "ip_url" in flags else 0.0,
                1.0 if "suspicious_tld" in flags else 0.0,
                1.0 if "long_url" in flags else 0.0,
                1.0 if "punycode" in flags else 0.0,
                age_risk,
                text_risk,
                behavior_risk,
            ]
        )
    return rows


def _heuristic_graph_risk(features: List[List[float]]) -> float:
    if np is None:
        flat = [value for row in features for value in row]
        if not flat:
            return 0.0
        return _clip(sum(flat) / len(flat))

    arr = np.array(features, dtype=float)
    if arr.size == 0:
        return 0.0
    center = arr.mean(axis=0)
    distances = np.linalg.norm(arr - center, axis=1)
    if float(distances.max()) > 0:
        distances = distances / float(distances.max())
    base = float(distances.mean()) if distances.size else 0.0
    flag_density = float(arr[:, :7].mean()) if arr.ndim == 2 else 0.0
    return _clip(0.55 * flag_density + 0.45 * base)


def _pygod_graph_risk(features: List[List[float]]) -> Optional[float]:
    if np is None:
        return None
    if not (_module_available("pygod") and _module_available("torch_geometric")):
        return None
    try:
        import torch
        from pygod.detector import DOMINANT
        from torch_geometric.data import Data

        x = torch.tensor(features, dtype=torch.float32)
        node_count = x.shape[0]

        edges: List[List[int]] = []
        for i in range(node_count):
            for j in range(node_count):
                if i != j and (abs(i - j) == 1 or node_count <= 3):
                    edges.append([i, j])
        if not edges:
            edges = [[0, 0]]

        edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
        data = Data(x=x, edge_index=edge_index)

        detector = DOMINANT(epoch=12, verbose=0)
        detector.fit(data)

        raw_scores = getattr(detector, "decision_score_", None)
        if raw_scores is None:
            raw_scores = detector.decision_function(data)

        score_arr = np.array(raw_scores, dtype=float).flatten()
        if score_arr.size == 0:
            return None
        min_score = float(score_arr.min())
        max_score = float(score_arr.max())
        if max_score - min_score < 1e-9:
            normalized = np.ones_like(score_arr) * 0.5
        else:
            normalized = (score_arr - min_score) / (max_score - min_score)
        return _clip(float(normalized.mean()))
    except Exception as exc:
        _log(f"PyGOD scoring failed ({exc}); using heuristic graph risk.")
        return None


def compute_graph_risk(
    url_items: List[Dict[str, object]],
    text_risk: float,
    behavior_risk: float,
) -> float:
    features = _build_graph_features(url_items, text_risk, behavior_risk)
    pygod_risk = _pygod_graph_risk(features)
    if pygod_risk is not None:
        return pygod_risk
    return _heuristic_graph_risk(features)


def _format_ensemble_detail(items: List[Dict[str, object]], limit: int = 4) -> str:
    parts: List[str] = []
    for item in items[:limit]:
        model = str(item.get("model", "model"))
        risk = float(item.get("risk", 0.0)) * 100
        source = str(item.get("source", "na"))
        short_name = model.split("/")[-1]
        parts.append(f"{short_name}: {risk:.0f}% ({source})")
    return "; ".join(parts) if parts else "fallback heuristic"


def _build_proof_cards(
    text: str,
    sms: Dict[str, object],
    phish: Dict[str, object],
    behavior: Dict[str, object],
    url_intel: Dict[str, object],
    highlights: List[Dict[str, object]],
    graph_risk: float,
    locale: Literal["en", "hi", "auto"],
) -> List[Dict[str, object]]:
    cards: List[Dict[str, object]] = []

    sms_risk = _risk_from_label(str(sms["label"]), float(sms["score"]))
    phish_risk = _risk_from_label(str(phish["label"]), float(phish["score"]))
    sms_ensemble = [item for item in sms.get("ensemble", []) if isinstance(item, dict)]
    phish_ensemble = [item for item in phish.get("ensemble", []) if isinstance(item, dict)]

    cards.append(
        {
            "title": "SMS/WhatsApp smishing ensemble",
            "detail": (
                f"Combined SMS risk: {sms_risk:.0%}. "
                f"Models: {_format_ensemble_detail(sms_ensemble)}"
            ),
            "severity": "high" if sms_risk >= 0.8 else ("med" if sms_risk >= 0.55 else "low"),
            "tags": ["sms", "classifier", "ensemble"],
        }
    )
    cards.append(
        {
            "title": "Email phishing ensemble",
            "detail": (
                f"Combined phishing risk: {phish_risk:.0%}. "
                f"Models: {_format_ensemble_detail(phish_ensemble)}"
            ),
            "severity": "high" if phish_risk >= 0.8 else ("med" if phish_risk >= 0.55 else "low"),
            "tags": ["email", "classifier", "ensemble"],
        }
    )

    job_scam = phish.get("jobScam")
    if isinstance(job_scam, dict) and float(job_scam.get("risk", 0.0)) >= 0.25:
        job_signals = [item for item in job_scam.get("ensemble", []) if isinstance(item, dict)]
        hits = ", ".join([str(x) for x in job_scam.get("keywordHits", [])[:4]])
        cards.append(
            {
                "title": "Internship / job-offer scam signal",
                "detail": (
                    f"Job scam risk: {float(job_scam.get('risk', 0.0)):.0%}. "
                    f"Signals: {_format_ensemble_detail(job_signals, limit=3)}"
                    + (f". Keywords: {hits}" if hits else "")
                ),
                "severity": "high" if float(job_scam.get("risk", 0.0)) >= 0.7 else "med",
                "tags": ["job-scam", "internship", "classifier"],
            }
        )

    tactics = [str(item) for item in behavior.get("tactics", [])]
    if tactics:
        cards.append(
            {
                "title": "Behavioral tactics detected",
                "detail": "Detected persuasion tactics: " + ", ".join(tactics[:5]),
                "severity": "med",
                "tags": ["behavior", "zero-shot"],
            }
        )

    url_items = [item for item in url_intel.get("items", []) if isinstance(item, dict)]
    total_flags = sum(len(item.get("flags", [])) for item in url_items)
    if total_flags > 0:
        cards.append(
            {
                "title": "URL intelligence warning",
                "detail": f"Found {total_flags} URL risk flags across submitted links.",
                "severity": "high" if total_flags >= 4 else "med",
                "tags": ["url", "intel"],
            }
        )

    if graph_risk >= 0.35:
        cards.append(
            {
                "title": "Graph anomaly risk",
                "detail": f"Graph-based anomaly scoring reported {graph_risk:.0%} risk.",
                "severity": "high" if graph_risk >= 0.65 else "med",
                "tags": ["graph", "pygod"],
            }
        )

    if highlights:
        cards.append(
            {
                "title": "Suspicious phrase highlights",
                "detail": "Detected high-risk phrases related to urgency, payment, or verification.",
                "severity": "med",
                "tags": ["nlp", "highlights"],
            }
        )

    if locale in {"hi", "auto"} and _is_indic_text(text):
        cards.append(
            {
                "title": "Indic language encoder active",
                "detail": "Hindi/Indic text detected. ai4bharat/indic-bert signal blended with multilingual-e5 embeddings.",
                "severity": "low",
                "tags": ["indic", "embedding"],
            }
        )

    preferred_model = SMS_MODEL if sms_risk >= phish_risk else PHISH_MODEL
    proof_tokens = _proof_tokens(text, preferred_model)
    if proof_tokens:
        cards.append(
            {
                "title": "Proof mode token attribution",
                "detail": "Most influential tokens: " + ", ".join(proof_tokens),
                "severity": "low",
                "tags": ["proof", "transformers-interpret"],
            }
        )

    return cards[:8]


def _risk_level_from_score(score: float) -> Literal["LOW", "MEDIUM", "HIGH"]:
    if score <= 33:
        return "HIGH"
    if score <= 66:
        return "MEDIUM"
    return "LOW"


def _summary(risk_level: str) -> str:
    if risk_level == "HIGH":
        return "High-risk scam indicators detected. Avoid clicking links, sharing OTPs, or sending money."
    if risk_level == "MEDIUM":
        return "Some suspicious indicators detected. Verify sender and links through official channels first."
    return "Low-risk indicators overall, but still verify unexpected requests before taking action."


def _suggested_actions(risk_level: str) -> List[str]:
    if risk_level == "HIGH":
        return [
            "Do not click any links or open attachments.",
            "Do not share OTP, password, or card details.",
            "Verify the sender via official app/website/phone number.",
            "Report the message as phishing or spam.",
        ]
    if risk_level == "MEDIUM":
        return [
            "Double-check URL spelling and domain before opening.",
            "Verify request details through an official support channel.",
            "Avoid rushed payments or urgent transfer requests.",
        ]
    return [
        "Stay cautious with unexpected links and account alerts.",
        "Use official channels for sensitive account actions.",
    ]


def _safe_rewrite(risk_level: str) -> Optional[str]:
    if risk_level == "HIGH":
        return (
            "I cannot verify this request. I will contact the organization directly "
            "through its official website or customer support."
        )
    if risk_level == "MEDIUM":
        return (
            "Please share an official reference and I will verify it from the company website "
            "before proceeding."
        )
    return None


@app.post("/v1/analyze", response_model=AnalyzeOutput)
async def analyze(payload: AnalyzeInput, x_ai_token: Optional[str] = Header(default=None)):
    if AI_SERVICE_TOKEN and x_ai_token != AI_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid AI token")

    urls = payload.urls[:MAX_URLS]

    sms, phish, behavior, embedding, url_intel = await asyncio.gather(
        classify_sms(payload.text),
        classify_phishing(payload.text),
        classify_behavior(payload.text),
        embed_text(payload.text, payload.locale),
        analyze_urls(urls),
    )

    sms_risk = _risk_from_label(str(sms["label"]), float(sms["score"]))
    phish_risk = _risk_from_label(str(phish["label"]), float(phish["score"]))
    text_risk = _clip((sms_risk + phish_risk) / 2)
    behavior_risk = _clip(float(behavior.get("confidence", 0.0)))
    raw_url_risk = _clip(float(url_intel.get("overallRisk", 0)) / 100)

    graph_risk = compute_graph_risk(
        [item for item in url_intel.get("items", []) if isinstance(item, dict)],
        text_risk,
        behavior_risk,
    )
    blended_url_risk = _clip(0.7 * raw_url_risk + 0.3 * graph_risk)
    url_intel["overallRisk"] = int(round(blended_url_risk * 100))

    weighted_risk = (
        0.35 * text_risk
        + 0.20 * behavior_risk
        + 0.25 * blended_url_risk
        + 0.20 * 0.0
    )
    trust_score = float(round((1 - _clip(weighted_risk)) * 100, 2))
    risk_level = _risk_level_from_score(trust_score)

    highlights = find_highlights(payload.text)
    proof = _build_proof_cards(
        payload.text,
        sms,
        phish,
        behavior,
        url_intel,
        highlights,
        graph_risk,
        payload.locale,
    )

    return {
        "requestId": payload.requestId,
        "trustScore": trust_score,
        "riskLevel": risk_level,
        "summary": _summary(risk_level),
        "proof": proof,
        "highlights": highlights,
        "behavior": behavior,
        "urlIntel": url_intel,
        "classifiers": {
            "smsSpam": sms,
            "phishingEmail": phish,
        },
        "embedding": embedding,
        "suggestedActions": _suggested_actions(risk_level),
        "safeRewrite": _safe_rewrite(risk_level),
    }


@app.get("/healthz")
async def healthz():
    return {
        "ok": True,
        "mode": "hf_api" if USE_HF_API else "local",
        "modelMode": MODEL_MODE,
        "models": {
            "smsPrimary": SMS_MODEL,
            "smsAlt1": SMS_MODEL_ALT_1,
            "smsAlt2": SMS_MODEL_ALT_2,
            "phishingPrimary": PHISH_MODEL,
            "phishingAlt1": PHISH_MODEL_ALT_1,
            "jobScam": JOB_SCAM_MODEL or "keyword+zero-shot",
            "behavior": BEHAVIOR_MODEL,
            "embedding": EMBED_MODEL,
            "indicEncoder": INDIC_BERT_MODEL,
        },
    }
