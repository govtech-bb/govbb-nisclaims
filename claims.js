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
    payout: {
      quarterlyEarnings: 9000,
      contributionsInQuarter: 12,
      creditsInQuarter: 1,
      contributions4Quarters: 50,
      insuredWeeksTotal: 230,
      durationWeeks: 4,
      note: "Assumes a 4-week certified incapacity. Final amount depends on actual days certified.",
    },
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
          "The account information you provided does not match the financial institution you selected.",
        fields: [
          { name: "account_holder",        label: "Name(s) of account holder", required: true },
          { name: "financial_institution", label: "Financial institution",     required: true },
          { name: "account_number",        label: "Account number",            required: true },
          { name: "branch_name",           label: "Name of branch",            required: true },
          { name: "branch_transit_no",     label: "Branch / transit number",   required: true },
        ],
      },
    ],
    payout: {
      quarterlyEarnings: 12000,
      contributionsInQuarter: 13,
      creditsInQuarter: 0,
      insuredWeeksTotal: 156,
      durationWeeks: 8,
      note: "Assumes 8 weeks of incapacity. Final amount depends on the medical report and certified recovery period.",
    },
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
    payout: {
      quarterlyEarnings: 13500,
      contributionsInQuarter: 13,
      creditsInQuarter: 0,
      contributions3Quarters: 38,
      insuredWeeksTotal: 480,
      durationWeeks: 13,
      note: "Paid over 13 weeks (the full claimed unemployment period).",
    },
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

// ---- payout ----

// 2025 weekly earnings ceiling for NIS contributions (BBD).
// Source: https://www.nis.gov.bb/contribution-rates/
const NIS_WEEKLY_CEILING = 1219;

// Per-benefit calculation rules, sourced from nis.gov.bb.
const BENEFIT_RATES = {
  "Sickness benefit": {
    rate: 2 / 3,
    rateLabel: "66⅔%",
    page: { url: "https://www.nis.gov.bb/sickness-benefits/", title: "NIS Sickness Benefit" },
  },
  "Employment injury": {
    rate: 0.9,
    rateLabel: "90%",
    page: { url: "https://www.nis.gov.bb/employee-injury/", title: "NIS Employment Injury Benefit" },
  },
  "Unemployment benefit": {
    rate: 0.6,
    rateLabel: "60%",
    page: { url: "https://www.nis.gov.bb/unemployment-benefits/", title: "NIS Unemployment Benefit" },
  },
};

function formatCurrency(amount) {
  return "BBD $" + amount.toLocaleString("en-BB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function payoutMeta(claim) {
  return BENEFIT_RATES[claim.type];
}

// Average weekly insurable earnings = quarterly earnings ÷ 13,
// capped at the NIS weekly earnings ceiling.
function avgWeeklyEarnings(payout) {
  return Math.min(payout.quarterlyEarnings / 13, NIS_WEEKLY_CEILING);
}

function payoutWeekly(claim) {
  return avgWeeklyEarnings(claim.payout) * payoutMeta(claim).rate;
}

function payoutTotal(claim) {
  return payoutWeekly(claim) * claim.payout.durationWeeks;
}

// Eligibility rows for the calculation explainer dialog.
// Each row: { label, actual, minimum }. minimum=null means informational only.
function eligibilityRows(claim) {
  const p = claim.payout;
  if (claim.type === "Sickness benefit") {
    return [
      { label: "Contributions paid in the relevant quarter", actual: p.contributionsInQuarter, minimum: 7 },
      { label: "Contributions or credits in the last 4 quarters", actual: p.contributions4Quarters, minimum: 39 },
    ];
  }
  if (claim.type === "Employment injury") {
    return [
      { label: "Injury occurred during insurable employment", actual: "Yes", minimum: null },
    ];
  }
  if (claim.type === "Unemployment benefit") {
    return [
      { label: "Total weeks insured", actual: p.insuredWeeksTotal, minimum: 52 },
      { label: "Contributions in the relevant quarter", actual: p.contributionsInQuarter, minimum: 7 },
      { label: "Contributions in the last 3 consecutive quarters", actual: p.contributions3Quarters, minimum: 20 },
    ];
  }
  return [];
}
