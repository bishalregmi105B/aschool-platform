"""AI Question Paper Generator — Bloom's taxonomy-aware exam generation.

All LLM calls route through AITokenHub — per-school quota enforcement and
usage logging happen there (E7: no direct Anthropic calls).
"""

import json

from app.services.ai.token_hub import AITokenHub


class QuestionPaperService:
    """Generate exam papers using AI with curriculum alignment."""

    @classmethod
    def generate_paper(
        cls,
        subject: str,
        grade: int,
        total_marks: int,
        duration_minutes: int,
        topics: list[str] | None = None,
        difficulty: str = "medium",
        include_answer_key: bool = True,
        question_types: list[str] | None = None,
        language: str = "english",
        school_id=None,
        user_id=None,
    ) -> dict:
        """Generate a complete exam paper with optional answer key.

        school_id/user_id are optional — resolved from the request context
        (``g``) when omitted, so existing callers work unchanged.
        """

        q_types = question_types or ["mcq", "short_answer", "long_answer"]

        prompt = f"""You are an expert exam paper creator for schools in Nepal.
Create a well-structured exam paper with these specifications:

Subject: {subject}
Grade: {grade}
Total Marks: {total_marks}
Duration: {duration_minutes} minutes
Difficulty: {difficulty}
Topics: {', '.join(topics) if topics else 'Full syllabus'}
Question Types: {', '.join(q_types)}
Language: {language}

Requirements:
- Follow Nepal's CDC (Curriculum Development Centre) guidelines
- Include Bloom's Taxonomy distribution (Remember 20%, Understand 25%, Apply 25%, Analyze 15%, Evaluate/Create 15%)
- Mark allocation should be clearly specified for each question
- Group questions by type with clear section headers
- Total marks must equal {total_marks}

Return a JSON object:
{{
  "title": "exam paper title",
  "subject": "{subject}",
  "grade": {grade},
  "total_marks": {total_marks},
  "duration": "{duration_minutes} minutes",
  "instructions": ["list of general instructions"],
  "sections": [
    {{
      "name": "Section A - Multiple Choice",
      "marks": 10,
      "instructions": "Choose the correct answer.",
      "questions": [
        {{
          "number": 1,
          "text": "question text",
          "marks": 1,
          "type": "mcq",
          "options": ["a) ...", "b) ...", "c) ...", "d) ..."],
          "bloom_level": "remember",
          "answer": "a) correct answer",
          "explanation": "brief explanation"
        }}
      ]
    }}
  ],
  "bloom_distribution": {{"remember": 5, "understand": 6, ...}},
  "marks_distribution": {{"Section A": 10, "Section B": 20, ...}}
}}"""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="question-paper:generate",
            messages=[{"role": "user", "content": prompt}],
            model="smart",  # quality tier (sonnet-class model via hub routing)
            max_tokens=4096,
            temperature=1.0,  # matches the previous direct Anthropic default
            metadata={"subject": subject, "grade": grade, "difficulty": difficulty},
        )["text"]

        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            paper = json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"error": "Failed to generate paper. Please try again."}

        if not include_answer_key:
            for section in paper.get("sections", []):
                for q in section.get("questions", []):
                    q.pop("answer", None)
                    q.pop("explanation", None)

        return paper

    @classmethod
    def generate_remark(
        cls,
        student_name: str,
        marks: dict,
        total: float,
        percentage: float,
        school_id=None,
        user_id=None,
    ) -> str:
        """Generate a personalized report card remark."""
        prompt = f"""Write a brief, encouraging report card remark (2-3 sentences) for:
Student: {student_name}
Subject Marks: {json.dumps(marks)}
Total: {total}, Percentage: {percentage}%

Be specific about strengths/areas for improvement. Appropriate for Nepal school context."""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="question-paper:remark",
            messages=[{"role": "user", "content": prompt}],
            model="fast",  # haiku-class model via hub routing
            max_tokens=200,
            temperature=1.0,  # matches the previous direct Anthropic default
            metadata={"student_name": student_name},
        )["text"]
        return text.strip()

    @classmethod
    def generate_letter(
        cls,
        letter_type: str,
        recipient: str,
        subject: str,
        context: str = "",
        tone: str = "formal",
        school_id=None,
        user_id=None,
    ) -> str:
        """Generate a school letter/circular/notice draft (web Letter Writer)."""
        prompt = f"""Write a {tone} school {letter_type.replace('_', ' ')} letter.

Recipient: {recipient or 'Parents / Students'}
Subject: {subject}
Context / instructions: {context or 'None provided'}

Requirements:
- Complete, ready-to-send letter body (no placeholders like [Your Name]).
- Professional tone appropriate for a Nepali school context.
- Include a subject line when the format calls for one, and a natural sign-off."""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        text = AITokenHub.request(
            school_id=school_id,
            user_id=user_id,
            feature="letter-writer:generate",
            messages=[{"role": "user", "content": prompt}],
            model="fast",  # haiku-class model via hub routing
            max_tokens=900,
            temperature=0.7,
            metadata={"letter_type": letter_type},
        )["text"]
        return text.strip()
