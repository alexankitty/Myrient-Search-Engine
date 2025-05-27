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
            type: DataTypes.STRING(2048)
        },
        rating: {
            type: DataTypes.STRING
        },
        coverartid: {
            type: DataTypes.STRING
        },
        releasedate: {
            type: DataTypes.DATEONLY
        },
        //anything that stores as json make the limit much higher
        genre: {
            type: DataTypes.STRING(2048)
        },
        developers: {
            type: DataTypes.STRING(2048)
        },
        publishers: {
            type: DataTypes.STRING(2048)
        },
        gamemodes:{
            type: DataTypes.STRING(2048)
        },
        platforms: {
            type: DataTypes.STRING(2048)
        },
        screenshots: {
            type: DataTypes.STRING(2048)
        },
        videos:{
            type: DataTypes.STRING(2048)
        }
    }, {
    indexes: [
        { fields: ['title'] },
        { fields: ['description'] },//If this slows down the db may want to not index this.
        ]
    })
    
    return Metadata
}