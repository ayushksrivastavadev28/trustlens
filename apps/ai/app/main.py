from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
import os
import re
import math
import ipaddress
from datetime import datetime
import httpx
import tldextract
import whois
import numpy as np
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="TrustLens AI")

AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
MODEL_MODE = os.getenv("MODEL_MODE", "hf_api")
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

USE_HF_API = bool(HF_API_TOKEN) and MODEL_MODE != "local"

SMS_MODEL = "mariagrandury/distilbert-base-uncased-finetuned-sms-spam-detection"
PHISH_MODEL = "cybersectony/phishing-email-detection-distilbert_v2.1"
BEHAVIOR_MODEL = "tasksource/deberta-small-long-nli"
EMBED_MODEL = "intfloat/multilingual-e5-small"

TacticLabels = [
    "urgency",
    "authority",
    "fear",
    "scarcity",
    "reward",
    "impersonation",
    "payment_request",
    "credential_harvest"
]

HIGHLIGHT_PATTERNS = [
    (r"\bOTP\b|one[- ]time password", "otp"),
    (r"\bUPI\b|upi id", "upi"),
    (r"urgent|immediately|act now|within \d+ minutes", "urgency"),
    (r"click here|verify now|login now|update now", "action"),
    (r"payment|pay now|processing fee|charges", "payment"),
    (r"limited time|expires|last chance", "scarcity"),
    (r"refund|cashback|reward|prize", "reward")
]

class AnalyzeInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    inputType: Literal["sms", "email", "message"]
    urls: List[str] = []
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
    behavior: dict
    urlIntel: dict
    classifiers: dict
    embedding: List[float]
    suggestedActions: List[str]
    safeRewrite: Optional[str]

_http = httpx.AsyncClient(timeout=4.0)

_sms_pipe = None
_phish_pipe = None
_behavior_pipe = None
_embedder = None
_interpreters = {}
_hf_disabled_models = set()


def _cheap_embedding(text: str, dims: int = 384) -> List[float]:
    # Deterministic, lightweight fallback when both HF and local embedding fail.
    vec = [0.0] * dims
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    if not tokens:
        return vec
    for token in tokens:
        slot = hash(token) % dims
        vec[slot] += 1.0
    return _normalize(vec)


def _heuristic_classification(text: str, mode: str):
    t = text.lower()
    risk_terms = ["otp", "verify", "urgent", "click", "payment", "upi", "bank", "suspend", "limited time"]
    hits = sum(1 for term in risk_terms if term in t)
    score = max(0.05, min(0.95, 0.18 * hits))
    if mode == "sms":
        return {"label": "spam" if hits >= 2 else "ham", "score": float(score if hits >= 2 else 1 - score)}
    return {"label": "phishing" if hits >= 2 else "legit", "score": float(score if hits >= 2 else 1 - score)}


def _log(msg: str):
    if LOG_LEVEL != "silent":
        print(msg)


def _parse_classification(res):
    if isinstance(res, list) and res and isinstance(res[0], list):
        res = res[0]
    if isinstance(res, list) and res:
        top = max(res, key=lambda x: x.get("score", 0))
        return {"label": str(top.get("label", "unknown")), "score": float(top.get("score", 0))}
    if isinstance(res, dict) and "label" in res and "score" in res:
        return {"label": str(res.get("label")), "score": float(res.get("score"))}
    return {"label": "unknown", "score": 0.0}


def _parse_zero_shot(res):
    if not isinstance(res, dict):
        return {"labels": [], "scores": []}
    labels = res.get("labels", []) or []
    scores = res.get("scores", []) or []
    return {"labels": labels, "scores": scores}


def _risk_from_label(label: str, score: float) -> float:
    l = label.lower()
    risky = any(x in l for x in ["spam", "phish", "malicious", "fraud", "scam", "yes", "label_1"])
    safe = any(x in l for x in ["ham", "legit", "no", "label_0"])
    if risky:
        return score
    if safe:
        return 1 - score
    return score


async def _hf_post(model_id: str, payload: dict):
    # Hugging Face router endpoint for serverless inference.
    router_url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    res = await _http.post(router_url, headers=headers, json=payload)
    try:
        data = res.json()
    except Exception:
        data = {"error": await res.aread()}
    if isinstance(data, dict) and data.get("error"):
        raise HTTPException(status_code=502, detail=str(data.get("error")))
    return data


