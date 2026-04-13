-- ============================================================
-- NIRA EMR — Supabase Schema with RLS
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLINICS
-- ============================================================
CREATE TABLE clinics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (linked to Supabase Auth)
-- ============================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id),
  role TEXT NOT NULL CHECK (role IN ('patient','doctor','nurse','admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialty TEXT,           -- doctors only
  license_number TEXT,      -- doctors only
  gender TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_clinic ON user_profiles(clinic_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE patients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  clinic_id UUID REFERENCES clinics(id),
  phone TEXT,
  email TEXT,
  abha TEXT,
  age INTEGER,
  gender TEXT,
  city TEXT,
  blood_group TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_user ON patients(user_id);

-- ============================================================
-- ENCOUNTERS (appointments / visits)
-- ============================================================
CREATE TABLE encounters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES user_profiles(id),
  clinic_id UUID REFERENCES clinics(id),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','arrived','in-progress','draft','final','cancelled')),
  type TEXT DEFAULT 'opd' CHECK (type IN ('opd','followup','emergency','teleconsult')),
  scheduled_time TIMESTAMPTZ,
  check_in_time TIMESTAMPTZ,
  completed_time TIMESTAMPTZ,
  chief_complaint TEXT,
  ai_prechart JSONB,        -- AI-generated pre-chart data
  doctor_notes JSONB,       -- Doctor's validated notes
  vitals JSONB,             -- { bp, pulse, temp, spo2, rr, weight, height, bmi }
  token_number INTEGER,
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_encounters_patient ON encounters(patient_id);
CREATE INDEX idx_encounters_doctor ON encounters(doctor_id);
CREATE INDEX idx_encounters_status ON encounters(status);
CREATE INDEX idx_encounters_clinic ON encounters(clinic_id);

-- ============================================================
-- MEDICATION REQUESTS (prescriptions)
-- ============================================================
CREATE TABLE medication_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES user_profiles(id),
  clinic_id UUID REFERENCES clinics(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  medications JSONB NOT NULL DEFAULT '[]',
  diagnosis TEXT,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medrx_patient ON medication_requests(patient_id);
CREATE INDEX idx_medrx_encounter ON medication_requests(encounter_id);

-- ============================================================
-- INTERVIEW SESSIONS (AI symptom interview)
-- ============================================================
CREATE TABLE interview_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'in-progress' CHECK (status IN ('in-progress','completed','abandoned')),
  transcript JSONB DEFAULT '[]',
  ai_summary JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function: get current user's clinic_id
CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- CLINICS: admins can manage their own clinic
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own clinic" ON clinics FOR SELECT
  USING (id = get_my_clinic_id());
CREATE POLICY "Admins manage clinic" ON clinics FOR ALL
  USING (id = get_my_clinic_id() AND get_my_role() = 'admin');

-- USER PROFILES: users see same clinic, edit own
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see same clinic" ON user_profiles FOR SELECT
  USING (clinic_id = get_my_clinic_id());
CREATE POLICY "Users edit own profile" ON user_profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "Admins manage users" ON user_profiles FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() = 'admin');

-- PATIENTS: clinic-scoped, patients see own
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff see patients" ON patients FOR SELECT
  USING (clinic_id = get_my_clinic_id());
CREATE POLICY "Patients see own record" ON patients FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Staff manage patients" ON patients FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor','nurse','admin'));

-- ENCOUNTERS: clinic-scoped + patient own
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff see clinic encounters" ON encounters FOR SELECT
  USING (clinic_id = get_my_clinic_id());
CREATE POLICY "Patients see own encounters" ON encounters FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors manage encounters" ON encounters FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor','nurse','admin'));

-- MEDICATION REQUESTS: clinic-scoped + patient own
ALTER TABLE medication_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff see clinic rx" ON medication_requests FOR SELECT
  USING (clinic_id = get_my_clinic_id());
CREATE POLICY "Patients see own rx" ON medication_requests FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors manage rx" ON medication_requests FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor','admin'));

-- INTERVIEW SESSIONS
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient own interviews" ON interview_sessions FOR ALL
  USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Staff see interviews" ON interview_sessions FOR SELECT
  USING (encounter_id IN (SELECT id FROM encounters WHERE clinic_id = get_my_clinic_id()));

-- AUDIT LOG: admins only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see audit" ON audit_log FOR SELECT
  USING (get_my_role() = 'admin');

-- ============================================================
-- REALTIME: Enable for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE encounters;
ALTER PUBLICATION supabase_realtime ADD TABLE medication_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE interview_sessions;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_encounters_updated BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_medrx_updated BEFORE UPDATE ON medication_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
