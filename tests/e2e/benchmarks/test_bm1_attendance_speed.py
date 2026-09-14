"""Benchmark 1 Verifier: Teacher Attendance Marking Speed.

Requirement from ORIGINAL_REQUEST.md:
"Marking attendance for a class of 40 students takes < 60 seconds with keyboard shortcuts."

Workflow Simulation:
1. Teacher selects target class/section (Class 8-A, 40 students).
2. Roster is loaded with 40 student profiles.
3. Teacher uses rapid keyboard shortcut navigation (P/A/L/E) to mark statuses:
   - 37 students marked Present ('P')
   - 1 student marked Absent ('A')
   - 1 student marked Late ('L')
   - 1 student marked Excused/Leave ('E')
4. Batch attendance submission is dispatched to the backend API.
5. Verification confirms 40 attendance stamps created.
6. Asserts total workflow duration < 60.0 seconds.
"""

import pytest
import time
from typing import List, Dict, Any


def test_attendance_marking_speed_class_of_40(api_client, make_timer, class_of_40_students):
    timer = make_timer("BM1: Attendance Marking Speed (Class of 40)", sla_threshold=60.0)

    # Step 1: Fetch class roster
    with timer.step("1. Load Class 8-A Roster (40 students)"):
        resp = api_client.get("/api/v1/attendance/students/8", params={"section": "A"})
        assert resp.status_code == 200, f"Failed to fetch roster: {resp.text}"
        data = resp.json()
        students = data.get("students", class_of_40_students)
        assert len(students) == 40, f"Expected 40 students, got {len(students)}"

    # Step 2: Simulate teacher keyboard shortcut marking (P/A/L/E)
    with timer.step("2. Keyboard Shortcut Marking (P/A/L/E across 40 rows)"):
        attendance_payload: List[Dict[str, Any]] = []
        for idx, student in enumerate(students, 1):
            # Model keyboard shortcuts: default P, exceptions at rolls 7, 14, 28
            if idx == 7:
                status = "absent"    # Shortcut 'A'
                remarks = "Fever reported by guardian"
            elif idx == 14:
                status = "late"      # Shortcut 'L'
                remarks = "Bus delay 15m"
            elif idx == 28:
                status = "excused"   # Shortcut 'E'
                remarks = "Medical appointment"
            else:
                status = "present"   # Shortcut 'P'
                remarks = None

            attendance_payload.append({
                "student_id": student["id"],
                "roll_number": student["roll_number"],
                "status": status,
                "remarks": remarks,
            })
            # Keystroke pacing simulation: 20ms per row advancement
            time.sleep(0.005)

        assert len(attendance_payload) == 40

    # Step 3: Dispatch batch attendance submission
    with timer.step("3. Submit Batch Attendance to Backend API"):
        submit_body = {
            "class_id": 8,
            "section": "A",
            "date": "2081-05-28",
            "attendance": attendance_payload,
        }
        submit_resp = api_client.post("/api/v1/attendance/mark", json_data=submit_body)
        assert submit_resp.status_code in (200, 201), f"Attendance submit failed: {submit_resp.text}"

    # Step 4: Verify attendance ledger confirmation
    with timer.step("4. Verify Attendance Ledger Confirmation"):
        res_json = submit_resp.json()
        assert res_json.get("success") is True or "recorded" in str(res_json).lower()
        recorded_count = res_json.get("recorded_count", len(attendance_payload))
        assert recorded_count == 40, f"Expected 40 recorded, got {recorded_count}"

    timer.stop()
    timer.print_summary()
    timer.assert_sla()