def _get_sms_pipe():
    global _sms_pipe
    if _sms_pipe is None:
        from transformers import pipeline
        _sms_pipe = pipeline("text-classification", model=SMS_MODEL, truncation=True)
    return _sms_pipe


def _get_phish_pipe():
    global _phish_pipe
    if _phish_pipe is None:
        from transformers import pipeline
        _phish_pipe = pipeline("text-classification", model=PHISH_MODEL, truncation=True)
    return _phish_pipe


def _get_behavior_pipe():
    global _behavior_pipe
    if _behavior_pipe is None:
        from transformers import pipeline
        _behavior_pipe = pipeline("zero-shot-classification", model=BEHAVIOR_MODEL)
    return _behavior_pipe


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _mean_pooling(mat):
    arr = np.array(mat)
    if arr.ndim == 1:
        return arr.tolist()
    return arr.mean(axis=0).tolist()


def interpret_tokens(text: str, model_id: str) -> List[str]:
    if USE_HF_API:
        return []
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        from transformers_interpret import SequenceClassificationExplainer

        if model_id not in _interpreters:
            model = AutoModelForSequenceClassification.from_pretrained(model_id)
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            _interpreters[model_id] = SequenceClassificationExplainer(model, tokenizer)
        explainer = _interpreters[model_id]
        attributions = explainer(text)
        top = sorted(attributions, key=lambda x: abs(x[1]), reverse=True)[:6]
        tokens = [w for w, s in top if w.strip()]
        return tokens
    except Exception:
        return []


async def classify_sms(text: str):
    if USE_HF_API:
        if SMS_MODEL in _hf_disabled_models:
            return _heuristic_classification(text, "sms")
        try:
            res = await _hf_post(SMS_MODEL, {"inputs": text})
            return _parse_classification(res)
        except Exception:
            _log("HF sms classification failed, using heuristic fallback.")
            _hf_disabled_models.add(SMS_MODEL)
            return _heuristic_classification(text, "sms")
    try:
        pipe = _get_sms_pipe()
        res = pipe(text)
        return _parse_classification(res)
    except Exception:
        _log("Local sms model failed, using heuristic fallback.")
        return _heuristic_classification(text, "sms")


async def classify_phish(text: str):
    if USE_HF_API:
        if PHISH_MODEL in _hf_disabled_models:
            return _heuristic_classification(text, "email")
        try:
            res = await _hf_post(PHISH_MODEL, {"inputs": text})
            return _parse_classification(res)
        except Exception:
            _log("HF phishing classification failed, using heuristic fallback.")
            _hf_disabled_models.add(PHISH_MODEL)
            return _heuristic_classification(text, "email")
    try:
        pipe = _get_phish_pipe()
        res = pipe(text)
        return _parse_classification(res)
    except Exception:
        _log("Local phishing model failed, using heuristic fallback.")
        return _heuristic_classification(text, "email")


async def classify_behavior(text: str):
    if USE_HF_API:
        if BEHAVIOR_MODEL in _hf_disabled_models:
            parsed = {
                "labels": ["urgency", "payment_request", "credential_harvest"],
                "scores": [0.62, 0.58, 0.55]
            }
        else:
            try:
                res = await _hf_post(BEHAVIOR_MODEL, {"inputs": text, "parameters": {"candidate_labels": TacticLabels}})
                parsed = _parse_zero_shot(res)
            except Exception:
                _log("HF behavior model failed, using heuristic behavior fallback.")
                _hf_disabled_models.add(BEHAVIOR_MODEL)
                parsed = {
                    "labels": ["urgency", "payment_request", "credential_harvest"],
                    "scores": [0.62, 0.58, 0.55]
                }
    else:
        try:
            pipe = _get_behavior_pipe()
            res = pipe(text, candidate_labels=TacticLabels)
            parsed = _parse_zero_shot(res)
        except Exception:
            _log("Local behavior model failed, using heuristic behavior fallback.")
            parsed = {
                "labels": ["urgency", "payment_request", "credential_harvest"],
                "scores": [0.62, 0.58, 0.55]
            }

    tactics = [label for label, score in zip(parsed.get("labels", []), parsed.get("scores", [])) if score >= 0.45]
    confidence = max(parsed.get("scores", [0]) or [0])
    return {"tactics": tactics, "confidence": float(confidence)}


