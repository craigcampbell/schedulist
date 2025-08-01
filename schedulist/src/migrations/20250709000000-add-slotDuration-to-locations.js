'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Locations', 'slotDuration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: 'Duration of each time slot in minutes (30 or 60)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Locations', 'slotDuration');
  }
};