-- ============================================================
-- CARE WORKFLOW EXTENSIONS
-- Adds external/local key support for demo-driven sync and
-- durable tables for lab reports and patient-facing test orders.
-- ============================================================

-- ============================================================
-- EXTERNAL KEY SUPPORT FOR EXISTING TABLES
-- ============================================================

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS external_appointment_key TEXT,
  ADD COLUMN IF NOT EXISTS external_patient_key TEXT,
  ADD COLUMN IF NOT EXISTS external_doctor_key TEXT,
  ADD COLUMN IF NOT EXISTS external_clinic_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_encounters_external_appointment_key
  ON encounters(external_appointment_key);

ALTER TABLE medication_requests
  ADD COLUMN IF NOT EXISTS external_prescription_key TEXT,
  ADD COLUMN IF NOT EXISTS external_appointment_key TEXT,
  ADD COLUMN IF NOT EXISTS external_patient_key TEXT,
  ADD COLUMN IF NOT EXISTS external_doctor_key TEXT,
  ADD COLUMN IF NOT EXISTS external_clinic_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_medrx_external_prescription_key
  ON medication_requests(external_prescription_key);

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS external_interview_key TEXT,
  ADD COLUMN IF NOT EXISTS external_appointment_key TEXT,
  ADD COLUMN IF NOT EXISTS external_patient_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_sessions_external_interview_key
  ON interview_sessions(external_interview_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_sessions_external_appointment_key
  ON interview_sessions(external_appointment_key);

ALTER TABLE pre_check_questionnaires
  ALTER COLUMN doctor_id DROP NOT NULL,
  ALTER COLUMN patient_id DROP NOT NULL,
  ALTER COLUMN clinic_id DROP NOT NULL;

ALTER TABLE pre_check_questionnaires
  ADD COLUMN IF NOT EXISTS external_questionnaire_key TEXT,
  ADD COLUMN IF NOT EXISTS external_appointment_key TEXT,
  ADD COLUMN IF NOT EXISTS external_patient_key TEXT,
  ADD COLUMN IF NOT EXISTS external_doctor_key TEXT,
  ADD COLUMN IF NOT EXISTS external_clinic_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_precheck_external_questionnaire_key
  ON pre_check_questionnaires(external_questionnaire_key);

ALTER TABLE notifications
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS external_notification_key TEXT,
  ADD COLUMN IF NOT EXISTS external_user_key TEXT,
  ADD COLUMN IF NOT EXISTS external_appointment_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_external_notification_key
  ON notifications(external_notification_key);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'appointment_booked',
  'precheck_questions_ready',
  'precheck_sent',
  'precheck_completed',
  'appointment_reminder',
  'appointment_missed',
  'prescription_approved',
  'tests_ordered',
  'lab_report_ready',
  'emr_updated'
));

-- ============================================================
-- LAB REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS lab_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES user_profiles(id),
  clinic_id UUID REFERENCES clinics(id),
  external_report_key TEXT NOT NULL,
  external_appointment_key TEXT,
  external_patient_key TEXT,
  external_doctor_key TEXT,
  external_clinic_key TEXT,
  title TEXT NOT NULL,
  category TEXT,
  findings TEXT,
  result_summary TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending','final','archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_reports_external_report_key
  ON lab_reports(external_report_key);
CREATE INDEX IF NOT EXISTS idx_lab_reports_encounter ON lab_reports(encounter_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient ON lab_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_doctor ON lab_reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_external_appointment ON lab_reports(external_appointment_key);

-- ============================================================
-- TEST ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS test_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES user_profiles(id),
  clinic_id UUID REFERENCES clinics(id),
  external_order_key TEXT NOT NULL,
  external_appointment_key TEXT,
  external_patient_key TEXT,
  external_doctor_key TEXT,
  external_clinic_key TEXT,
  doctor_name TEXT,
  tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  patient_note TEXT,
  status TEXT DEFAULT 'ordered' CHECK (status IN ('draft','ordered','none','completed','cancelled')),
  ordered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_orders_external_order_key
  ON test_orders(external_order_key);
CREATE INDEX IF NOT EXISTS idx_test_orders_encounter ON test_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_test_orders_patient ON test_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_test_orders_doctor ON test_orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_test_orders_external_appointment ON test_orders(external_appointment_key);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff see clinic lab reports" ON lab_reports;
CREATE POLICY "Staff see clinic lab reports" ON lab_reports FOR SELECT
  USING (clinic_id = get_my_clinic_id());

DROP POLICY IF EXISTS "Patients see own lab reports" ON lab_reports;
CREATE POLICY "Patients see own lab reports" ON lab_reports FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Doctors manage lab reports" ON lab_reports;
CREATE POLICY "Doctors manage lab reports" ON lab_reports FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor','nurse','admin'));

DROP POLICY IF EXISTS "Staff see clinic test orders" ON test_orders;
CREATE POLICY "Staff see clinic test orders" ON test_orders FOR SELECT
  USING (clinic_id = get_my_clinic_id());

DROP POLICY IF EXISTS "Patients see own test orders" ON test_orders;
CREATE POLICY "Patients see own test orders" ON test_orders FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Doctors manage test orders" ON test_orders;
CREATE POLICY "Doctors manage test orders" ON test_orders FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor','nurse','admin'));

-- ============================================================
-- REALTIME
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lab_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lab_reports;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'test_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE test_orders;
  END IF;
END $$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_lab_reports_updated ON lab_reports;
CREATE TRIGGER trg_lab_reports_updated BEFORE UPDATE ON lab_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_orders_updated ON test_orders;
CREATE TRIGGER trg_test_orders_updated BEFORE UPDATE ON test_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
