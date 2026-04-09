const objectIdField = (description) => ({
  bsonType: "objectId",
  description
});

const nullableObjectIdField = (description) => ({
  bsonType: ["objectId", "null"],
  description
});

const stringField = (description, minLength = 1) => ({
  bsonType: "string",
  minLength,
  description
});

const nullableStringField = (description) => ({
  bsonType: ["string", "null"],
  description
});

const booleanField = (description) => ({
  bsonType: "bool",
  description
});

const dateField = (description) => ({
  bsonType: "date",
  description
});

const nullableDateField = (description) => ({
  bsonType: ["date", "null"],
  description
});

const stringEnumField = (values, description) => ({
  bsonType: "string",
  enum: values,
  description
});

const baseMetadata = {
  createdAt: dateField("Creation timestamp"),
  updatedAt: dateField("Last updated timestamp")
};

const weekdayRule = {
  bsonType: "object",
  required: ["enabled", "windows", "breaks"],
  properties: {
    enabled: booleanField("Whether the doctor works on this weekday"),
    windows: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["startTime", "endTime"],
        properties: {
          startTime: stringField("Window start time in HH:mm"),
          endTime: stringField("Window end time in HH:mm")
        }
      }
    },
    breaks: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["startTime", "endTime"],
        properties: {
          startTime: stringField("Break start time in HH:mm"),
          endTime: stringField("Break end time in HH:mm")
        }
      }
    }
  }
};

const slotShape = {
  bsonType: "object",
  required: ["slotId", "startAt", "endAt", "status", "appointmentId", "patientId", "bookedAt", "closedReason"],
  properties: {
    slotId: stringField("Unique slot identifier"),
    startAt: dateField("Slot start timestamp"),
    endAt: dateField("Slot end timestamp"),
    status: stringEnumField(["available", "booked", "unavailable"], "Current slot status"),
    appointmentId: nullableObjectIdField("Linked appointment when booked"),
    patientId: nullableObjectIdField("Linked patient when booked"),
    bookedAt: nullableDateField("Slot booking timestamp"),
    closedReason: nullableStringField("Reason the slot is unavailable")
  }
};

