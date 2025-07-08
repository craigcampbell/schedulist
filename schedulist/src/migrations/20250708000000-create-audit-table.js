'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Audits', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      entityType: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The type of entity being audited (e.g., User, Appointment, Patient)'
      },
      entityId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'The ID of the entity being audited'
      },
      action: {
        type: Sequelize.ENUM('create', 'update', 'delete', 'password_change', 'login', 'logout', 'permission_change'),
        allowNull: false,
        comment: 'The type of action performed'
      },
      fieldName: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'The specific field that was changed (null for create/delete actions)'
      },
      oldValue: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Previous value (encrypted for sensitive data)'
      },
      newValue: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'New value (encrypted for sensitive data)'
      },
      changedById: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'User who made the change'
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Organization context for the audit'
      },
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'IP address of the user making the change'
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent/browser information'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional context-specific data'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('Audits', ['entityType', 'entityId']);
    await queryInterface.addIndex('Audits', ['changedById']);
    await queryInterface.addIndex('Audits', ['organizationId']);
    await queryInterface.addIndex('Audits', ['createdAt']);
    await queryInterface.addIndex('Audits', ['action']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Audits');
  }
};