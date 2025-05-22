import { DataTypes } from "sequelize"

export default function (sequelize) {
  const Metadata = sequelize.define('Metadata', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        alternatetitles: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.STRING
        },
        rating: {
            type: DataTypes.STRING
        },
        coverarturl: {
            type: DataTypes.STRING
        },
        releasedate: {
            type: DataTypes.DATE
        },
        igdbid: {
            type: DataTypes.INTEGER
        },
        timetobeat: {
            type: DataTypes.STRING
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
        }
    }, {
    indexes: [
        { fields: ['title'] },
        { fields: ['description'] }//If this slows down the db may want to not index this.
        ]
    })
    
    return Metadata
}