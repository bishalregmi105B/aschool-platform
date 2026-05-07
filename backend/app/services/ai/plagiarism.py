"""AI Plagiarism Checker — basic assignment plagiarism detection."""
import logging
import hashlib
from collections import Counter

logger = logging.getLogger(__name__)


class PlagiarismChecker:
    """Basic plagiarism detection using text similarity (n-gram fingerprinting)."""

    @staticmethod
    def _ngrams(text: str, n: int = 5) -> list:
        words = text.lower().split()
        return [" ".join(words[i:i + n]) for i in range(len(words) - n + 1)]

    @staticmethod
    def _fingerprint(text: str) -> set:
        ngrams = PlagiarismChecker._ngrams(text)
        return {hashlib.md5(ng.encode()).hexdigest()[:8] for ng in ngrams}

    @staticmethod
    def check_similarity(text1: str, text2: str) -> float:
        """Calculate Jaccard similarity between two texts (0.0 to 1.0)."""
        fp1 = PlagiarismChecker._fingerprint(text1)
        fp2 = PlagiarismChecker._fingerprint(text2)

        if not fp1 or not fp2:
            return 0.0

        intersection = fp1 & fp2
        union = fp1 | fp2
        return len(intersection) / len(union) if union else 0.0

    @staticmethod
    def check_against_corpus(text: str, corpus: list[dict]) -> dict:
        """Check text against a corpus of submissions.

        Args:
            text: The submission to check
            corpus: List of {"id": str, "text": str} dicts

        Returns:
            Dict with similarity scores and flagged matches
        """
        results = []
        for doc in corpus:
            similarity = PlagiarismChecker.check_similarity(text, doc["text"])
            if similarity > 0.15:  # Only report > 15% similarity
                results.append({
                    "id": doc["id"],
                    "similarity": round(similarity * 100, 1),
                    "flag": "high" if similarity > 0.6 else "medium" if similarity > 0.3 else "low",
                })

        results.sort(key=lambda x: x["similarity"], reverse=True)

        max_sim = results[0]["similarity"] if results else 0
        return {
            "is_original": max_sim < 30,
            "max_similarity": max_sim,
            "matches": results[:5],
            "verdict": "plagiarized" if max_sim > 60 else "suspicious" if max_sim > 30 else "original",
        }

    @staticmethod
    def check_assignment_batch(submissions: list[dict]) -> list:
        """Cross-check all submissions in a batch against each other.

        Args:
            submissions: List of {"id": str, "student_id": str, "text": str}
        """
        results = []
        for i, sub in enumerate(submissions):
            corpus = [{"id": s["id"], "text": s["text"]} for j, s in enumerate(submissions) if j != i]
            check = PlagiarismChecker.check_against_corpus(sub["text"], corpus)
            results.append({
                "student_id": sub["student_id"],
                "submission_id": sub["id"],
                **check,
            })
        return results
