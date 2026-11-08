# Identity foundation — approved schema

Status: implementation draft created; not applied to Supabase.

## Ownership

- Supabase Auth owns `auth.users`.
- Django owns `public.profiles` and `public.username_history`.
- `profiles.id` mirrors `auth.users.id`; the PostgreSQL migration adds an `ON DELETE CASCADE` foreign key when the `auth.users` relation exists.
- No Django built-in User model is introduced.

## Profile rules

- Username: 3–20 lowercase ASCII letters, digits, or underscores.
- Current usernames are case-insensitively unique.
- Display name is optional. The application displays `username` when `display_name` is empty.
- Avatar data is stored in a private Supabase Storage bucket. `avatar_path` stores only the object path, never a public URL or file bytes.
- `role` is limited to `user` and `admin`.
- Country code is optional and uses two uppercase letters.
- `username_changed_at` is null until the username has been changed from its initial value; the username-change service enforces the 30-day cooldown.

## Username history rules

- A username change creates a history row for the old username.
- `available_at` is 90 days after `changed_at`.
- A history row with `reclaimed_at IS NULL` represents an outstanding reservation. It ceases to reserve the name when the 90-day period expires and a later claim operation marks it reclaimed.
- On reuse, the claim operation sets `reclaimed_at` and `reclaimed_by_profile_id`.
- The partial unique index prevents duplicate outstanding history reservations for the same case-insensitive username.
- `profile_id` cascades on profile deletion. `reclaimed_by_profile_id` uses SET NULL so deleting the reclaimer does not delete another user's history record.

## Concurrency requirement

A future username-change/claim service must use a PostgreSQL transaction and a per-username advisory lock. It must:
1. Normalize and validate the requested username.
2. Lock the normalized username.
3. Check `profiles` for a current owner.
4. Check `username_history` for an unexpired reservation.
5. If an expired reservation exists, mark it reclaimed and record the claiming profile.
6. Update the profile and create the previous-name history row in the same transaction.

The database indexes enforce uniqueness within each table. The cross-table check must be implemented in the service transaction; do not expose direct client writes to these tables.

## Not included yet

- Supabase Auth signup trigger that provisions a profile.
- RLS policies and grants.
- Storage bucket creation and Storage policies.
- Username change service / API endpoint.
- Community discoverability and visibility controls.
- Applying migrations to Supabase.

These require their own reviewed implementation steps.
