require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'schedulist',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  dialect: 'postgres',
  logging: false,
};

async function createAdmin() {
  console.log('Connecting to database...');
  const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging,
    }
  );

  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Define simplified models for our purpose
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      phone: DataTypes.STRING,
      active: DataTypes.BOOLEAN,
      organizationId: DataTypes.UUID,
      isSuperAdmin: DataTypes.BOOLEAN,
    }, {
      timestamps: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        }
      }
    });

    const Role = sequelize.define('Role', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: DataTypes.STRING,
      description: DataTypes.STRING,
    }, {
      timestamps: true
    });

    // Define the many-to-many relationship
    const UserRole = sequelize.define('UserRole', {
      userId: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      roleId: {
        type: DataTypes.UUID,
        references: {
          model: 'Roles',
          key: 'id'
        }
      }
    }, {
      timestamps: true
    });

    User.belongsToMany(Role, { through: UserRole });
    Role.belongsToMany(User, { through: UserRole });

    // Find or create the admin role
    let adminRole = await Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      console.log('Admin role not found, creating it...');
      adminRole = await Role.create({
        name: 'admin',
        description: 'System administrator with full access'
      });
    }

    // Test credentials
    const testAdmin = {
      email: 'admin@test.com',
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'Admin',
      phone: '555-123-4567',
      active: true,
      isSuperAdmin: true
    };

    // Check if user already exists
    let user = await User.findOne({ where: { email: testAdmin.email } });
    
    if (user) {
      console.log('Test admin user already exists, updating password...');
      // Directly update the password to avoid double-hashing
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testAdmin.password, salt);
      
      await sequelize.query(
        `UPDATE "Users" SET "password" = ? WHERE "email" = ?`,
        {
          replacements: [hashedPassword, testAdmin.email],
          type: sequelize.QueryTypes.UPDATE
        }
      );
    } else {
      console.log('Creating new test admin user...');
      user = await User.create(testAdmin);
      await user.addRole(adminRole);
    }

    console.log('Test admin user ready:');
    console.log(`Email: ${testAdmin.email}`);
    console.log(`Password: ${testAdmin.password}`);
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
}

createAdmin();