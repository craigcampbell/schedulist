'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add invite token fields to Users table
      await queryInterface.addColumn('Users', 'inviteToken', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });
      
      await queryInterface.addColumn('Users', 'inviteExpires', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });
      
      // Add default location field
      await queryInterface.addColumn('Users', 'defaultLocationId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Locations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });
      
      // Create UserLocations junction table for many-to-many relationship
      await queryInterface.createTable('UserLocations', {
        userId: {
          type: Sequelize.UUID,
          primaryKey: true,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        locationId: {
          type: Sequelize.UUID,
          primaryKey: true,
          references: {
            model: 'Locations',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });
      
      // Add indexes for performance
      await queryInterface.addIndex('UserLocations', ['userId'], { transaction });
      await queryInterface.addIndex('UserLocations', ['locationId'], { transaction });
      await queryInterface.addIndex('Users', ['inviteToken'], { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove indexes
      await queryInterface.removeIndex('Users', ['inviteToken'], { transaction });
      await queryInterface.removeIndex('UserLocations', ['locationId'], { transaction });
      await queryInterface.removeIndex('UserLocations', ['userId'], { transaction });
      
      // Drop UserLocations table
      await queryInterface.dropTable('UserLocations', { transaction });
      
      // Remove columns from Users table
      await queryInterface.removeColumn('Users', 'defaultLocationId', { transaction });
      await queryInterface.removeColumn('Users', 'inviteExpires', { transaction });
      await queryInterface.removeColumn('Users', 'inviteToken', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};