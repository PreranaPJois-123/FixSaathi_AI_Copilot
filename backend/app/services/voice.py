"""Spoken replies with Gemini text-to-speech.

Only stored assistant messages are spoken, so the audio always matches text that already passed the server-side safety screen.
Withheld power steps stay withheld: their on-screen marker is dropped and the written lock note is replaced by the spoken one.
"""
import io, re, wave
from collections import OrderedDict
from ..config import get_settings
from ..db.models import Conversation
from ..integrations.gemini.client import TTS_SAMPLE_RATE, TTS_VOICES, get_gemini
from .pdf_report import _CITATION
from .safety import LOCK_NOTE, LOCK_NOTE_VOICE, WITHHELD_MARK

MAX_CHARS = 3000
_CACHE: OrderedDict[tuple[str, str], bytes] = OrderedDict()  # (message id, voice) -> WAV. Replaying a reply costs no request.
_CACHE_SIZE = 40


def spoken_text(message: str) -> str:
    t = (message or '').replace(LOCK_NOTE, LOCK_NOTE_VOICE).replace(WITHHELD_MARK, '')
    t = _CITATION.sub('', t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)                 # [label](url) -> label
    t = re.sub(r'`([^`]+)`', r'\1', t)
    t = re.sub(r'(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1', r'\2', t)      # bold / italic
    t = re.sub(r'^\s*#{1,6}\s+', '', t, flags=re.M)
    t = re.sub(r'^\s*[-*•]\s+', '', t, flags=re.M)                  # bullets read as sentences
    t = re.sub(r'^\s*(\d+)[.)]\s+', r'\1. ', t, flags=re.M)
    t = re.sub(r'(?m)([^.!?:;\s])\s*$', r'\1.', t)                  # each line ends a sentence, so the voice pauses there
    t = re.sub(r'[ \t]+', ' ', re.sub(r'\n{2,}', '\n', t)).strip()
    if len(t) > MAX_CHARS:
        cut = max(t.rfind('. ', 0, MAX_CHARS), t.rfind('\n', 0, MAX_CHARS))
        t = t[:cut + 1 if cut > MAX_CHARS // 2 else MAX_CHARS]
    return t


# ---- delivery: one natural-language direction per reply (Gemini TTS is steered in words; one request per reply) ----

PERSONA = ('You are FixSaathi, a friendly, sharp field-technician assistant talking to a technician in India. Speak like a skilled '
           'colleague standing beside them: warm, confident and natural, at a relaxed but brisk conversational pace, with natural '
           'pitch movement, realistic pauses between sentences and emphasis on the words that matter. Never sound like a narrator '
           'reading a list, and never exaggerate.')
_KANNADA = re.compile(r'[\u0C80-\u0CFF]')
_TAMIL = re.compile(r'[\u0B80-\u0BFF]')
_DEVANAGARI = re.compile(r'[\u0900-\u097F]')
# Common Hindi words written in Roman letters: two or more mean the reply is Hinglish.
_HINGLISH = re.compile(r'\b(hai|hain|nahi|nahin|karo|karein|kijiye|kya|toh|aur|ke|ki|ko|mein|se|pehle|phir|abhi|agar|lekin|bhi|wala|wali|'
                       r'dekho|dekhiye|chalu|band|thik|theek|accha|achha|haan|ji|aap|apna|yeh|woh|kuch|zaroor|bilkul|bas)\b', re.I)
_SAFETY = re.compile(r'(switch(ed)? off|turn (it )?off|isolat\w*|\bMCB\b|tester|unplug|do not|don\'t|never|danger\w*|shock|live (wire|line|terminal)|'
                     r'high[- ]voltage|lethal|held back a power-sensitive step|authorised service|'
                     r'बंद कर|मत |कभी नहीं|खतरा|झटका|ಆಫ್ ಮಾಡಿ|ಬೇಡ|ಅಪಾಯ|அணைத்|வேண்டாம்|ஆபத்து)', re.I)
# Non-Latin words are matched without \b: Python's word boundary is unreliable after Devanagari/Kannada vowel signs.
_GREETING = re.compile(r'^\W*(?:(?:hi|hello|hey|namaste|namaskar|welcome|good (?:morning|afternoon|evening))\b|नमस्ते|नमस्कार|ನಮಸ್ಕಾರ|வணக்கம்)', re.I)
_DONE = re.compile(r'\b(?:well done|great (?:job|work)|nice work|good job|that fixed it|it\'?s fixed|problem (?:is )?(?:solved|resolved)|resolved|'
                   r'shabash|(?:bahut )?badhiya)\b|बढ़िया|शाबाश|ಚೆನ್ನಾಗಿದೆ|ಶಭಾಷ್|அருமை', re.I)
_STEPS = re.compile(r'(^|\n)\s*\d+\.\s')


def language_of(text: str) -> str:
    t = text or ''
    letters = sum(c.isalpha() for c in t) or 1
    if len(_KANNADA.findall(t)) / letters > 0.2: return 'kannada'
    if len(_TAMIL.findall(t)) / letters > 0.2: return 'tamil'
    if len(_DEVANAGARI.findall(t)) / letters > 0.2: return 'hindi'
    if len(_HINGLISH.findall(t)) >= 2: return 'hinglish'
    return 'english'


_ACCENT = {
    'english': 'Speak clear, professional Indian English with a natural Indian accent.',
    'hindi': 'Speak natural, everyday Hindi with native pronunciation. Say English technical words (MCB, capacitor, tester) the way Indian technicians say them.',
    'hinglish': ('This is Hinglish: Hindi written in Roman letters, mixed with English. Pronounce the Hindi words as natural Hindi and the '
                 'English words with an Indian English accent, flowing as one natural voice without switching accent mid-sentence.'),
    'kannada': 'Speak natural, everyday Kannada with native pronunciation. Say English technical words (MCB, capacitor, tester) the way technicians in Karnataka say them.',
    'tamil': 'Speak natural, everyday Tamil with native pronunciation. Say English technical words the way technicians in Tamil Nadu say them.',
}


def direction(text: str) -> str:
    """How this reply should sound. Safety wording always gets the firm tone, whatever else the reply contains."""
    tone = []
    if _GREETING.search(text): tone.append('Open warmly and welcoming.')
    if _STEPS.search(text): tone.append('Give the steps patiently and conversationally, with a short pause after each step, easy to follow.')
    else: tone.append('Explain the likely cause calmly, confidently and clearly.')
    if _SAFETY.search(text):
        tone.append('Say every safety warning (switching off, isolating, testing, anything they must not do) in a firm, serious, '
                    'unhurried tone with clear emphasis. Never sound cheerful about safety.')
    if _DONE.search(text): tone.append('Finish on a positive, encouraging note.')
    return ' '.join([PERSONA, _ACCENT[language_of(text)], *tone, 'Read only the text below.'])


def wav(pcm: bytes, rate: int = TTS_SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return buf.getvalue()


def voice_name(requested: str | None) -> str:
    v = requested or get_settings().gemini_tts_voice
    return v if v in TTS_VOICES else 'Charon'


async def speak(m: Conversation, voice: str | None) -> tuple[bytes, str]:
    v = voice_name(voice)
    key = (str(m.id), v)
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key], v
    text = spoken_text(m.message)
    if not text:
        from ..core.exceptions import AppError
        raise AppError('This message has nothing to read aloud.', code='NOTHING_TO_SPEAK')
    pcm, _ = await get_gemini().speech(text, v, direction(text))
    data = wav(pcm)
    _CACHE[key] = data
    if len(_CACHE) > _CACHE_SIZE:
        _CACHE.popitem(last=False)
    return data, v
