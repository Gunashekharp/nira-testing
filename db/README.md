# NIRA MongoDB Setup

This repo now includes a runnable MongoDB schema and development seed for the local `nira_db` database.

## Environment

Create `.env.local` in the project root if your MongoDB URI or database name differs from the defaults:

```env
NIRA_MONGODB_URI=mongodb://127.0.0.1:27017
NIRA_MONGODB_DB_NAME=nira_db
```

## Commands

Run from the project root:

```powershell
npm.cmd run db:init
npm.cmd run db:seed
npm.cmd run db:status
npm.cmd run db:reset
```

Command behavior:

- `db:init`: creates all managed collections, validators, and indexes.
- `db:seed`: upserts the pilot clinic records, doctors, patients, appointments, encounters, prescriptions, and audit logs.
- `db:status`: shows document counts and index counts for each managed collection.
- `db:reset`: drops all managed collections, recreates them, and reseeds the database.

## Seeded Login Credentials

Default seed credentials:

- Admin: `admin@nira.local / Admin@123`
- Doctors: `*.nira.local / Doctor@123`
- Patients: seeded phone numbers / `Patient@123`

The `db:seed` command prints the full seeded credential list after completion.

## Collections

Managed collections in `nira_db`:

- `clinics`
- `users`
- `patient_profiles`
- `doctor_profiles`
- `admin_profiles`
- `doctor_availability_templates`
- `doctor_day_schedules`
- `appointments`
- `encounters`
- `prescriptions`
- `auth_sessions`
- `audit_logs`

## Operational Notes

- All operational records include `clinicId` for future multi-clinic scale.
- `doctor_day_schedules` is the booking read/write boundary for fast slot claiming.
- `appointments` stores doctor and patient snapshots for fast dashboard reads.
- `encounters` stores the full APCI workflow in one document for efficient doctor review loads.
- Passwords are stored only as derived hashes, never as plain text.
