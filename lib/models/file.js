import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const File = sequelize.define('File', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    path: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    size: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    subcategories: {
      type: DataTypes.TEXT
    },
    filenamekws: {
      type: DataTypes.TEXT,
    },
    categorykws: {
      type: DataTypes.TEXT,
    },
    subcategorieskws: {
      type: DataTypes.TEXT,
    },
    regionkws: {
      type: DataTypes.TEXT,
    },
    type: {
      type: DataTypes.TEXT
    },
    date: {
      type: DataTypes.TEXT
    },
    region: {
      type: DataTypes.TEXT
    },
    group: {
      type: DataTypes.TEXT
    },
    blockmetadata: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    indexes: [
      { fields: ['filename'] },
      { fields: ['category'] },
      { fields: ['type'] },
      { fields: ['region'] }
    ]
  });
  return File;
}