# Database Setup — MongoDB

This replaces the old `database/schema.sql` + `database/seed.sql` workflow from
the MySQL version of this project.

## Why there's no `schema.js`

MongoDB doesn't have a `CREATE DATABASE` / `CREATE TABLE` step. The
`agri_sharing` database and all 10 collections are created automatically the
first time a document is written to them — Mongoose handles this for you.

The old SQL schema's columns, enums, foreign keys, and indexes all still
exist — they just now live as Mongoose schema definitions directly inside
each `models/*.js` file (e.g. `models/equipmentModel.js` defines the
`equipment_type` enum, the `owner_id` reference, and the `status`/`district`
indexes that used to be declared in `schema.sql`).

| Old MySQL table | Now lives in |
|---|---|
| `users` | `models/userModel.js` |
| `profiles` | `models/profileModel.js` |
| `kyc` | `models/kycModel.js` |
| `equipment` | `models/equipmentModel.js` |
| `equipment_images` | embedded as `Equipment.images: [String]` (no separate collection — see migration notes) |
| `labour_profiles` | `models/labourModel.js` (`LabourProfile`) |
| `labour_jobs` | `models/labourModel.js` (`LabourJob`) |
| `bookings` | `models/bookingModel.js` |
| `handovers` | *(not migrated — the original app code never actually used this table; handover fields live directly on `bookings`)* |
| `ratings` | `models/ratingModel.js` |
| `disputes` | `models/disputeModel.js` |
| `notifications` | `models/notificationModel.js` |

## Setup

1. **Start MongoDB** (locally or via a service):
   ```bash
   mongod --dbpath /path/to/your/data/dir
   ```
   Or if installed as a system service:
   ```bash
   sudo systemctl start mongod
   ```

2. **Point the backend at it** — already set in `.env`:
   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/agri_sharing
   ```
   No manual database creation needed — connecting and inserting the first
   document creates it automatically.

3. **Seed demo data** (equivalent of the old `seed.sql`):
   ```bash
   npm run seed
   ```
   This creates 3 demo users (Farmer, Equipment Owner, Farm Labourer) with
   profiles and KYC statuses, 2 pre-approved equipment listings with images,
   and 1 open labour job posting — same data as the original `seed.sql`,
   inserted through the real Mongoose models (not raw driver calls), so it
   exercises the same code path the app itself uses.

   It's safe to run more than once — it matches existing demo users by email
   and equipment by owner, so it won't create duplicates.

   > Demo users have **no password set** (matching the original seed.sql's
   > behavior) — sign up for real accounts through the app's normal signup
   > flow to test login end-to-end, or use `npm run create-admin` for the
   > one ADMIN account.

4. **Verify it worked** — connect with `mongosh` or MongoDB Compass:
   ```bash
   mongosh mongodb://127.0.0.1:27017/agri_sharing
   > show collections
   > db.equipment.find().pretty()
   ```
   You should see `users, profiles, kycs, equipment, labourprofiles,
   labourjobs, bookings, disputes, ratings, notifications` — collection names
   are the lowercased, pluralized version of each Mongoose model name.

## Old files

`schema.sql` and `seed.sql` are kept in this folder for historical reference
only (e.g. if you ever need to see exactly what the old MySQL structure
looked like) — they are **not used** by the running application anymore.
