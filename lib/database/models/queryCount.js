import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const QueryCount = sequelize.define('QueryCount', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  });

  return QueryCount;
}