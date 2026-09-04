# AI TEACHER (ARIA) → ASCHOOL INTEGRATION BLUEPRINT

**Date:** 2026-09-04
**Source system:** `/home/bishal-regmi/Desktop/Ashlya Academy Latest/ashlya_academy/ATeacher/ai_teacher`
(Flask + Flask-SocketIO backend ≈ 6.4k LOC, Flutter Web/mobile frontend ≈ 6.6k LOC)
**Target system:** `/home/bishal-regmi/Desktop/ASchool` (Flask multi-tenant + Next.js 14 + 5 Flutter apps)
**Owner decision already made:** ASchool does **not** get the Sahayatri offline whiteboard. It gets
ARIA — an AI teacher that teaches live on an animated whiteboard with speech.
**Method:** every ATeacher backend service and Flutter file read in full; ASchool `services/ai/*`,
`models/ai_workbench.py`, `realtime.py`, plugin loader/manifests and the Next.js AI surface read
to the level needed to place each port precisely.

---

## TABLE OF CONTENTS

1. What ARIA is — product, personas, pedagogy, runtime loop
2. The teaching engine in detail — service-by-service, with prompts quoted verbatim
3. The wire protocol — every Socket.IO event, the streaming grammar, y-cursor engine, sync/barge-in
4. Data model — every ATeacher table/column + the 5 seeded personas
5. Flutter client — screens, canvas renderer, audio, captions, Ask UI, what's polished vs not
6. Quality verdict — production-grade vs prototype; bugs, security holes, dead paths (file:line)
7. **The ASchool integration blueprint** — plugin, files, token_hub routing, guardrails, tables,
   realtime design, web + mobile, Nepali, cost/perf, safety, phases, risks

---

# 1. WHAT ARIA IS

## 1.1 The product in one paragraph

ARIA is a **live one-to-one whiteboard tutor**. A student names a topic (or arrives with a chapter
of notes attached), and a selectable AI teacher persona begins *teaching* — speaking continuously
through Edge-TTS while simultaneously hand-writing text and drawing labelled SVG diagrams on an
animated canvas, chapter by chapter. The student can interrupt at any moment ("Ask"), by text,
by voice, or by tapping an item already on the board; the lesson pauses, the teacher answers on
the same board, then resumes exactly where it left off. At the end the system emits a lesson
summary and a per-concept mastery map. It is not a chatbot with a canvas bolted on: the board is
the primary output channel, and the speech is generated from the same token stream that produces
the drawing commands, so writing and narration are inherently synchronised.

## 1.2 Personas (the "multi-agent" layer)

Five teacher characters live as **rows** in `ateacher_teachers`, not as code
(`backend/models/database.py:49-133`, seeded by `backend/seed_teachers.py:42-408`). Each row carries
four independently editable prompt columns (`safety_rails`, `persona_block`,
`teaching_style_prompt`, `board_style_note`) that `PromptComposer` assembles at runtime
(`backend/services/prompt_composer.py:70-131`). Adding a teacher is an INSERT, not a deploy.
See §4.2 for the full seeded set.

## 1.3 Pedagogy stack (what is designed vs what actually runs)

<!-- APPEND-MARKER-A -->
