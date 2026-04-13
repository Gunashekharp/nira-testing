-- ============================================================
-- PRE-CHECK QUESTIONS & NOTIFICATIONS TABLES
-- ============================================================

-- ============================================================
-- PRE-CHECK QUESTIONNAIRES (Doctor-generated Q&A for patients)
-- ============================================================
CREATE TABLE pre_check_questionnaires (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES user_profiles(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  
  -- AI-generated questions (doctor can edit)
  ai_questions JSONB NOT NULL DEFAULT '[]',     -- [{ id, question, type, options?, required }]
  edited_questions JSONB NOT NULL DEFAULT '[]',  -- Doctor's edited version
  
  -- Patient responses
  patient_responses JSONB DEFAULT '{}',           -- { questionId: answer }
  
  -- Status tracking
  status TEXT DEFAULT 'ai_generated' CHECK (status IN (
    'ai_generated',      -- AI created questions
    'doctor_editing',    -- Doctor is editing
    'sent_to_patient',   -- Questions sent to patient
    'patient_responding', -- Patient answering
    'completed',         -- Patient submitted answers
    'reviewed_by_doctor' -- Doctor reviewed answers
  )),
  
  ai_generated_at TIMESTAMPTZ DEFAULT NOW(),
  doctor_confirmed_at TIMESTAMPTZ,
  sent_to_patient_at TIMESTAMPTZ,
  patient_completed_at TIMESTAMPTZ,
  doctor_reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_precheck_encounter ON pre_check_questionnaires(encounter_id);
CREATE INDEX idx_precheck_patient ON pre_check_questionnaires(patient_id);
CREATE INDEX idx_precheck_doctor ON pre_check_questionnaires(doctor_id);
CREATE INDEX idx_precheck_status ON pre_check_questionnaires(status);

-- ============================================================
-- NOTIFICATIONS (Doctor & Patient notifications)
-- ============================================================
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Notification context
  type TEXT NOT NULL CHECK (type IN (
    'appointment_booked',      -- Appointment created
    'precheck_questions_ready', -- Doctor generated questions
    'precheck_sent',           -- Patient received pre-check
    'precheck_completed',      -- Patient answered questions
    'appointment_reminder',    -- Upcoming appointment
    'prescription_approved',   -- Rx approved
    'emr_updated'             -- EMR updated
  )),
  
  title TEXT NOT NULL,
  message TEXT,
  
  -- Link to relevant records
  encounter_id UUID REFERENCES encounters(id),
  questionnaire_id UUID REFERENCES pre_check_questionnaires(id),
  prescription_id UUID REFERENCES medication_requests(id),
  
  -- Notification status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Delivery tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_encounter ON notifications(encounter_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- PRE_CHECK_QUESTIONNAIRES
ALTER TABLE pre_check_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients see own pre-check" ON pre_check_questionnaires FOR SELECT
  USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));

CREATE POLICY "Doctors see their pre-checks" ON pre_check_questionnaires FOR SELECT
  USING (doctor_id = auth.uid() OR 
         encounter_id IN (SELECT id FROM encounters WHERE doctor_id = auth.uid()));

CREATE POLICY "Staff manage pre-checks" ON pre_check_questionnaires FOR ALL
  USING (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor','admin'));

-- NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users mark own as read" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System creates notifications" ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pre_check_questionnaires;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================
CREATE TRIGGER trg_precheck_updated BEFORE UPDATE ON pre_check_questionnaires
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notifications_updated BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
