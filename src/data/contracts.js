/**
 * @typedef {Object} UserAccount
 * @property {string} id
 * @property {"patient"|"doctor"|"nurse"|"admin"} role
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
 * @property {"patient"|"doctor"|"nurse"|"admin"|null} role
 * @property {boolean} isAuthenticated
 * @property {string | null} activeProfileId
 * @property {string} identifier
 */

/**
 * @typedef {Object} PatientProfile
 * @property {string} id
 * @property {string} userId
 * @property {string} fullName
 * @property {string} profilePhoto
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
 * @property {string} profilePhoto
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
 * @property {string} profilePhoto
 * @property {string} clinicName
 * @property {string} phone
 * @property {string} email
 */

/**
 * @typedef {Object} NurseProfile
 * @property {string} id
 * @property {string} userId
 * @property {string} fullName
 * @property {string} profilePhoto
 * @property {string} clinic
 * @property {string} department
 * @property {string} shift
 * @property {string} assignedWard
 * @property {string} nursingLicenseNumber
 * @property {number | null} yearsExperience
 * @property {string} phone
 * @property {string} email
 * @property {string} emergencyContactName
 * @property {string} emergencyContactPhone
 * @property {string} notes
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
 */

/**
 * @typedef {Object} LabReportRecord
 * @property {string} id
 * @property {string} appointmentId
 * @property {string} patientId
 * @property {string} doctorId
 * @property {string} title
 * @property {string} category
 * @property {string} findings
 * @property {string} resultSummary
 * @property {"draft"|"final"} status
 * @property {string} updatedAt
 */

export {};
