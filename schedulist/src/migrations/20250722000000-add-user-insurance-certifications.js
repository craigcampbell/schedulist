'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'insurancePanels', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Insurance companies this provider is credentialed/paneled with',
    });
    await queryInterface.addColumn('Users', 'certifications', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Professional certifications held by this provider',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'insurancePanels');
    await queryInterface.removeColumn('Users', 'certifications');
  },
};
