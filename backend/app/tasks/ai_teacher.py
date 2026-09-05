"""Celery wrappers for the AI Teacher plugin tasks (T-20 close).

tasks.py in the plugin module holds the plain functions — they were never
registered on Celery, so the reconciler and transcript purge could never
run. This module is the @celery.task layer (the same pattern every other
task module uses) and is imported by app.tasks for autodiscovery.
"""
from extensions import celery


@celery.task(name="ai_teacher_reconcile_lessons")
def reconcile_lessons_task():
    from app.plugins.modules.ai_teacher.tasks import reconcile_lessons

    return reconcile_lessons()


@celery.task(name="ai_teacher_purge_transcripts")
def purge_transcripts_task():
    from app.plugins.modules.ai_teacher.tasks import purge_transcripts

    return purge_transcripts()
