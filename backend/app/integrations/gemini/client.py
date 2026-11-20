"""Central Gemini access. Every model call in the backend goes through this module.
- Credentials and model IDs come only from configuration.
- No silent model substitution: if a model ID is not configured the call raises AIUnavailable.
  Fallbacks happen only through GEMINI_AGENT_FALLBACK_MODELS, which the operator sets explicitly; every switch is logged.
"""
import asyncio, json, logging, time
from typing import Any, TypeVar
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError
from ...config import get_settings
from ...core.exceptions import AIError, AIUnavailable
from ...core.logging import log
from .errors import classify

logger = logging.getLogger('gemini')
T = TypeVar('T', bound=BaseModel)
LAST_STATUS: dict = {'ok': None}
# Models that just answered quota / billing / not-found are skipped for a while, so every message doesn't wait on them again.
COOLDOWN: dict[str, float] = {}
COOL_CODES = {'QUOTA_EXCEEDED': 60.0, 'BILLING_REQUIRED': 900.0, 'MODEL_NOT_FOUND': 900.0}
TEXT_OUTPUT_CAP = {'chat': 2048}  # output tokens, thinking included; chat answers are a few short paragraphs
MODEL_SETTINGS = {'agent': 'gemini_agent_model', 'live': 'gemini_live_model', 'embed': 'gemini_embed_model', 'image': 'nano_banana_model'}


