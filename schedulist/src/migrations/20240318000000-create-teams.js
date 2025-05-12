'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Teams table
    await queryInterface.createTable('Teams', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      leadBcbaId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: '#4B5563',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    // Create TeamMembers join table
    await queryInterface.createTable('TeamMembers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Teams',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    // Add serviceType to Appointments table
    await queryInterface.addColumn('Appointments', 'serviceType', {
      type: Sequelize.ENUM('direct', 'indirect', 'supervision', 'noOw', 'lunch', 'circle', 'cleaning'),
      allowNull: false,
      defaultValue: 'direct'
    });

    // Make patientId nullable in Appointments
    await queryInterface.changeColumn('Appointments', 'patientId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Patients',
        key: 'id'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the new tables and columns in reverse order
    await queryInterface.removeColumn('Appointments', 'serviceType');
    await queryInterface.changeColumn('Appointments', 'patientId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'Patients',
        key: 'id'
      }
    });
    await queryInterface.dropTable('TeamMembers');
    await queryInterface.dropTable('Teams');
  }
}; 