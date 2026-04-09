export const defaultLabCatalog = [
  {
    id: "lab-cbc",
    name: "Complete Blood Count",
    category: "Hematology",
    sampleType: "Blood",
    turnaroundLabel: "4 hours",
    unit: "",
    referenceRange: "As per age and gender"
  },
  {
    id: "lab-fbs",
    name: "Fasting Blood Sugar",
    category: "Biochemistry",
    sampleType: "Blood",
    turnaroundLabel: "3 hours",
    unit: "mg/dL",
    referenceRange: "70 - 99"
  },
  {
    id: "lab-hba1c",
    name: "HbA1c",
    category: "Diabetes",
    sampleType: "Blood",
    turnaroundLabel: "1 day",
    unit: "%",
    referenceRange: "Below 5.7"
  },
  {
    id: "lab-lipid",
    name: "Lipid Profile",
    category: "Cardiac risk",
    sampleType: "Blood",
    turnaroundLabel: "1 day",
    unit: "mg/dL",
    referenceRange: "As per panel"
  },
  {
    id: "lab-lft",
    name: "Liver Function Test",
    category: "Biochemistry",
    sampleType: "Blood",
    turnaroundLabel: "1 day",
    unit: "U/L",
    referenceRange: "As per panel"
  },
  {
    id: "lab-thyroid",
    name: "Thyroid Panel",
    category: "Endocrinology",
    sampleType: "Blood",
    turnaroundLabel: "1 day",
    unit: "uIU/mL",
    referenceRange: "0.4 - 4.0"
  },
  {
    id: "lab-vitd",
    name: "Vitamin D",
    category: "Nutrition",
    sampleType: "Blood",
    turnaroundLabel: "1 day",
    unit: "ng/mL",
    referenceRange: "30 - 100"
  },
  {
    id: "lab-b12",
    name: "Vitamin B12",
    category: "Nutrition",
    sampleType: "Blood",
    turnaroundLabel: "1 day",
    unit: "pg/mL",
    referenceRange: "200 - 900"
  },
  {
    id: "lab-urine",
    name: "Urine Routine",
    category: "Urinalysis",
    sampleType: "Urine",
    turnaroundLabel: "4 hours",
    unit: "",
    referenceRange: "Normal"
  }
];

export const PATIENT_LAB_BUCKETS = ["total", "yet_to_visit", "sample_given", "completed"];
export const DOCTOR_LAB_FILTERS = ["all", "ordered", "sample_received", "processing", "completed", "cancelled"];
export const LAB_WORKFLOW_STEPS = ["ordered", "sample_received", "processing", "completed"];

const labStatusMeta = {
  ordered: {
    tone: "warning",
    doctorLabel: "Requested",
    patientLabel: "Yet to visit"
  },
  sample_received: {
    tone: "info",
    doctorLabel: "Sample received",
    patientLabel: "Sample given"
  },
  processing: {
    tone: "info",
    doctorLabel: "Processing",
    patientLabel: "Sample given"
  },
  completed: {
    tone: "success",
    doctorLabel: "Completed",
    patientLabel: "Completed"
  },
  cancelled: {
    tone: "danger",
    doctorLabel: "Cancelled",
    patientLabel: "Cancelled"
  }
};

export function createLabCatalogSeed() {
  return defaultLabCatalog.map((item) => ({ ...item }));
}

export function buildLabResultTemplate(selectedTestIds, labCatalogById) {
  return selectedTestIds.map((testId) => {
    const test = labCatalogById[testId];

    return {
      testId,
      name: test?.name || "Unnamed test",
      result: "",
      unit: test?.unit || "",
      referenceRange: test?.referenceRange || "",
      flag: "normal"
    };
  });
}

export function listTestsForOrder(labCatalogById, selectedTestIds = []) {
  return selectedTestIds.map((testId) => labCatalogById[testId]).filter(Boolean);
}

export function getLabOrderTone(status) {
  return labStatusMeta[status]?.tone || "neutral";
}

export function getDoctorLabStatusLabel(status) {
  return labStatusMeta[status]?.doctorLabel || "Unknown";
}

export function getPatientLabStatusLabel(status) {
  return labStatusMeta[status]?.patientLabel || "Unknown";
}

export function getPatientLabBucket(status) {
  if (status === "ordered") {
    return "yet_to_visit";
  }

  if (status === "sample_received" || status === "processing") {
    return "sample_given";
  }

  if (status === "completed") {
    return "completed";
  }

  return "cancelled";
}

export function isEditableLabOrder(order) {
  return order?.status === "ordered";
}

export function getLabProgress(status) {
  const activeSteps = status === "cancelled" ? ["ordered"] : LAB_WORKFLOW_STEPS;
  const currentIndex = activeSteps.indexOf(status);

  return activeSteps.map((step, index) => ({
    key: step,
    label:
      step === "ordered"
        ? "Requested"
        : step === "sample_received"
          ? "Sample given"
          : step === "processing"
            ? "Processing"
            : "Report ready",
    done: currentIndex >= index && status !== "cancelled",
    current: currentIndex === index || (status === "cancelled" && step === "ordered")
  }));
}
