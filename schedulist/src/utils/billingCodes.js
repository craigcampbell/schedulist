/**
 * ABA Therapy Billing Code Reference
 *
 * CPT codes effective 2019+ for ABA therapy (replaced legacy H-codes for most payers).
 * Units are 15-minute increments unless noted.
 */

// ── CPT Code definitions ──────────────────────────────────────────────────────
const CPT_CODES = {
  '97151': {
    code: '97151',
    description: 'Behavior Identification Assessment – administered by BCBA/QHP, per 15 min',
    defaultRate: 30.00,
    requiresPatient: true,
    providerType: 'bcba',
    billable: true,
  },
  '97152': {
    code: '97152',
    description: 'Behavior Identification Supporting Assessment – tech-administered under supervision, per 15 min',
    defaultRate: 15.00,
    requiresPatient: true,
    providerType: 'tech',
    billable: true,
  },
  '97153': {
    code: '97153',
    description: 'Adaptive Behavior Treatment by Protocol – tech, 1:1, per 15 min',
    defaultRate: 14.00,
    requiresPatient: true,
    providerType: 'tech',
    billable: true,
  },
  '97154': {
    code: '97154',
    description: 'Group Adaptive Behavior Treatment by Protocol – tech, per 15 min',
    defaultRate: 10.00,
    requiresPatient: true,
    providerType: 'tech',
    billable: true,
  },
  '97155': {
    code: '97155',
    description: 'Adaptive Behavior Treatment with Protocol Modification – BCBA, per 15 min',
    defaultRate: 25.00,
    requiresPatient: true,
    providerType: 'bcba',
    billable: true,
  },
  '97156': {
    code: '97156',
    description: 'Family Adaptive Behavior Treatment Guidance – BCBA, per 15 min',
    defaultRate: 22.00,
    requiresPatient: false,
    providerType: 'bcba',
    billable: true,
  },
  '97158': {
    code: '97158',
    description: 'Group Adaptive Behavior Treatment with Protocol Modification – BCBA, per 15 min',
    defaultRate: 18.00,
    requiresPatient: true,
    providerType: 'bcba',
    billable: true,
  },
};

// ── Service type → CPT code mapping ──────────────────────────────────────────
// isBcbaRendered: true = BCBA is the rendering provider, false = tech is rendering
const SERVICE_TO_CPT = {
  direct:     { tech: '97153', bcba: '97155' }, // 1:1 direct therapy
  circle:     { tech: '97154', bcba: '97158' }, // group therapy
  supervision:{ tech: null,    bcba: '97155' }, // BCBA protocol modification
  indirect:   { tech: null,    bcba: '97156' }, // BCBA family/admin guidance
  assessment: { tech: '97152', bcba: '97151' }, // initial/ongoing assessment
  lunch:      { tech: null,    bcba: null    }, // not billable
  cleaning:   { tech: null,    bcba: null    }, // not billable
  noOw:       { tech: null,    bcba: null    }, // not billable
};

// ── Place of Service codes ────────────────────────────────────────────────────
const PLACE_OF_SERVICE = {
  clinic: { code: '11', label: 'Office' },
  home:   { code: '12', label: 'Home' },
  school: { code: '03', label: 'School' },
};

// ── Provider level → billing modifier ────────────────────────────────────────
const PROVIDER_LEVEL_MODIFIER = {
  paraprofessional: 'HM',  // Less than bachelor's degree
  bachelor:         'HN',  // Bachelor's degree
  master:           'HO',  // Master's degree or above (BCBAs)
  doctorate:        'HO',  // Doctoral level
};

// ── Common ABA ICD-10 diagnosis codes ────────────────────────────────────────
const ICD10_CODES = [
  { code: 'F84.0', description: 'Autism Spectrum Disorder' },
  { code: 'F84.9', description: 'Pervasive Developmental Disorder, Unspecified' },
  { code: 'F84.5', description: "Asperger's Syndrome" },
  { code: 'F90.0', description: 'ADHD, Predominantly Inattentive Presentation' },
  { code: 'F90.1', description: 'ADHD, Predominantly Hyperactive-Impulsive' },
  { code: 'F90.2', description: 'ADHD, Combined Presentation' },
  { code: 'F80.4', description: 'Speech and Language Developmental Delay' },
  { code: 'F41.0', description: 'Panic Disorder' },
  { code: 'F42.2', description: 'OCD' },
  { code: 'F31.9', description: 'Bipolar Disorder, Unspecified' },
  { code: 'F70',   description: 'Mild Intellectual Disability' },
  { code: 'F71',   description: 'Moderate Intellectual Disability' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate billing units (15-min increments) from start/end ISO strings.
 * Rounds to nearest unit using 8-minute rule (≥8 min rounds up).
 */
function calcUnits(startTime, endTime) {
  const minutes = (new Date(endTime) - new Date(startTime)) / 60000;
  const units = Math.floor(minutes / 15);
  const remainder = minutes % 15;
  return units + (remainder >= 8 ? 1 : 0);
}

/**
 * Determine the CPT code for an appointment.
 * isBcba: whether the rendering provider is a BCBA.
 */
function getCptCode(serviceType, isBcba) {
  const map = SERVICE_TO_CPT[serviceType];
  if (!map) return null;
  return isBcba ? map.bcba : map.tech;
}

/**
 * Get the CMS Place of Service code from a location's locationType.
 */
function getPlaceOfService(locationType) {
  return PLACE_OF_SERVICE[locationType] || PLACE_OF_SERVICE.clinic;
}

/**
 * Build standard modifiers for a session.
 * providerLevel: 'paraprofessional' | 'bachelor' | 'master' | 'doctorate' | null
 * telehealth: boolean
 */
function buildModifiers(providerLevel, telehealth = false) {
  const mods = [];
  if (providerLevel && PROVIDER_LEVEL_MODIFIER[providerLevel]) {
    mods.push(PROVIDER_LEVEL_MODIFIER[providerLevel]);
  }
  if (telehealth) mods.push('GT');
  return mods;
}

/**
 * Whether a service type is billable to insurance.
 */
function isBillable(serviceType) {
  const map = SERVICE_TO_CPT[serviceType];
  if (!map) return false;
  return map.tech !== null || map.bcba !== null;
}

/**
 * Compute estimated dollar amount from units and CPT code.
 */
function estimateAmount(cptCode, units, customRate = null) {
  const def = CPT_CODES[cptCode];
  if (!def) return null;
  const rate = customRate ?? def.defaultRate;
  return parseFloat((rate * units).toFixed(2));
}

module.exports = {
  CPT_CODES,
  SERVICE_TO_CPT,
  PLACE_OF_SERVICE,
  ICD10_CODES,
  PROVIDER_LEVEL_MODIFIER,
  calcUnits,
  getCptCode,
  getPlaceOfService,
  buildModifiers,
  isBillable,
  estimateAmount,
};