async def embed_text(text: str) -> List[float]:
    if USE_HF_API:
        if EMBED_MODEL in _hf_disabled_models:
            return _cheap_embedding(text)
        try:
            res = await _hf_post(EMBED_MODEL, {"inputs": f"query: {text}"})
            pooled = _mean_pooling(res)
            return _normalize([float(x) for x in pooled])
        except Exception:
            _log("HF embedding failed, using cheap embedding fallback.")
            _hf_disabled_models.add(EMBED_MODEL)
            return _cheap_embedding(text)
    try:
        embedder = _get_embedder()
        vec = embedder.encode([text], normalize_embeddings=True)[0].tolist()
        return [float(v) for v in vec]
    except Exception:
        _log("Local embedder failed, using cheap embedding fallback.")
        return _cheap_embedding(text)


def find_highlights(text: str):
    highlights = []
    for pattern, label in HIGHLIGHT_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            highlights.append({"start": match.start(), "end": match.end(), "label": label})
    return highlights


def flag_url(url: str, final_url: str, redirects: int):
    flags = []
    if redirects > 2:
        flags.append("many_redirects")
    if not final_url.lower().startswith("https://"):
        flags.append("no_https")
    if len(url) > 100:
        flags.append("long_url")
    try:
        host = httpx.URL(final_url).host
        if host and host.startswith("xn--"):
            flags.append("punycode")
        if host:
            try:
                ipaddress.ip_address(host)
                flags.append("ip_url")
            except ValueError:
                pass
            ext = tldextract.extract(final_url)
            tld = ext.suffix
            if tld in {"xyz", "top", "zip", "mov", "icu", "cfd", "gq", "tk", "click", "rest", "cyou"}:
                flags.append("suspicious_tld")
    except Exception:
        pass
    return flags


def domain_age_days(url: str):
    try:
        host = httpx.URL(url).host
        if not host:
            return None
        ext = tldextract.extract(url)
        domain = ext.registered_domain or host
        data = whois.whois(domain)
        created = data.creation_date
        if isinstance(created, list):
            created = created[0]
        if not created:
            return None
        if isinstance(created, str):
            created = datetime.fromisoformat(created)
        return (datetime.utcnow() - created).days
    except Exception:
        return None


async def analyze_urls(urls: List[str]):
    items = []
    risk_scores = []
    for url in urls:
        try:
            res = await _http.head(url, follow_redirects=True)
            final_url = str(res.url)
            redirects = len(res.history)
        except Exception:
            final_url = url
            redirects = 0
        flags = flag_url(url, final_url, redirects)
        age = domain_age_days(final_url)
        item_risk = min(1.0, 0.15 * len(flags) + (0.2 if age is not None and age < 90 else 0))
        risk_scores.append(item_risk)
        items.append({
            "url": url,
            "finalUrl": final_url,
            "redirects": redirects,
            "https": final_url.lower().startswith("https://"),
            "domainAgeDays": age,
            "flags": flags
        })
    overall = int(round((sum(risk_scores) / len(risk_scores)) * 100)) if risk_scores else 0
    return {"overallRisk": overall, "items": items}


def graph_risk_score(features: List[float]) -> float:
    try:
        from pygod.detector import DOMINANT
        import torch
        from torch_geometric.data import Data

        x = torch.tensor([features, features], dtype=torch.float)
        edge_index = torch.tensor([[0, 1], [1, 0]], dtype=torch.long)
        data = Data(x=x, edge_index=edge_index)
        model = DOMINANT(hid_dim=8, num_layers=2, epoch=20)
        model.fit(data)
        score = float(model.decision_function(data)[0])
        return max(0.0, min(1.0, score))
    except Exception:
        return 0.0


