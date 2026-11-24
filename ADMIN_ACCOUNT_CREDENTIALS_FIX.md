# Administrator account API changes

`POST /api/admin/users` now requires `fullName`, `username`, `email`, `phone`, `password` (minimum 8 characters), `role`, and `permissions` as applicable. Passwords are bcrypt-hashed and never returned. New accounts are active and have `must_change_password=true`.

`GET /api/auth/me` remains available after sign-in so the client can read the password-change flag. `POST /api/auth/change-password` remains available and clears the flag. Other administrative API routes reject access while the flag is set. Existing databases receive `admin_users.phone` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; no data is dropped.

The login identifier remains username or email; phone is stored as the user's contact number.
