'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add teamId to Patients table
    await queryInterface.addColumn('Patients', 'teamId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Teams',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for better query performance
    await queryInterface.addIndex('Patients', ['teamId']);

    // Add teamId to Appointments table for denormalization
    await queryInterface.addColumn('Appointments', 'teamId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Teams',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for appointments teamId
    await queryInterface.addIndex('Appointments', ['teamId']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('Appointments', ['teamId']);
    await queryInterface.removeIndex('Patients', ['teamId']);
    
    // Remove columns
    await queryInterface.removeColumn('Appointments', 'teamId');
    await queryInterface.removeColumn('Patients', 'teamId');
  }
};