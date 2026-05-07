"""AI Question Paper Generator — Bloom's taxonomy-aware exam generation."""

import json
from flask import current_app


class QuestionPaperService:
    """Generate exam papers using Claude AI with curriculum alignment."""

    MODEL = "claude-sonnet-4-20250514"

    @staticmethod
    def _get_client():
        import anthropic
        return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])

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
    ) -> dict:
        """Generate a complete exam paper with optional answer key."""

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

        client = cls._get_client()
        response = client.messages.create(
            model=cls.MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            text = response.content[0].text
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
    def generate_remark(cls, student_name: str, marks: dict, total: float, percentage: float) -> str:
        """Generate a personalized report card remark."""
        import anthropic

        client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])
        prompt = f"""Write a brief, encouraging report card remark (2-3 sentences) for:
Student: {student_name}
Subject Marks: {json.dumps(marks)}
Total: {total}, Percentage: {percentage}%

Be specific about strengths/areas for improvement. Appropriate for Nepal school context."""

        response = client.messages.create(
            model="claude-haiku-4-5-20241022",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
