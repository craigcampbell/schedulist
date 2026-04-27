const { Op } = require('sequelize');
const XLSX = require('xlsx');
const { Appointment, Patient, User, Location, Role } = require('../models');
const {
  CPT_CODES,
  ICD10_CODES,
  calcUnits,
  getCptCode,
  getPlaceOfService,
  buildModifiers,
  isBillable,
  estimateAmount,
} = require('../utils/billingCodes');

// ── Role check helper ─────────────────────────────────────────────────────────
const BCBA_ROLE_NAMES = ['bcba', 'BCBA', 'Board Certified Behavior Analyst'];

function isProviderBcba(user) {
  if (!user) return false;
  const roles = user.Roles || user.roles || [];
  return roles.some(r => {
    const name = typeof r === 'string' ? r : r.name;
    return BCBA_ROLE_NAMES.includes(name);
  });
}

// ── Build a billing record from an Appointment row ───────────────────────────
function buildBillingRecord(appt) {
  const therapist = appt.Therapist;
  const bcba      = appt.BCBA;
  const patient   = appt.Patient;
  const location  = appt.Location;

  // Who is the rendering provider?
  const renderingProvider = therapist || bcba;
  const renderingIsBcba   = !therapist && !!bcba; // direct by BCBA if no therapist

  // CPT code: use stored override, or auto-compute
  const cptCode = appt.cptCode
    || getCptCode(appt.serviceType, renderingIsBcba);

  // Units: stored override or auto-compute from duration
  const units = appt.billedUnits ?? calcUnits(appt.startTime, appt.endTime);

  // Place of service: stored or from location
  const pos = appt.placeOfServiceCode
    || (location ? getPlaceOfService(location.locationType).code : '11');

  // Diagnosis: appointment override → patient primary → default
  const dx = appt.diagnosisCode
    || patient?.primaryDiagnosisCode
    || 'F84.0';

  // Modifiers: stored or auto-built from rendering provider level
  const modifiers = appt.modifiers
    || buildModifiers(renderingProvider?.providerLevel);

  // Auth number: appointment-level or patient-level
  const authNumber = appt.authorizationNumber || patient?.authorizationNumber;

  // Estimated amount
  const amount = appt.billedAmount
    ?? (cptCode ? estimateAmount(cptCode, units) : null);

  return {
    id:                appt.id,
    dateOfService:     appt.startTime,
    startTime:         appt.startTime,
    endTime:           appt.endTime,
    serviceType:       appt.serviceType,
    status:            appt.status,
    billingStatus:     appt.billingStatus || 'unbilled',

    // CPT / coding
    cptCode,
    cptDescription:    cptCode ? (CPT_CODES[cptCode]?.description || '') : 'Not Billable',
    modifiers,
    diagnosisCode:     dx,
    placeOfServiceCode: pos,
    units,
    billedAmount:      appt.billedAmount ?? amount,
    paidAmount:        appt.paidAmount ?? null,
    estimatedAmount:   amount,

    // Auth / claim
    claimNumber:       appt.claimNumber || null,
    authorizationNumber: authNumber || null,
    billingNotes:      appt.billingNotes || null,

    // Patient info
    patient: patient ? {
      id:                 patient.id,
      firstName:          patient.firstName,
      lastName:           patient.lastName,
      lastInitial:        patient.lastName ? patient.lastName.charAt(0) : '',
      dateOfBirth:        patient.dateOfBirth,
      insuranceProvider:  patient.insuranceProvider,
      insuranceId:        patient.insuranceId,
      memberId:           patient.memberId,
      groupNumber:        patient.groupNumber,
      primaryDiagnosisCode: patient.primaryDiagnosisCode || 'F84.0',
      authorizationNumber:  patient.authorizationNumber,
      authorizationStartDate: patient.authorizationStartDate,
      authorizationEndDate:   patient.authorizationEndDate,
      authorizedUnits:    patient.authorizedUnits,
    } : null,

    // Rendering provider
    renderingProvider: renderingProvider ? {
      id:            renderingProvider.id,
      firstName:     renderingProvider.firstName,
      lastName:      renderingProvider.lastName,
      npi:           renderingProvider.npi,
      credentials:   renderingProvider.credentials,
      providerLevel: renderingProvider.providerLevel,
    } : null,
    renderingIsBcba,

    // Supervising BCBA
    supervisingBcba: bcba && !renderingIsBcba ? {
      id:          bcba.id,
      firstName:   bcba.firstName,
      lastName:    bcba.lastName,
      npi:         bcba.npi,
      credentials: bcba.credentials,
    } : null,

    // Location
    location: location ? {
      id:                 location.id,
      name:               location.name,
      address:            location.address,
      city:               location.city,
      state:              location.state,
      zipCode:            location.zipCode,
      locationType:       location.locationType,
      placeOfServiceCode: location.placeOfServiceCode
        || getPlaceOfService(location.locationType).code,
    } : null,
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/billing/report
 * Query params: startDate, endDate, billingStatus, serviceType, insuranceProvider, bcbaId
 */
const getBillingReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      billingStatus,
      serviceType,
      insuranceProvider,
      bcbaId,
      therapistId,
      onlyBillable = 'true',
    } = req.query;

    const orgId = req.user.organizationId;

    const where = {};

    // Date range
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime[Op.lte] = end;
      }
    }

    // Billing status filter
    if (billingStatus && billingStatus !== 'all') {
      where.billingStatus = billingStatus;
    }

    // Service type filter
    if (serviceType && serviceType !== 'all') {
      where.serviceType = serviceType;
    }

    // Only billable service types by default
    if (onlyBillable === 'true') {
      where.serviceType = {
        [Op.in]: ['direct', 'circle', 'supervision', 'indirect'],
      };
      // Allow override if serviceType is specifically set
      if (serviceType && serviceType !== 'all') {
        where.serviceType = serviceType;
      }
    }

    // Filter by BCBA
    if (bcbaId) where.bcbaId = bcbaId;

    // Filter by therapist
    if (therapistId) where.therapistId = therapistId;

    // Only completed or scheduled (not cancelled/no-show)
    where.status = { [Op.in]: ['completed', 'scheduled'] };

    const appointments = await Appointment.findAll({
      where,
      include: [
        {
          model: Patient,
          required: false,
          where: orgId ? { organizationId: orgId } : undefined,
        },
        {
          model: User,
          as: 'Therapist',
          required: false,
          attributes: ['id', 'firstName', 'lastName', 'npi', 'credentials', 'providerLevel'],
        },
        {
          model: User,
          as: 'BCBA',
          required: false,
          attributes: ['id', 'firstName', 'lastName', 'npi', 'credentials', 'providerLevel'],
        },
        {
          model: Location,
          required: false,
          attributes: ['id', 'name', 'address', 'city', 'state', 'zipCode', 'locationType', 'placeOfServiceCode'],
        },
      ],
      order: [['startTime', 'ASC']],
    });

    let records = appointments.map(buildBillingRecord);

    // Filter by insurance provider (post-query since it's encrypted)
    if (insuranceProvider && insuranceProvider !== 'all') {
      records = records.filter(r =>
        r.patient?.insuranceProvider?.toLowerCase().includes(insuranceProvider.toLowerCase())
      );
    }

    // ── Summary stats ──
    const totalSessions   = records.length;
    const totalUnits      = records.reduce((s, r) => s + (r.units || 0), 0);
    const totalEstimated  = records.reduce((s, r) => s + (r.estimatedAmount || 0), 0);
    const totalBilled     = records.reduce((s, r) => s + (r.billedAmount || 0), 0);
    const totalPaid       = records.reduce((s, r) => s + (r.paidAmount || 0), 0);

    // CPT breakdown
    const cptBreakdown = {};
    for (const r of records) {
      const key = r.cptCode || 'N/A';
      if (!cptBreakdown[key]) {
        cptBreakdown[key] = {
          cptCode:      key,
          description:  CPT_CODES[key]?.description || 'Not Billable',
          sessions:     0,
          units:        0,
          estimated:    0,
        };
      }
      cptBreakdown[key].sessions++;
      cptBreakdown[key].units      += r.units || 0;
      cptBreakdown[key].estimated  += r.estimatedAmount || 0;
    }

    // Billing status breakdown
    const statusBreakdown = {};
    for (const r of records) {
      statusBreakdown[r.billingStatus] = (statusBreakdown[r.billingStatus] || 0) + 1;
    }

    return res.status(200).json({
      summary: {
        totalSessions,
        totalUnits,
        totalEstimated:  parseFloat(totalEstimated.toFixed(2)),
        totalBilled:     parseFloat(totalBilled.toFixed(2)),
        totalPaid:       parseFloat(totalPaid.toFixed(2)),
        cptBreakdown:    Object.values(cptBreakdown).sort((a, b) => b.sessions - a.sessions),
        statusBreakdown,
      },
      sessions: records,
      cptCodes: Object.values(CPT_CODES),
      icd10Codes: ICD10_CODES,
    });

  } catch (err) {
    console.error('[billing.getBillingReport]', err);
    return res.status(500).json({ message: 'Error generating billing report', error: err.message });
  }
};

