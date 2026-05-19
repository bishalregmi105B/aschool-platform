# ASchool Simulation Artifacts

This directory stores generated simulation outputs and final reports from `simulate.md` execution.

## Generated Test Suites
- Backend: `backend/tests/simulation/test_full_simulation_modules.py`
- Frontend: `frontend/__tests__/simulation.security-regression.test.ts`
- Flutter: `flutter_shared/test/simulation/security_regression_test.dart`

## Execution Commands
- Backend (Docker): `docker compose exec flask pytest tests/simulation/test_full_simulation_modules.py -v`
- Frontend (Docker): `docker compose exec nextjs npm test -- --runInBand __tests__/simulation.security-regression.test.ts`
- Flutter: `cd flutter_shared && flutter test test/simulation/security_regression_test.dart`