_SCHEMA_LIMITS = {'maxLength', 'minLength', 'maxItems', 'minItems', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'}


def _relax_schema(x: Any) -> Any:
    """The same JSON schema without length/count/range limits (structure, types and enums are kept)."""
    if isinstance(x, dict):
        return {k: _relax_schema(v) for k, v in x.items() if k not in _SCHEMA_LIMITS}
    if isinstance(x, list):
        return [_relax_schema(v) for v in x]
    return x


class CallResult(BaseModel):
    model: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None


class GeminiClient:
    def __init__(self, client: Any | None = None):
        self._client = client

    @property
    def configured(self) -> bool:
        return self._client is not None or get_settings().ai_configured

    def model(self, kind: str) -> str:
        s = get_settings()
        m = getattr(s, MODEL_SETTINGS[kind])
        if not self.configured:
            raise AIUnavailable('Gemini is not configured on the server (GEMINI_API_KEY is missing).')
        if not m:
            raise AIUnavailable(f'No model configured for {kind}. Set {MODEL_SETTINGS[kind].upper()}.', code='MODEL_NOT_CONFIGURED')
        return m

    @property
    def raw(self) -> Any:
        if self._client is None:
            s = get_settings()
            if not s.ai_configured:
                raise AIUnavailable('Gemini is not configured on the server (GEMINI_API_KEY is missing).')
            opts = types.HttpOptions(timeout=int(s.gemini_timeout_seconds * 1000))
            if s.google_genai_use_vertexai:
                self._client = genai.Client(vertexai=True, project=s.google_cloud_project, location=s.google_cloud_region, http_options=opts)
            else:
                self._client = genai.Client(api_key=s.gemini_api_key, http_options=opts)
        return self._client

    async def _call(self, op: str, model: str, fn, quota_retry: bool = True):
        """Bounded retries with exponential backoff, only for transient categories. Never retries bad keys, permissions or unknown models.
        With quota_retry=False a quota error is raised at once, so the caller can move to a fallback model instead of waiting."""
        s = get_settings()
        for attempt in range(s.gemini_max_retries + 1):
            t0 = time.perf_counter()
            try:
                resp = await asyncio.wait_for(fn(), timeout=s.gemini_timeout_seconds)
                ms = int((time.perf_counter() - t0) * 1000)
                um = getattr(resp, 'usage_metadata', None)
                meta = CallResult(model=model, latency_ms=ms, input_tokens=getattr(um, 'prompt_token_count', None), output_tokens=getattr(um, 'candidates_token_count', None))
                log(logger, 'gemini_call', op=op, model=model, ms=ms, attempt=attempt, input_tokens=meta.input_tokens, output_tokens=meta.output_tokens)
                LAST_STATUS.update(ok=True, op=op, model=model, code=None, at=time.time())
                COOLDOWN.pop(model, None)
                return resp, meta
            except Exception as e:  # noqa: BLE001 - every failure is classified below
                c = classify(e, model)
                log(logger, 'gemini_call_failed', logging.WARNING, op=op, model=model, attempt=attempt, error_code=c.code, provider_http=c.provider_http,
                    provider_status=c.provider_status, provider_message=c.provider_message, ms=int((time.perf_counter() - t0) * 1000))
                LAST_STATUS.update(ok=False, op=op, model=model, code=c.code, hint=c.hint, at=time.time())
                if c.code in COOL_CODES:
                    COOLDOWN[model] = time.time() + min(max(c.retry_after or 0, COOL_CODES[c.code]), 3600)
                if c.code == 'QUOTA_EXCEEDED' and not quota_retry:
                    pass  # fall through to raise: a fallback model is available
                elif c.retryable and attempt < s.gemini_max_retries:
                    await asyncio.sleep(min(c.retry_after or 0.5 * 2 ** attempt, 6)); continue
                err_cls = AIUnavailable if c.http_status == 503 else AIError
                raise err_cls(c.message, code=c.code, status=c.http_status, details=c.details(model)) from e

    @staticmethod
    def _text_or_raise(resp, op: str) -> str:
        fb = getattr(resp, 'prompt_feedback', None)
        if fb is not None and getattr(fb, 'block_reason', None):
            raise AIError('Gemini declined to answer this request. Rephrase it and try again.', code='AI_BLOCKED', details={'reason': str(fb.block_reason)})
        cands = getattr(resp, 'candidates', None) or []
        text = (getattr(resp, 'text', None) or '').strip() if cands else ''
        if not text:
            reason = str(getattr(cands[0], 'finish_reason', '')) if cands else 'NO_CANDIDATES'
            if 'SAFETY' in reason or 'PROHIBITED' in reason:
                raise AIError('Gemini declined to answer this request. Rephrase it and try again.', code='AI_BLOCKED', details={'reason': reason})
            raise AIError('The AI model returned an empty response.', code='AI_EMPTY', details={'reason': reason, 'op': op})
        return text

    def _agent_models(self) -> list[str]:
        s = get_settings()
        extra = [m.strip() for m in (s.gemini_agent_fallback_models or '').split(',') if m.strip()]
        first = self.model('agent')
        return [first] + [m for m in extra if m != first]

    def _cfg(self, **kw) -> types.GenerateContentConfig:
        lvl = (get_settings().gemini_thinking_level or '').strip().lower()
        if lvl and not getattr(self, '_no_thinking_cfg', False):
            kw['thinking_config'] = types.ThinkingConfig(thinking_level=lvl)
        return types.GenerateContentConfig(**kw)

    async def _agent_call(self, op: str, contents: Any, **cfg_kw):
        """Try the agent model, then each configured fallback, only on rate-limit/tier errors. Each switch is logged."""
        configured = self._agent_models(); last: Exception | None = None
        now = time.time()
        ready = [m for m in configured if COOLDOWN.get(m, 0) <= now]
        cooling = sorted((m for m in configured if m not in ready), key=lambda m: COOLDOWN[m])
        models = ready + cooling  # cooling models stay as a last resort
        if cooling:
            log(logger, 'gemini_models_cooling', op=op, skipped=cooling)
        for i, model in enumerate(models):
            try:
                try:
                    resp, meta = await self._call(op, model, lambda: self.raw.aio.models.generate_content(model=model, contents=contents, config=self._cfg(**cfg_kw)),
                                                  quota_retry=i == len(models) - 1)
                except AIError as e:
                    if e.code == 'SCHEMA_UNSUPPORTED' and 'response_json_schema' in cfg_kw:
                        # Smaller models reject large constrained schemas. Retry this model once with the length/count limits
                        # removed; generate_json still validates the reply against the full Pydantic schema.
                        log(logger, 'schema_relaxed', logging.WARNING, op=op, model=model)
                        relaxed = {**cfg_kw, 'response_json_schema': _relax_schema(cfg_kw['response_json_schema'])}
                        resp, meta = await self._call(op, model, lambda: self.raw.aio.models.generate_content(model=model, contents=contents, config=self._cfg(**relaxed)),
                                                      quota_retry=i == len(models) - 1)
                    elif e.code == 'INVALID_REQUEST' and (get_settings().gemini_thinking_level or '').strip() and not getattr(self, '_no_thinking_cfg', False):
                        self._no_thinking_cfg = True  # this model does not accept thinking_level; stop sending it
                        log(logger, 'thinking_config_disabled', logging.WARNING, model=model)
                        resp, meta = await self._call(op, model, lambda: self.raw.aio.models.generate_content(model=model, contents=contents, config=self._cfg(**cfg_kw)))
                    else:
                        raise
                if model != configured[0]:
                    log(logger, 'gemini_fallback_used', logging.WARNING, op=op, primary=configured[0], used=model)
                return resp, meta
            except (AIUnavailable, AIError) as e:
                last = e
                if e.code in ('QUOTA_EXCEEDED', 'BILLING_REQUIRED', 'MODEL_NOT_FOUND', 'SCHEMA_UNSUPPORTED') and i < len(models) - 1:
                    continue
                raise
        raise last  # pragma: no cover

    async def generate_json(self, op: str, schema: type[T], contents: Any, system: str, temperature: float = 0.2) -> tuple[T, CallResult]:
        resp, meta = await self._agent_call(op, contents, system_instruction=system, temperature=temperature, response_mime_type='application/json',
                                            response_json_schema=schema.model_json_schema())
        text = self._text_or_raise(resp, op)
        try:
            return schema.model_validate(json.loads(text)), meta
        except (json.JSONDecodeError, ValidationError) as e:
            log(logger, 'gemini_invalid_json', logging.WARNING, op=op, model=meta.model)
            raise AIError('The AI model returned a response that failed validation.', code='AI_INVALID_OUTPUT') from e

    async def generate_text(self, op: str, contents: Any, system: str, temperature: float = 0.4) -> tuple[str, CallResult]:
        cap = TEXT_OUTPUT_CAP.get(op)  # bounds cost and latency of free-text replies; JSON outputs are not capped (truncation breaks them)
        resp, meta = await self._agent_call(op, contents, system_instruction=system, temperature=temperature, **({'max_output_tokens': cap} if cap else {}))
        return self._text_or_raise(resp, op), meta

    async def generate_image(self, prompt: str, reference: tuple[bytes, str] | None = None) -> tuple[bytes, str, CallResult]:
        model = self.model('image')
        parts: list[Any] = [prompt]
        if reference:
            parts.append(types.Part.from_bytes(data=reference[0], mime_type=reference[1]))
        cfg = types.GenerateContentConfig(response_modalities=['IMAGE', 'TEXT'])
        resp, meta = await self._call('image_generation', model, lambda: self.raw.aio.models.generate_content(model=model, contents=parts, config=cfg))
        for c in getattr(resp, 'candidates', None) or []:
            for p in getattr(getattr(c, 'content', None), 'parts', None) or []:
                inline = getattr(p, 'inline_data', None)
                if inline and inline.data and (inline.mime_type or '').startswith('image/'):
                    return inline.data, inline.mime_type, meta
        raise AIError('The image model did not return an image.', code='AI_NO_IMAGE')

    async def embed(self, texts: list[str], task: str = 'RETRIEVAL_DOCUMENT') -> tuple[list[list[float]], str]:
        model = self.model('embed')
        cfg = types.EmbedContentConfig(task_type=task)
        resp, _ = await self._call('embed', model, lambda: self.raw.aio.models.embed_content(model=model, contents=texts, config=cfg))
        vecs = [list(e.values or []) for e in (resp.embeddings or [])]
        if len(vecs) != len(texts) or any(not v for v in vecs):
            raise AIError('The embedding model returned an incomplete response.', code='AI_INVALID_OUTPUT')
        return vecs, model


_singleton: GeminiClient | None = None


def get_gemini() -> GeminiClient:
    global _singleton
    if _singleton is None:
        _singleton = GeminiClient()
    return _singleton


def set_gemini(c: GeminiClient | None) -> None:
    """Used by tests to inject a fake client."""
    global _singleton
    _singleton = c