/**
 * PUT /api/admin/billing/sessions/:id
 * Update billing fields on a single appointment
 */
const updateSessionBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      billingStatus,
      cptCode,
      diagnosisCode,
      modifiers,
      placeOfServiceCode,
      billedUnits,
      billedAmount,
      paidAmount,
      claimNumber,
      authorizationNumber,
      billingNotes,
    } = req.body;

    const appt = await Appointment.findByPk(id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    if (billingStatus     !== undefined) appt.billingStatus     = billingStatus;
    if (cptCode           !== undefined) appt.cptCode           = cptCode;
    if (diagnosisCode     !== undefined) appt.diagnosisCode     = diagnosisCode;
    if (modifiers         !== undefined) appt.modifiers         = modifiers;
    if (placeOfServiceCode!== undefined) appt.placeOfServiceCode= placeOfServiceCode;
    if (billedUnits       !== undefined) appt.billedUnits       = billedUnits;
    if (billedAmount      !== undefined) appt.billedAmount      = billedAmount;
    if (paidAmount        !== undefined) appt.paidAmount        = paidAmount;
    if (claimNumber       !== undefined) appt.claimNumber       = claimNumber;
    if (authorizationNumber !== undefined) appt.authorizationNumber = authorizationNumber;
    if (billingNotes      !== undefined) appt.billingNotes      = billingNotes;

    await appt.save();

    return res.status(200).json({ message: 'Billing updated', id: appt.id, billingStatus: appt.billingStatus });
  } catch (err) {
    console.error('[billing.updateSessionBilling]', err);
    return res.status(500).json({ message: 'Error updating billing', error: err.message });
  }
};

