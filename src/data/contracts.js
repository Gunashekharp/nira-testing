/**
 * @typedef {Object} UserAccount
 * @property {string} id
 * @property {"patient"|"doctor"|"admin"|"lab"} role
 * @property {"active"|"pending_approval"|"inactive"|"archived"} status
 * @property {string} phone
 * @property {string} email
 * @property {string} password
 * @property {string} profileId
 * @property {string} createdAt
 * @property {string | null} lastLoginAt
 */

/**
 * @typedef {Object} AuthSession
 * @property {string | null} userId
 * @property {"patient"|"doctor"|"admin"|"lab"|null} role
 * @property {boolean} isAuthenticated
 * @property {string | null} activeProfileId
 * @property {string} identifier
 */

/**
 * @typedef {Object} PatientProfile
 * @property {string} id
 * @property {string} userId
 * @property {string} fullName
 * @property {string} preferredLanguage
 * @property {number | null} age
 * @property {string} gender
 * @property {string} city
 * @property {string} phone
 * @property {string} email
 * @property {string} abhaNumber
 * @property {string} emergencyContactName
 * @property {string} emergencyContactPhone
 * @property {string} notes
 */

/**
 * @typedef {Object} DoctorProfile
 * @property {string} id
 * @property {string} userId
 * @property {string} fullName
 * @property {string} specialty
 * @property {string} clinic
 * @property {string} licenseNumber
 * @property {"active"|"pending_approval"|"inactive"|"archived"} status
 * @property {boolean} acceptingAppointments
 * @property {number} slotDurationMinutes
 * @property {string} phone
 * @property {string} email
 */

/**
 * @typedef {Object} AdminProfile
 * @property {string} id
 * @property {string} userId
 * @property {string} fullName
 * @property {string} clinicName
 * @property {string} phone
 * @property {string} email
 */

/**
 * @typedef {Object} LabTechnicianProfile
 * @property {string} id
 * @property {string} userId
 * @property {string} fullName
 * @property {string} phone
 * @property {string} email
 * @property {"active"|"inactive"|"archived"} status
 */

/**
 * @typedef {Object} DoctorAvailabilityTemplate
 * @property {string} id
 * @property {string} doctorId
 * @property {number} defaultSlotDurationMinutes
 * @property {Object<string, {enabled: boolean, startTime: string, endTime: string, breaks: Array<{startTime: string, endTime: string}>}>} weeklyRules
 */

/**
 * @typedef {Object} DoctorAvailabilityOverride
 * @property {string} id
 * @property {string} doctorId
 * @property {string} date
 * @property {"open"|"closed"|"custom"} mode
 * @property {string} closedReason
 * @property {Object | null} customRule
 * @property {Object<string, "available"|"unavailable">} slotStatuses
 */

/**
 * @typedef {Object} AvailabilitySlot
 * @property {string} id
 * @property {string} doctorId
 * @property {string} date
 * @property {string} startAt
 * @property {string} endAt
 * @property {"available"|"booked"|"unavailable"} status
 * @property {string | null} appointmentId
 */

/**
 * @typedef {Object} AppointmentRecord
 * @property {string} id
 * @property {string} slotId
 * @property {string} doctorId
 * @property {string} patientId
 * @property {string} bookedByUserId
 * @property {"booked"|"walk_in"} visitType
 * @property {"scheduled"|"checked_in"|"cancelled"|"completed"|"rescheduled"} bookingStatus
 * @property {Array<{fromSlotId: string, toSlotId: string, changedAt: string}>} rescheduleHistory
 */

/**
 * @typedef {Object} EncounterRecord
 * @property {string} id
 * @property {string} appointmentId
 * @property {string} doctorId
 * @property {string} patientId
 * @property {"awaiting_interview"|"ai_ready"|"in_consult"|"approved"|"closed"} status
 * @property {string} interviewId
 * @property {string | null} prescriptionId
 * @property {Array<{testId: string, reason: string}>} labSuggestions
 * @property {string[]} labOrderIds
 */

/**
 * @typedef {Object} LabCatalogItem
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} sampleType
 * @property {string} turnaroundLabel
 */

/**
 * @typedef {Object} LabOrderRecord
 * @property {string} id
 * @property {string} appointmentId
 * @property {string} patientId
 * @property {string} doctorId
 * @property {string} createdByUserId
 * @property {string | null} assignedLabUserId
 * @property {"ordered"|"sample_received"|"processing"|"completed"|"cancelled"} status
 * @property {string[]} selectedTestIds
 * @property {string} clinicianNote
 * @property {string} orderedAt
 * @property {string | null} sampleReceivedAt
 * @property {string | null} processingStartedAt
 * @property {string | null} completedAt
 * @property {string | null} cancelledAt
 * @property {string | null} cancelledByUserId
 * @property {string | null} lastEditedAt
 * @property {string | null} reportId
 */

/**
 * @typedef {Object} LabReportRecord
 * @property {string} id
 * @property {string} labOrderId
 * @property {string} patientId
 * @property {string} doctorId
 * @property {Array<{testId: string, name: string, result: string, unit: string, referenceRange: string, flag: string}>} resultItems
 * @property {string} summary
 * @property {string} completedByUserId
 * @property {string} completedAt
 * @property {{fileName: string}} downloadMeta
 */

export {};