def build_proof(text: str, sms, phish, behavior, url_intel, highlights):
    proof = []
    sms_risk = _risk_from_label(sms["label"], sms["score"])
    phish_risk = _risk_from_label(phish["label"], phish["score"])

    if sms_risk > 0.6:
        proof.append({
            "title": "Spam classifier signal",
            "detail": f"Model flagged SMS spam likelihood at {sms_risk:.0%}.",
            "severity": "high" if sms_risk > 0.8 else "med",
            "tags": ["sms", "classifier"]
        })
    if phish_risk > 0.6:
        proof.append({
            "title": "Phishing classifier signal",
            "detail": f"Model flagged phishing likelihood at {phish_risk:.0%}.",
            "severity": "high" if phish_risk > 0.8 else "med",
            "tags": ["email", "classifier"]
        })
    if behavior.get("tactics"):
        proof.append({
            "title": "Behavioral tactics",
            "detail": "Detected tactics: " + ", ".join(behavior.get("tactics", [])),
            "severity": "med",
            "tags": ["behavior"]
        })
    if url_intel.get("items"):
        flag_count = sum(len(i.get("flags", [])) for i in url_intel.get("items", []))
        if flag_count:
            proof.append({
                "title": "Suspicious URL indicators",
                "detail": f"Found {flag_count} URL risk flags across provided links.",
                "severity": "med" if flag_count < 3 else "high",
                "tags": ["url"]
            })
    if highlights:
        proof.append({
            "title": "High-risk phrases",
            "detail": "Highlighted phrases suggest urgency or payment requests.",
            "severity": "med",
            "tags": ["text"]
        })

    tokens = interpret_tokens(text, SMS_MODEL if sms_risk >= phish_risk else PHISH_MODEL)
    if tokens:
        proof.append({
            "title": "Model token attribution",
            "detail": "Local interpretability highlights: " + ", ".join(tokens),
            "severity": "low",
            "tags": ["interpret", "proof"]
        })

    return proof


def build_summary(trust_score: float, risk_level: str, url_risk: int, tactics: List[str]):
    if risk_level == "HIGH":
        return "High-risk signals detected. Avoid interacting and verify the sender through official channels."
    if risk_level == "MEDIUM":
        return "Some risk indicators detected. Verify URLs and sender identity before acting."
    return "Low risk signals detected. Still verify unexpected requests before proceeding."


def suggested_actions(risk_level: str):
    if risk_level == "HIGH":
        return [
            "Do not click links or share credentials",
            "Verify the sender using an official channel",
            "Report the message to your provider"
        ]
    if risk_level == "MEDIUM":
        return [
            "Check the URL carefully for typos",
            "Confirm the request via an official channel",
            "Avoid urgent payments or OTP sharing"
        ]
    return [
        "Keep an eye out for unusual requests",
        "Use official apps to verify account status"
    ]


def safe_rewrite(risk_level: str):
    if risk_level == "HIGH":
        return "I can't verify this request. Please contact the organization directly using its official website or phone number."
    return None


@app.post("/v1/analyze", response_model=AnalyzeOutput)
async def analyze(payload: AnalyzeInput, x_ai_token: Optional[str] = Header(None)):
    if AI_SERVICE_TOKEN and x_ai_token != AI_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid AI token")

    sms = await classify_sms(payload.text)
    phish = await classify_phish(payload.text)
    behavior = await classify_behavior(payload.text)
    embedding = await embed_text(payload.text)

    highlights = find_highlights(payload.text)
    url_intel = await analyze_urls(payload.urls)

    sms_risk = _risk_from_label(sms["label"], sms["score"])
    phish_risk = _risk_from_label(phish["label"], phish["score"])
    text_risk = (sms_risk + phish_risk) / 2
    behavior_risk = behavior.get("confidence", 0)
    url_risk = (url_intel.get("overallRisk", 0) / 100)

    feature_vec = [text_risk, behavior_risk, url_risk]
    graph_risk = graph_risk_score(feature_vec)
    if graph_risk:
        url_intel["overallRisk"] = int(round(min(1.0, (url_intel.get("overallRisk", 0) / 100) + graph_risk) * 100))
        url_risk = url_intel["overallRisk"] / 100

    weighted = 0.35 * text_risk + 0.2 * behavior_risk + 0.25 * url_risk + 0.2 * 0
    trust_score = max(0.0, min(1.0, 1 - weighted)) * 100
    trust_score = float(int(round(trust_score)))

    if trust_score <= 33:
        risk_level = "HIGH"
    elif trust_score <= 66:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    proof = build_proof(payload.text, sms, phish, behavior, url_intel, highlights)

    return {
        "requestId": payload.requestId,
        "trustScore": trust_score,
        "riskLevel": risk_level,
        "summary": build_summary(trust_score, risk_level, url_intel.get("overallRisk", 0), behavior.get("tactics", [])),
        "proof": proof,
        "highlights": highlights,
        "behavior": behavior,
        "urlIntel": url_intel,
        "classifiers": {
            "smsSpam": sms,
            "phishingEmail": phish
        },
        "embedding": embedding,
        "suggestedActions": suggested_actions(risk_level),
        "safeRewrite": safe_rewrite(risk_level)
    }


@app.get("/healthz")
async def healthz():
    return {"ok": True, "mode": "hf_api" if USE_HF_API else "local"}