export const collectionDefinitions = [
  {
    name: "clinics",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["clinicId", "name", "timezone", "address", "contact", "status", "createdAt", "updatedAt"],
        properties: {
          clinicId: stringField("Stable clinic identifier"),
          name: stringField("Clinic name"),
          timezone: stringField("Clinic timezone"),
          address: {
            bsonType: "object",
            required: ["line1", "city", "state", "postalCode", "country"],
            properties: {
              line1: stringField("Address line 1"),
              line2: nullableStringField("Address line 2"),
              city: stringField("Clinic city"),
              state: stringField("Clinic state"),
              postalCode: stringField("Postal code"),
              country: stringField("Country")
            }
          },
          contact: {
            bsonType: "object",
            required: ["phone", "email"],
            properties: {
              phone: stringField("Primary clinic phone"),
              email: stringField("Primary clinic email")
            }
          },
          status: stringEnumField(["active", "inactive"], "Clinic operational state"),
          ...baseMetadata
        }
      }
    },
    indexes: [{ key: { clinicId: 1 }, options: { unique: true, name: "clinics_clinicId_unique" } }]
  },
  {
    name: "users",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "role",
          "status",
          "phone",
          "email",
          "passwordHash",
          "profileId",
          "lastLoginAt",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          role: stringEnumField(["patient", "doctor", "admin"], "System role"),
          status: stringEnumField(
            ["active", "pending_approval", "inactive", "archived"],
            "Current account lifecycle state"
          ),
          phone: nullableStringField("Patient phone login"),
          email: nullableStringField("Doctor/admin email login"),
          passwordHash: stringField("Derived password hash"),
          profileId: objectIdField("Linked profile identifier"),
          lastLoginAt: nullableDateField("Last login timestamp"),
          createdAt: dateField("Creation timestamp"),
          updatedAt: dateField("Last updated timestamp")
        }
      }
    },
    indexes: [
      {
        key: { role: 1, phone: 1 },
        options: {
          unique: true,
          name: "users_patient_phone_unique",
          partialFilterExpression: {
            role: "patient",
            phone: { $exists: true, $type: "string" }
          }
        }
      },
      {
        key: { role: 1, email: 1 },
        options: {
          unique: true,
          name: "users_staff_email_unique",
          partialFilterExpression: {
            role: { $in: ["doctor", "admin"] },
            email: { $exists: true, $type: "string" }
          }
        }
      },
      {
        key: { clinicId: 1, role: 1, status: 1 },
        options: { name: "users_clinic_role_status" }
      }
    ]
  },
  {
    name: "patient_profiles",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "userId",
          "fullName",
          "gender",
          "age",
          "phone",
          "city",
          "preferredLanguage",
          "abha",
          "emergencyContact",
          "lastVisitSummary",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          userId: objectIdField("Linked user"),
          fullName: stringField("Patient full name"),
          gender: stringField("Patient gender"),
          age: {
            bsonType: "int",
            minimum: 0,
            description: "Patient age in years"
          },
          dob: nullableDateField("Optional date of birth"),
          phone: stringField("Patient phone"),
          city: stringField("City"),
          preferredLanguage: stringEnumField(["en", "hi"], "Patient preferred language"),
          abha: {
            bsonType: "object",
            required: ["linked", "number"],
            properties: {
              linked: booleanField("Whether ABHA is linked"),
              number: nullableStringField("ABHA number")
            }
          },
          emergencyContact: {
            bsonType: "object",
            required: ["name", "phone"],
            properties: {
              name: stringField("Emergency contact name"),
              phone: stringField("Emergency contact phone")
            }
          },
          lastVisitSummary: {
            bsonType: "object",
            required: ["lastVisitDate", "lastDiagnosis"],
            properties: {
              lastVisitDate: nullableDateField("Last visit timestamp"),
              lastDiagnosis: nullableStringField("Most recent diagnosis")
            }
          },
          ...baseMetadata
        }
      }
    },
    indexes: [
      { key: { userId: 1 }, options: { unique: true, name: "patient_profiles_user_unique" } },
      { key: { clinicId: 1, phone: 1 }, options: { name: "patient_profiles_clinic_phone" } }
    ]
  },
  {
    name: "doctor_profiles",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "userId",
          "fullName",
          "specialty",
          "licenseNumber",
          "experienceYears",
          "acceptingAppointments",
          "status",
          "consultationMode",
          "slotDurationMinutes",
          "bufferMinutes",
          "bio",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          userId: objectIdField("Linked user"),
          fullName: stringField("Doctor full name"),
          specialty: stringField("Primary specialty"),
          licenseNumber: stringField("Doctor registration number"),
          experienceYears: {
            bsonType: "int",
            minimum: 0,
            description: "Years of experience"
          },
          acceptingAppointments: booleanField("Whether the doctor is open for bookings"),
          status: stringEnumField(
            ["active", "pending_approval", "inactive", "archived"],
            "Doctor availability in the platform"
          ),
          consultationMode: stringEnumField(["opd", "teleconsult", "hybrid"], "Consultation mode"),
          slotDurationMinutes: {
            bsonType: "int",
            minimum: 5,
            maximum: 120,
            description: "Default slot duration"
          },
          bufferMinutes: {
            bsonType: "int",
            minimum: 0,
            maximum: 60,
            description: "Gap between slots"
          },
          bio: nullableStringField("Doctor bio"),
          ...baseMetadata
        }
      }
    },
    indexes: [
      { key: { userId: 1 }, options: { unique: true, name: "doctor_profiles_user_unique" } },
      {
        key: { clinicId: 1, status: 1, acceptingAppointments: 1, specialty: 1 },
        options: { name: "doctor_profiles_clinic_status_specialty" }
      }
    ]
  },
  {
    name: "admin_profiles",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["clinicId", "userId", "fullName", "phone", "email", "permissions", "createdAt", "updatedAt"],
        properties: {
          clinicId: stringField("Owning clinic"),
          userId: objectIdField("Linked user"),
          fullName: stringField("Admin full name"),
          phone: stringField("Admin phone"),
          email: stringField("Admin email"),
          permissions: {
            bsonType: "array",
            items: stringField("Admin permission flag")
          },
          ...baseMetadata
        }
      }
    },
    indexes: [{ key: { userId: 1 }, options: { unique: true, name: "admin_profiles_user_unique" } }]
  },
  {
    name: "doctor_availability_templates",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "doctorId",
          "weeklyRules",
          "defaultSlotDurationMinutes",
          "breaks",
          "effectiveFrom",
          "updatedBy",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          doctorId: objectIdField("Linked doctor profile"),
          weeklyRules: {
            bsonType: "object",
            required: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            properties: {
              monday: weekdayRule,
              tuesday: weekdayRule,
              wednesday: weekdayRule,
              thursday: weekdayRule,
              friday: weekdayRule,
              saturday: weekdayRule,
              sunday: weekdayRule
            }
          },
          defaultSlotDurationMinutes: {
            bsonType: "int",
            minimum: 5,
            maximum: 120,
            description: "Default slot duration"
          },
          breaks: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["label", "startTime", "endTime"],
              properties: {
                label: stringField("Break label"),
                startTime: stringField("Break start time"),
                endTime: stringField("Break end time")
              }
            }
          },
          effectiveFrom: dateField("Template effective date"),
          updatedBy: objectIdField("Actor who changed availability"),
          updatedAt: dateField("Last updated timestamp")
        }
      }
    },
    indexes: [{ key: { doctorId: 1 }, options: { unique: true, name: "doctor_templates_doctor_unique" } }]
  },
  {
    name: "doctor_day_schedules",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "doctorId",
          "date",
          "isClosed",
          "slotSummary",
          "generatedFromTemplate",
          "overrideReason",
          "slots",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          doctorId: objectIdField("Linked doctor profile"),
          date: stringField("Schedule date in YYYY-MM-DD"),
          isClosed: booleanField("Whether the full day is unavailable"),
          slotSummary: {
            bsonType: "object",
            required: ["total", "available", "booked", "unavailable"],
            properties: {
              total: { bsonType: "int", minimum: 0 },
              available: { bsonType: "int", minimum: 0 },
              booked: { bsonType: "int", minimum: 0 },
              unavailable: { bsonType: "int", minimum: 0 }
            }
          },
          generatedFromTemplate: booleanField("Whether the day was generated from the weekly template"),
          overrideReason: nullableStringField("Why the day differs from the template"),
          slots: {
            bsonType: "array",
            items: slotShape
          },
          ...baseMetadata
        }
      }
    },
    indexes: [
      { key: { doctorId: 1, date: 1 }, options: { unique: true, name: "doctor_day_schedules_doctor_date_unique" } },
      { key: { clinicId: 1, date: 1, doctorId: 1 }, options: { name: "doctor_day_schedules_clinic_date_doctor" } }
    ]
  },
  {
    name: "appointments",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "appointmentNumber",
          "slotId",
          "doctorId",
          "patientId",
          "doctorSnapshot",
          "patientSnapshot",
          "date",
          "startAt",
          "endAt",
          "visitType",
          "bookingStatus",
          "source",
          "encounterId",
          "notes",
          "createdByUserId",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          appointmentNumber: stringField("Human-readable appointment reference"),
          slotId: stringField("Linked slot identifier"),
          doctorId: objectIdField("Doctor profile identifier"),
          patientId: objectIdField("Patient profile identifier"),
          doctorSnapshot: {
            bsonType: "object",
            required: ["fullName", "specialty"],
            properties: {
              fullName: stringField("Doctor name snapshot"),
              specialty: stringField("Doctor specialty snapshot")
            }
          },
          patientSnapshot: {
            bsonType: "object",
            required: ["fullName", "phone"],
            properties: {
              fullName: stringField("Patient name snapshot"),
              phone: stringField("Patient phone snapshot")
            }
          },
          date: stringField("Appointment day key"),
          startAt: dateField("Start timestamp"),
          endAt: dateField("End timestamp"),
          visitType: stringEnumField(["booked", "walk_in"], "Visit type"),
          bookingStatus: stringEnumField(
            ["scheduled", "checked_in", "cancelled", "completed", "rescheduled"],
            "Appointment lifecycle state"
          ),
          source: stringEnumField(["patient_portal", "doctor_panel", "admin_panel"], "Booking origin"),
          encounterId: objectIdField("Linked encounter identifier"),
          notes: nullableStringField("Operational notes"),
          createdByUserId: objectIdField("User who created the booking"),
          ...baseMetadata
        }
      }
    },
    indexes: [
      { key: { appointmentNumber: 1 }, options: { unique: true, name: "appointments_number_unique" } },
      {
        key: { clinicId: 1, doctorId: 1, date: 1, bookingStatus: 1 },
        options: { name: "appointments_clinic_doctor_date_status" }
      },
      {
        key: { clinicId: 1, patientId: 1, createdAt: -1 },
        options: { name: "appointments_clinic_patient_createdAt" }
      },
      { key: { encounterId: 1 }, options: { name: "appointments_encounterId" } }
    ]
  },
  {
    name: "encounters",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "appointmentId",
          "doctorId",
          "patientId",
          "status",
          "interview",
          "apciDraft",
          "doctorReview",
          "finalClinicalNote",
          "diagnoses",
          "confidenceMap",
          "alerts",
          "prescriptionId",
          "approvedAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          appointmentId: objectIdField("Linked appointment"),
          doctorId: objectIdField("Doctor profile"),
          patientId: objectIdField("Patient profile"),
          status: stringEnumField(
            ["awaiting_interview", "ai_ready", "in_consult", "approved", "closed"],
            "Encounter workflow state"
          ),
          interview: {
            bsonType: "object",
            required: ["language", "completionStatus", "transcript", "extractedFindings"],
            properties: {
              language: stringEnumField(["en", "hi"], "Interview language"),
              completionStatus: stringEnumField(["pending", "complete"], "Interview completion"),
              transcript: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["role", "text"],
                  properties: {
                    role: stringEnumField(["patient", "ai"], "Transcript speaker"),
                    text: stringField("Transcript text")
                  }
                }
              },
              extractedFindings: {
                bsonType: "array",
                items: stringField("Extracted interview finding")
              }
            }
          },
          apciDraft: {
            bsonType: "object",
            required: ["soap", "vitals", "medicationSuggestions", "differentials"],
            properties: {
              soap: {
                bsonType: "object",
                required: ["chiefComplaint", "subjective", "objective", "assessment", "plan"],
                properties: {
                  chiefComplaint: stringField("Chief complaint"),
                  subjective: stringField("Subjective note"),
                  objective: stringField("Objective note"),
                  assessment: stringField("Assessment"),
                  plan: stringField("Plan")
                }
              },
              vitals: {
                bsonType: "object",
                required: ["temperature", "pulse", "bloodPressure", "spo2"],
                properties: {
                  temperature: stringField("Temperature"),
                  pulse: stringField("Pulse"),
                  bloodPressure: stringField("Blood pressure"),
                  spo2: stringField("SpO2")
                }
              },
              medicationSuggestions: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["name", "dosage", "frequency", "duration", "rationale"],
                  properties: {
                    name: stringField("Medication name"),
                    dosage: stringField("Dosage"),
                    frequency: stringField("Frequency"),
                    duration: stringField("Duration"),
                    rationale: stringField("Rationale")
                  }
                }
              },
              differentials: {
                bsonType: "array",
                items: stringField("Differential diagnosis")
              }
            }
          },
          doctorReview: {
            bsonType: "object",
            required: ["editedFields", "note", "reviewedAt", "approved"],
            properties: {
              editedFields: {
                bsonType: "array",
                items: stringField("Edited field name")
              },
              note: nullableStringField("Doctor note"),
              reviewedAt: nullableDateField("Review timestamp"),
              approved: booleanField("Whether encounter is approved")
            }
          },
          finalClinicalNote: nullableStringField("Final merged clinical note"),
          diagnoses: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["label", "code", "confidence"],
              properties: {
                label: stringField("Diagnosis label"),
                code: stringField("Diagnosis code"),
                confidence: {
                  bsonType: ["double", "int"],
                  minimum: 0,
                  maximum: 1,
                  description: "Model confidence between 0 and 1"
                }
              }
            }
          },
          confidenceMap: {
            bsonType: "object",
            properties: {
              subjective: { bsonType: ["double", "int"], minimum: 0, maximum: 1 },
              objective: { bsonType: ["double", "int"], minimum: 0, maximum: 1 },
              assessment: { bsonType: ["double", "int"], minimum: 0, maximum: 1 },
              plan: { bsonType: ["double", "int"], minimum: 0, maximum: 1 }
            }
          },
          alerts: {
            bsonType: "array",
            items: stringField("Clinical or booking alert")
          },
          prescriptionId: nullableObjectIdField("Linked prescription"),
          approvedAt: nullableDateField("Approval timestamp"),
          updatedAt: dateField("Encounter updated timestamp")
        }
      }
    },
    indexes: [
      { key: { appointmentId: 1 }, options: { unique: true, name: "encounters_appointment_unique" } },
      {
        key: { clinicId: 1, doctorId: 1, status: 1, updatedAt: -1 },
        options: { name: "encounters_clinic_doctor_status_updatedAt" }
      },
      {
        key: { clinicId: 1, patientId: 1, updatedAt: -1 },
        options: { name: "encounters_clinic_patient_updatedAt" }
      }
    ]
  },
  {
    name: "prescriptions",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "appointmentId",
          "encounterId",
          "doctorId",
          "patientId",
          "medications",
          "warnings",
          "followUpNote",
          "portalSummary",
          "pdfMeta",
          "issuedAt",
          "updatedAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          appointmentId: objectIdField("Linked appointment"),
          encounterId: objectIdField("Linked encounter"),
          doctorId: objectIdField("Doctor profile"),
          patientId: objectIdField("Patient profile"),
          medications: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["name", "dosage", "frequency", "duration", "instructions"],
              properties: {
                name: stringField("Medication name"),
                dosage: stringField("Dosage"),
                frequency: stringField("Frequency"),
                duration: stringField("Duration"),
                instructions: stringField("Instructions")
              }
            }
          },
          warnings: {
            bsonType: "array",
            items: stringField("Warning message")
          },
          followUpNote: nullableStringField("Follow-up note"),
          portalSummary: {
            bsonType: "object",
            required: ["headline", "plainLanguageInstructions"],
            properties: {
              headline: stringField("Patient-facing headline"),
              plainLanguageInstructions: stringField("Patient-facing instructions")
            }
          },
          pdfMeta: {
            bsonType: "object",
            required: ["fileName", "storagePath", "mimeType", "generatedAt"],
            properties: {
              fileName: stringField("Prescription PDF file name"),
              storagePath: stringField("Filesystem or object storage path"),
              mimeType: stringField("Content type"),
              generatedAt: dateField("PDF generation timestamp")
            }
          },
          issuedAt: dateField("Prescription issuance timestamp"),
          updatedAt: dateField("Last updated timestamp")
        }
      }
    },
    indexes: [
      { key: { appointmentId: 1 }, options: { unique: true, name: "prescriptions_appointment_unique" } },
      { key: { patientId: 1, issuedAt: -1 }, options: { name: "prescriptions_patient_issuedAt" } },
      { key: { doctorId: 1, issuedAt: -1 }, options: { name: "prescriptions_doctor_issuedAt" } }
    ]
  },
  {
    name: "auth_sessions",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["clinicId", "userId", "role", "tokenHash", "deviceInfo", "ipMeta", "createdAt", "expiresAt"],
        properties: {
          clinicId: stringField("Owning clinic"),
          userId: objectIdField("Linked user"),
          role: stringEnumField(["patient", "doctor", "admin"], "Session role"),
          tokenHash: stringField("Hashed session token"),
          deviceInfo: {
            bsonType: "object",
            properties: {
              userAgent: nullableStringField("User agent"),
              platform: nullableStringField("Client platform")
            }
          },
          ipMeta: {
            bsonType: "object",
            properties: {
              ipAddress: nullableStringField("IP address"),
              city: nullableStringField("City"),
              country: nullableStringField("Country")
            }
          },
          createdAt: dateField("Session creation timestamp"),
          expiresAt: dateField("Session expiry timestamp")
        }
      }
    },
    indexes: [
      { key: { tokenHash: 1 }, options: { unique: true, name: "auth_sessions_token_unique" } },
      {
        key: { expiresAt: 1 },
        options: { expireAfterSeconds: 0, name: "auth_sessions_expiresAt_ttl" }
      }
    ]
  },
  {
    name: "audit_logs",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "clinicId",
          "actorUserId",
          "actorRole",
          "entityType",
          "entityId",
          "action",
          "beforeSummary",
          "afterSummary",
          "meta",
          "createdAt"
        ],
        properties: {
          clinicId: stringField("Owning clinic"),
          actorUserId: objectIdField("Actor user"),
          actorRole: stringEnumField(["patient", "doctor", "admin"], "Actor role"),
          entityType: stringField("Entity type"),
          entityId: nullableObjectIdField("Entity identifier"),
          action: stringField("Action name"),
          beforeSummary: {
            bsonType: ["object", "null"],
            description: "State summary before the change"
          },
          afterSummary: {
            bsonType: ["object", "null"],
            description: "State summary after the change"
          },
          meta: {
            bsonType: ["object", "null"],
            description: "Additional action metadata"
          },
          createdAt: dateField("Audit creation timestamp")
        }
      }
    },
    indexes: [
      {
        key: { entityType: 1, entityId: 1, createdAt: -1 },
        options: { name: "audit_logs_entity_createdAt" }
      },
      {
        key: { actorUserId: 1, createdAt: -1 },
        options: { name: "audit_logs_actor_createdAt" }
      }
    ]
  }
];

export const managedCollectionNames = collectionDefinitions.map((definition) => definition.name);
