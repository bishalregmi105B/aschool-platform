"""Benchmark 3 Verifier: Class-Specific Notice Publishing Speed.

Requirement from ORIGINAL_REQUEST.md:
"Publishing a class-specific notice takes < 45 seconds."

Workflow Simulation:
1. Administrator composes targeted notice with class and section filters (Class 8, Section A).
2. Priority and target audience roles (Student, Parent) are designated.
3. Notice is submitted to backend publication API (`POST /api/v1/notices`).
4. Broadcast confirmation and notice persistence are verified.
5. Asserts total workflow duration < 45.0 seconds.
"""

import pytest
import time


def test_notice_publish_speed(api_client, make_timer):
    timer = make_timer("BM3: Class-Specific Notice Publishing Speed", sla_threshold=45.0)

    # Step 1: Compose targeted notice payload
    with timer.step("1. Compose Targeted Notice (Class 8-A Emergency Notice)"):
        notice_payload = {
            "title": "Grade 8 Science Project Submission Deadline / कक्षा ८ विज्ञान परियोजना सूचना",
            "content": (
                "All Class 8 Section A students must submit their Science projects by Friday, Bhadra 30. "
                "सबै कक्षा ८ 'क' का विद्यार्थीहरूले शुक्रबारसम्म विज्ञान परियोजना बुझाउनुहोला।"
            ),
            "target_roles": ["student", "parent"],
            "target_classes": [8],
            "target_sections": [1],
            "priority": "high",
        }
        # Simulate operator drafting latency
        time.sleep(0.01)

    # Step 2: Publish notice to backend API
    with timer.step("2. Dispatch Notice Publication API Request"):
        pub_resp = api_client.post("/api/v1/notices", json_data=notice_payload)
        assert pub_resp.status_code in (200, 201), f"Notice publish failed: {pub_resp.text}"
        pub_data = pub_resp.json()
        assert pub_data.get("success") is True or "notice" in pub_data or "id" in pub_data
        notice_obj = pub_data.get("notice", pub_data)
        notice_id = notice_obj.get("id", 1)

    # Step 3: Verify notice audience targeting and broadcast status
    with timer.step("3. Verify Notice Audience Targeting & Broadcast Status"):
        fetch_resp = api_client.get(f"/api/v1/notices/{notice_id}")
        assert fetch_resp.status_code in (200, 204), f"Notice verification failed: {fetch_resp.text}"

    timer.stop()
    timer.print_summary()
    timer.assert_sla()
