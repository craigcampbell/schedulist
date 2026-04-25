'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First add the column as STRING to avoid ENUM issues
    await queryInterface.addColumn('Locations', 'locationType', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'clinic',
      comment: 'Type of location: clinic (in-clinic), home (patient home/remote), school (school-based)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Locations', 'locationType');
  }
};
