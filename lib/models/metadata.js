import { DataTypes } from "sequelize"

export default function (sequelize) {
  const Metadata = sequelize.define('Metadata', {
        id: {//these will match the igdbid to make things a little easier
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        alternatetitles: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.TEXT
        },
        rating: {
            type: DataTypes.STRING
        },
        coverartid: {
            type: DataTypes.STRING
        },
        releasedate: {
            type: DataTypes.DATE
        },
        genre: {
            type: DataTypes.STRING
        },
        developers: {
            type: DataTypes.STRING
        },
        publishers: {
            type: DataTypes.STRING
        },
        gamemodes:{
            type: DataTypes.STRING
        },
        platforms: {
            type: DataTypes.STRING
        }
    }, {
    indexes: [
        { fields: ['title'] },
        { fields: ['description'] },//If this slows down the db may want to not index this.
        ]
    })
    
    return Metadata
}