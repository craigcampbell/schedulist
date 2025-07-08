'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the column already exists
    const tableDescription = await queryInterface.describeTable('Patients');
    
    if (!tableDescription.color) {
      await queryInterface.addColumn('Patients', 'color', {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: '#6B7280',
        comment: 'Color assigned to patient for visual identification in schedules (hex format)'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Patients');
    
    if (tableDescription.color) {
      await queryInterface.removeColumn('Patients', 'color');
    }
  }
};