/**
 * POST /api/admin/billing/sessions/batch-status
 * Update billing status on multiple appointments at once
 */
const batchUpdateStatus = async (req, res) => {
  try {
    const { ids, billingStatus } = req.body;
    if (!Array.isArray(ids) || !billingStatus) {
      return res.status(400).json({ message: 'ids (array) and billingStatus required' });
    }
    await Appointment.update({ billingStatus }, { where: { id: { [Op.in]: ids } } });
    return res.status(200).json({ message: `Updated ${ids.length} sessions to "${billingStatus}"` });
  } catch (err) {
    console.error('[billing.batchUpdateStatus]', err);
    return res.status(500).json({ message: 'Error batch-updating billing', error: err.message });
  }
};

// ── Export helpers ────────────────────────────────────────────────────────────

function recordsToRows(records) {
  return records.map(r => ({
    'Date of Service':    r.dateOfService ? new Date(r.dateOfService).toLocaleDateString('en-US') : '',
    'Patient Name':       r.patient ? `${r.patient.firstName} ${r.patient.lastInitial}.` : '',
    'Date of Birth':      r.patient?.dateOfBirth ? new Date(r.patient.dateOfBirth).toLocaleDateString('en-US') : '',
    'Insurance Provider': r.patient?.insuranceProvider || '',
    'Member ID':          r.patient?.memberId || '',
    'Group Number':       r.patient?.groupNumber || '',
    'Auth Number':        r.authorizationNumber || '',
    'Claim Number':       r.claimNumber || '',
    'CPT Code':           r.cptCode || '',
    'CPT Description':    r.cptDescription || '',
    'Modifier(s)':        Array.isArray(r.modifiers) ? r.modifiers.join(' ') : '',
    'ICD-10 Dx':          r.diagnosisCode || '',
    'Place of Service':   r.placeOfServiceCode || '',
    'Units (15 min)':     r.units || 0,
    'Billed Amount':      r.billedAmount != null ? r.billedAmount.toFixed(2) : '',
    'Paid Amount':        r.paidAmount   != null ? r.paidAmount.toFixed(2)   : '',
    'Rendering Provider': r.renderingProvider ? `${r.renderingProvider.firstName} ${r.renderingProvider.lastName}` : '',
    'Rendering NPI':      r.renderingProvider?.npi || '',
    'Credentials':        r.renderingProvider?.credentials || '',
    'Supervising BCBA':   r.supervisingBcba ? `${r.supervisingBcba.firstName} ${r.supervisingBcba.lastName}` : '',
    'Supervising NPI':    r.supervisingBcba?.npi || '',
    'Service Type':       r.serviceType || '',
    'Billing Status':     r.billingStatus || '',
    'Start Time':         r.startTime ? new Date(r.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
    'End Time':           r.endTime   ? new Date(r.endTime).toLocaleTimeString('en-US',   { hour: '2-digit', minute: '2-digit' }) : '',
    'Location':           r.location?.name || '',
    'Location Address':   r.location ? `${r.location.address}, ${r.location.city}, ${r.location.state} ${r.location.zipCode}` : '',
    'Notes':              r.billingNotes || '',
  }));
}

/**
 * GET /api/admin/billing/export?format=csv|xlsx&...same filters as report
 */
const exportBillingReport = async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;

    // Re-use the same query logic — fetch all relevant records
    const tempReq = { ...req, query: { ...req.query, onlyBillable: 'true' } };
    const reportData = await _fetchReportData(tempReq);
    const rows = recordsToRows(reportData.sessions);

    const dateRange = startDate && endDate
      ? `${startDate}_to_${endDate}`
      : new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const wb  = XLSX.utils.book_new();

      // Sessions sheet
      const ws1 = XLSX.utils.json_to_sheet(rows);
      // Set column widths
      ws1['!cols'] = [
        { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 50 },
        { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 22 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
        { wch: 22 }, { wch: 40 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Sessions');

      // CPT Summary sheet
      const cptRows = reportData.summary.cptBreakdown.map(c => ({
        'CPT Code':    c.cptCode,
        'Description': c.description,
        'Sessions':    c.sessions,
        'Total Units': c.units,
        'Est. Revenue': `$${c.estimated.toFixed(2)}`,
      }));
      const ws2 = XLSX.utils.json_to_sheet(cptRows);
      ws2['!cols'] = [{ wch: 10 }, { wch: 60 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'CPT Summary');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="billing_${dateRange}.xlsx"`);
      return res.send(buf);
    }

    // Default: CSV
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="billing_${dateRange}.csv"`);
      return res.send('No data for the selected period.\n');
    }

    const headers = Object.keys(rows[0]);
    const escape  = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const csvLines = [
      headers.map(escape).join(','),
      ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="billing_${dateRange}.csv"`);
    return res.send(csvLines.join('\r\n'));

  } catch (err) {
    console.error('[billing.exportBillingReport]', err);
    return res.status(500).json({ message: 'Error exporting billing report', error: err.message });
  }
};

// ── Internal fetch (shared between report + export) ───────────────────────────
async function _fetchReportData(req) {
  const { startDate, endDate, billingStatus, serviceType, bcbaId, therapistId } = req.query;
  const orgId = req.user.organizationId;

  const where = {};
  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime[Op.gte] = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.startTime[Op.lte] = end;
    }
  }
  if (billingStatus && billingStatus !== 'all') where.billingStatus = billingStatus;
  if (serviceType && serviceType !== 'all') {
    where.serviceType = serviceType;
  } else {
    where.serviceType = { [Op.in]: ['direct', 'circle', 'supervision', 'indirect'] };
  }
  if (bcbaId)      where.bcbaId      = bcbaId;
  if (therapistId) where.therapistId = therapistId;
  where.status = { [Op.in]: ['completed', 'scheduled'] };

  const appointments = await Appointment.findAll({
    where,
    include: [
      { model: Patient, required: false, where: orgId ? { organizationId: orgId } : undefined },
      { model: User, as: 'Therapist', required: false, attributes: ['id','firstName','lastName','npi','credentials','providerLevel'] },
      { model: User, as: 'BCBA',      required: false, attributes: ['id','firstName','lastName','npi','credentials','providerLevel'] },
      { model: Location, required: false },
    ],
    order: [['startTime', 'ASC']],
  });

  const sessions = appointments.map(buildBillingRecord);
  const totalSessions  = sessions.length;
  const totalUnits     = sessions.reduce((s, r) => s + (r.units || 0), 0);
  const totalEstimated = sessions.reduce((s, r) => s + (r.estimatedAmount || 0), 0);

  const cptBreakdown = {};
  for (const r of sessions) {
    const key = r.cptCode || 'N/A';
    if (!cptBreakdown[key]) cptBreakdown[key] = { cptCode: key, description: CPT_CODES[key]?.description || 'Not Billable', sessions: 0, units: 0, estimated: 0 };
    cptBreakdown[key].sessions++;
    cptBreakdown[key].units     += r.units || 0;
    cptBreakdown[key].estimated += r.estimatedAmount || 0;
  }

  return {
    summary: { totalSessions, totalUnits, totalEstimated, cptBreakdown: Object.values(cptBreakdown) },
    sessions,
  };
}

/**
 * GET /api/admin/billing/reference
 * Return CPT codes + ICD10 codes for dropdowns
 */
const getBillingReference = async (req, res) => {
  return res.status(200).json({ cptCodes: Object.values(CPT_CODES), icd10Codes: ICD10_CODES });
};

module.exports = {
  getBillingReport,
  updateSessionBilling,
  batchUpdateStatus,
  exportBillingReport,
  getBillingReference,
};
