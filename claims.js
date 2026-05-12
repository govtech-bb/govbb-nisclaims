// Dummy data for the claims tracking prototype.
//
// Stage shape:
//   { name, status, on?, estimateDays, durationDays? }
//   status:        "complete" | "current" | "pending"
//   on:            date the stage was entered (omitted for pending)
//   estimateDays:  how long this stage normally takes
//   durationDays:  actual days the stage took (complete stages only)
//
// Issue shape:
//   { type: "missing" | "incorrect", title, detail }

const CLAIMS = {
  // On track — under review, no outstanding issues.
  "CL-2025-00123": {
    applicant: "Maria Belgrave",
    type: "Sickness benefit",
    submitted: "06 May 2026",
    stages: [
      { name: "Submitted",     status: "complete", on: "06 May 2026", estimateDays: 3, durationDays: 1 },
      { name: "Under review",  status: "current",  on: "07 May 2026", estimateDays: 7 },
      { name: "Approval",      status: "pending",                     estimateDays: 5 },
      { name: "Payment",       status: "pending",                     estimateDays: 10 },
    ],
    outstanding: [],
  },

  // Delayed — information requested, claim is sitting waiting on the applicant.
  "CL-2025-00456": {
    applicant: "John Worrell",
    type: "Employment injury",
    submitted: "15 April 2026",
    stages: [
      { name: "Submitted",             status: "complete", on: "15 April 2026", estimateDays: 3,  durationDays: 3 },
      { name: "Information requested", status: "current",  on: "18 April 2026", estimateDays: 7,
        delayReason: "We are waiting for you to submit the information requested in the outstanding issues below." },
      { name: "Under review",          status: "pending",                       estimateDays: 10 },
      { name: "Approval",              status: "pending",                       estimateDays: 5 },
      { name: "Payment",               status: "pending",                       estimateDays: 10 },
    ],
    outstanding: [
      {
        type: "missing",
        title: "Medical report from your doctor",
        detail:
          "Upload a signed medical report describing the injury, treatment, and expected recovery time. PDF, JPG or PNG, under 5 MB.",
      },
      {
        type: "incorrect",
        title: "Bank account details",
        detail:
          "The account information you provided does not match the financial institution you selected. Please re-enter your account details from the NIS Direct Deposit Form.",
        fields: [
          { name: "account_holder",        label: "Name(s) of account holder", required: true },
          { name: "financial_institution", label: "Financial institution",     required: true },
          { name: "account_number",        label: "Account number",            required: true },
          { name: "branch_name",           label: "Name of branch",            required: true },
          { name: "branch_transit_no",     label: "Branch / transit number",   required: true },
        ],
      },
    ],
  },

  // Paid — every stage finished on time.
  "CL-2025-00789": {
    applicant: "Andrew Thompson",
    type: "Unemployment benefit",
    submitted: "10 January 2026",
    stages: [
      { name: "Submitted",    status: "complete", on: "10 January 2026", estimateDays: 3,  durationDays: 3 },
      { name: "Under review", status: "complete", on: "13 January 2026", estimateDays: 7,  durationDays: 7 },
      { name: "Approval",     status: "complete", on: "20 January 2026", estimateDays: 5,  durationDays: 5 },
      { name: "Payment",      status: "complete", on: "25 January 2026", estimateDays: 10, durationDays: 10 },
    ],
    outstanding: [],
  },
};

// ---- lookup ----

function normaliseTracking(raw) {
  return (raw || "").trim().toUpperCase();
}

function lookupClaim(raw) {
  const key = normaliseTracking(raw);
  return { key, claim: CLAIMS[key] || null };
}

function currentStage(claim) {
  return (
    claim.stages.find((s) => s.status === "current") ||
    claim.stages[claim.stages.length - 1]
  );
}

function isPaid(claim) {
  return claim.stages.every((s) => s.status === "complete");
}

// ---- dates / timing ----

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(s) {
  return new Date(s);
}

function today() {
  return new Date();
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d) {
  return (
    String(d.getDate()).padStart(2, "0") +
    " " + MONTHS[d.getMonth()] +
    " " + d.getFullYear()
  );
}

function dayLabel(n) {
  return n === 1 ? "1 day" : n + " days";
}

function stageElapsedDays(stage, ref) {
  if (stage.status === "complete") return stage.durationDays || 0;
  if (stage.status === "current") {
    return Math.max(0, daysBetween(parseDate(stage.on), ref || today()));
  }
  return 0;
}

function stageDaysOver(stage, ref) {
  return Math.max(0, stageElapsedDays(stage, ref) - stage.estimateDays);
}

function totalEstimateDays(claim) {
  return claim.stages.reduce((sum, s) => sum + s.estimateDays, 0);
}

function totalDelayDays(claim, ref) {
  return claim.stages.reduce((sum, s) => sum + stageDaysOver(s, ref), 0);
}

function actualTotalDays(claim) {
  return claim.stages.reduce((sum, s) => sum + (s.durationDays || 0), 0);
}

function originalTargetDate(claim) {
  return addDays(parseDate(claim.submitted), totalEstimateDays(claim));
}

function revisedTargetDate(claim, ref) {
  return addDays(originalTargetDate(claim), totalDelayDays(claim, ref));
}

function completionDate(claim) {
  return addDays(parseDate(claim.stages[0].on), actualTotalDays(claim));
}

// Days of work expected AFTER the current stage ends — i.e., once the
// claimant has submitted everything they owe and the claim moves forward.
function waitTimeAfterCurrentStage(claim) {
  const i = claim.stages.findIndex((s) => s.status === "current");
  if (i === -1) return 0;
  return claim.stages
    .slice(i + 1)
    .reduce((sum, s) => sum + s.estimateDays, 0);
}

function delayedStagesWithReason(claim, ref) {
  return claim.stages.filter(function (s) {
    return stageDaysOver(s, ref) > 0 && s.delayReason;
  });
}
