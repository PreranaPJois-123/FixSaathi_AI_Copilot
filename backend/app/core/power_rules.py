"""The one definition of "power-sensitive" text, shared by repair steps, chat replies, the live relay and dataset import.

Two levels:
- POWER_WORDS (steps): any mention of opening, covers, wiring, terminals, capacitors, boards and similar internals.
  Deliberately broad: a structured step that touches these is locked until the safety statements are recorded.
- ACTION_WORDS (free text): an instruction to *do* power-sensitive work (open, remove, discharge, measure, bypass...).
  Used on chat and live replies, where merely naming a likely faulty part ("a weak capacitor") must stay readable.

Hindi/Hinglish verbs are included because technicians and the model both use them (khol = open, nikal = take out,
badal = replace, jod = connect, chhu = touch, taar = wire). Keep this list conservative: adding words only makes the
gate stricter; removing words weakens it.
"""
import re

POWER_WORDS = re.compile(
    r'\b(open(s|ed|ing)?|remov(e|es|ed|ing|al)|unscrew\w*|disconnect\w*|detach\w*|dismantl\w*|cover(s)?|canopy|panel(s)?|'
    r'wire(s|d)?|wiring|terminal(s)?|capacitor(s)?|discharg\w*|replac(e|es|ed|ing|ement)|solder\w*|connector(s)?|'
    r'board(s)?|pcb(s)?|element(s)?|motor(s)?|pump(s)?|valve(s)?|thermistor(s)?|compressor(s)?|'
    r'multimeter|continuity|live (wire|terminal|circuit|side)|bypass\w*|jumper\w*|'
    r'khol\w*|nikal\w*|nikaal\w*|taar)\b', re.I)

ACTION_WORDS = re.compile(
    r'\b(open(s|ed|ing)?|remov(e|es|ed|ing)|unscrew\w*|disconnect\w*|detach\w*|dismantl\w*|take (it |them )?(off|out|apart)|'
    r'pull (it |them )?(off|out)|lift (off )?the (cover|panel|lid)|lower(ing)? the (canopy|cover|panel)|slide (the )?(canopy|cover) down|'
    r'take down|unclip\w*|unmount\w*|pr(y|ise|ize) (off|open|out)|loosen(ing)? the (canopy|cover|panel|screw|terminal)\w*|expos(e|es|ing) the|'
    r'access(ing)? the (capacitor|terminal|wire|wiring|board|pcb|motor|inside|internal|housing|connection)\w*|discharg\w*|replac(e|es|ed|ing)|swap(ping)?|solder\w*|desolder\w*|'
    r'rewir\w*|re-?connect\w*|strip(ping)? the|cut the wire|touch(ing)? the (terminal|wire|capacitor|board|pcb|contact)\w*|'
    r'probe\w*|measur\w*|multimeter|continuity|megger|short(ing)? (the|across|out)|bridg(e|ing) the|bypass\w*|jumper\w*|'
    r'khol\w*|nikal\w*|nikaal\w*|badal\w*|jod\w*|chhu\w*|chhoo\w*)\b', re.I)

# A verb within a few words after one of these is a prohibition ("never open", "do not touch the terminals", "mat kholna").
NEGATION = re.compile(r"\b(not|never|don'?t|do not|avoid|without|mat|na|nahi|nahin|kabhi)\b(\W+\w+){0,3}\W*$", re.I)
# A verb used as a precondition is the safety reminder itself, not the work: "before opening the canopy, switch off the MCB",
# "canopy kholne se pehle MCB off karo". The work verb that follows such a reminder is still caught on its own.
BEFORE = re.compile(r'\b(before|prior to|until)\W*$', re.I)
BEFORE_HI = re.compile(r'^\w*\s+(se|ke|say)\s+(pehle|pahle|pehele)\b', re.I)

MICROWAVE_INTERNAL = re.compile(
    r'\b(cabinet|outer (case|cover)|remove (the )?(cover|case|casing|panel)|open(ing)? (the )?(oven|microwave|case|casing|cover|panel)|'
    r'unscrew|magnetron|high[- ]voltage|hv (capacitor|diode|transformer)|capacitor|diode|transformer|interlock switch)\b', re.I)
MICROWAVE_ESCALATION = ('Do not open the microwave. Its high-voltage capacitor can hold a lethal charge even after unplugging. '
                        'Unplug the oven, note the symptom and model number, and hand it to authorised service.')


def step_needs_power_off(text: str) -> bool:
    """Structured repair steps: broad rule."""
    return bool(POWER_WORDS.search(text or '') or ACTION_WORDS.search(text or ''))


def _is_instruction(t: str, m: re.Match) -> bool:
    before = t[max(0, m.start() - 40):m.start()]
    if NEGATION.search(before) or BEFORE.search(before):
        return False
    return not BEFORE_HI.search(t[m.start():m.end() + 20])


def instructs_power_work(text: str) -> bool:
    """Free text: True if it tells someone to do power-sensitive work. Prohibitions ('never open the cover') and
    preconditions ('before opening it, switch off the MCB') do not count; the work itself does."""
    t = text or ''
    return any(_is_instruction(t, m) for m in ACTION_WORDS.finditer(t))


def step_text_needs_power_off(text: str) -> bool:
    """A numbered or bulleted line in a reply is a step, so it gets the broad step rule (any mention of covers, canopy,
    capacitors, terminals...). Only explicit prohibitions ('never open the cabinet') are let through."""
    t = text or ''
    for rx in (POWER_WORDS, ACTION_WORDS):
        for m in rx.finditer(t):
            if not NEGATION.search(t[max(0, m.start() - 40):m.start()]):
                return True
    return False


def mentions_microwave_internals(text: str) -> bool:
    t = text or ''
    for m in MICROWAVE_INTERNAL.finditer(t):
        if not NEGATION.search(t[max(0, m.start() - 40):m.start()]):
            return True
    return False
