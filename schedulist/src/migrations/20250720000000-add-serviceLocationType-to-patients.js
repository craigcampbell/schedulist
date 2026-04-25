'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Patients', 'serviceLocationType', {
      type: Sequelize.ENUM('clinic', 'home', 'school'),
      defaultValue: 'clinic',
      allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Patients', 'serviceLocationType');
  },
};
