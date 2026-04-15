-- Ensure patient records can be upserted by auth user id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_id_unique
  ON patients(user_id);
