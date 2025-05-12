module.exports = (sequelize, DataTypes) => {
  const Team = sequelize.define('Team', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    leadBcbaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#4B5563', // Default gray color
    }
  }, {
    timestamps: true,
  });

  Team.associate = (models) => {
    Team.belongsTo(models.User, {
      foreignKey: 'leadBcbaId',
      as: 'LeadBCBA'
    });
    
    Team.belongsToMany(models.User, {
      through: 'TeamMembers',
      as: 'Members',
      foreignKey: 'teamId'
    });
  };

  return Team;
}; 