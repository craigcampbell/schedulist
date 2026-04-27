const express = require('express');
const billingController = require('../controllers/billing.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// All billing routes require admin
router.use(verifyToken, isAdmin);

// Billing report (used by the UI)
router.get('/report', billingController.getBillingReport);

// Export as CSV or XLSX
router.get('/export', billingController.exportBillingReport);

// Reference data (CPT codes, ICD-10 list)
router.get('/reference', billingController.getBillingReference);

// Update billing fields on a single session
router.put('/sessions/:id', billingController.updateSessionBilling);

// Batch-update status on multiple sessions
router.post('/sessions/batch-status', billingController.batchUpdateStatus);

module.exports = router;
