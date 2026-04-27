'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Patients', 'insuranceNotes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Admin notes about insurance, billing rules, special requirements',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Patients', 'insuranceNotes');
  },
};
