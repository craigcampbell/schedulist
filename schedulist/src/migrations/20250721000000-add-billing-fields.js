'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Appointments: billing tracking ────────────────────────────────────────
    await queryInterface.addColumn('Appointments', 'billingStatus', {
      type: Sequelize.ENUM('unbilled', 'ready', 'submitted', 'paid', 'denied', 'void'),
      defaultValue: 'unbilled',
      allowNull: false,
    });
    await queryInterface.addColumn('Appointments', 'cptCode', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: 'CPT code override; auto-computed if null',
    });
    await queryInterface.addColumn('Appointments', 'diagnosisCode', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: 'ICD-10 diagnosis code for this session',
    });
    await queryInterface.addColumn('Appointments', 'modifiers', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array of billing modifiers e.g. ["HO","GT"]',
    });
    await queryInterface.addColumn('Appointments', 'placeOfServiceCode', {
      type: Sequelize.STRING(2),
      allowNull: true,
      comment: 'CMS POS code: 11=Office, 12=Home, 03=School',
    });
    await queryInterface.addColumn('Appointments', 'billedUnits', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: '15-min billing units (auto-computed from duration)',
    });
    await queryInterface.addColumn('Appointments', 'billedAmount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Amount billed to insurance',
    });
    await queryInterface.addColumn('Appointments', 'paidAmount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Amount actually paid by insurance',
    });
    await queryInterface.addColumn('Appointments', 'claimNumber', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Insurance claim number after submission',
    });
    await queryInterface.addColumn('Appointments', 'authorizationNumber', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Prior authorization number for this session',
    });
    await queryInterface.addColumn('Appointments', 'billingNotes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // ── Patients: insurance/authorization fields ───────────────────────────────
    await queryInterface.addColumn('Patients', 'encryptedMemberId', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Encrypted insurance member ID',
    });
    await queryInterface.addColumn('Patients', 'encryptedGroupNumber', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Encrypted insurance group number',
    });
    await queryInterface.addColumn('Patients', 'primaryDiagnosisCode', {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: 'F84.0',
      comment: 'Primary ICD-10 diagnosis code (default ASD)',
    });
    await queryInterface.addColumn('Patients', 'secondaryDiagnosisCodes', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Additional ICD-10 codes e.g. ["F90.2"]',
    });
    await queryInterface.addColumn('Patients', 'authorizationNumber', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('Patients', 'authorizationStartDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Patients', 'authorizationEndDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Patients', 'authorizedUnits', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Total authorized 15-min units for the auth period',
    });

    // ── Locations: CMS place of service code ─────────────────────────────────
    await queryInterface.addColumn('Locations', 'placeOfServiceCode', {
      type: Sequelize.STRING(2),
      allowNull: true,
      comment: '11=Office/Clinic, 12=Home, 03=School',
    });

    // ── Users: provider credentials for billing ───────────────────────────────
    await queryInterface.addColumn('Users', 'npi', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: 'National Provider Identifier (10-digit)',
    });
    await queryInterface.addColumn('Users', 'credentials', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'e.g. "BCBA, LBA" or "RBT"',
    });
    await queryInterface.addColumn('Users', 'providerLevel', {
      type: Sequelize.ENUM('paraprofessional', 'bachelor', 'master', 'doctorate'),
      allowNull: true,
      comment: 'Determines billing modifier: HM/HN/HO',
    });
  },

  async down(queryInterface, Sequelize) {
    // Appointments
    for (const col of [
      'billingStatus','cptCode','diagnosisCode','modifiers','placeOfServiceCode',
      'billedUnits','billedAmount','paidAmount','claimNumber','authorizationNumber','billingNotes',
    ]) {
      await queryInterface.removeColumn('Appointments', col);
    }
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS \"enum_Appointments_billingStatus\";"
    );

    // Patients
    for (const col of [
      'encryptedMemberId','encryptedGroupNumber','primaryDiagnosisCode','secondaryDiagnosisCodes',
      'authorizationNumber','authorizationStartDate','authorizationEndDate','authorizedUnits',
    ]) {
      await queryInterface.removeColumn('Patients', col);
    }

    // Locations
    await queryInterface.removeColumn('Locations', 'placeOfServiceCode');

    // Users
    for (const col of ['npi','credentials','providerLevel']) {
      await queryInterface.removeColumn('Users', col);
    }
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS \"enum_Users_providerLevel\";"
    );
  },
};
