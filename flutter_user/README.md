# ASchool Unified User App

This app consolidates user-facing roles into a single app:

- Student
- Parent
- Teacher

Admin remains separate in `flutter_admin`.

## How It Works

- Users choose Student, Parent, or Teacher on one login screen.
- After login, the app reads `user.role` and launches the corresponding role app.
- Unsupported roles (for example admin-side roles) are blocked with guidance to use admin app.

## Dependencies

This app reuses existing projects as path packages:

- `../flutter_shared`
- `../flutter_student`
- `../flutter_parent`
- `../flutter_teacher`

## Run

```bash
cd flutter_user
flutter pub get
flutter run
```
