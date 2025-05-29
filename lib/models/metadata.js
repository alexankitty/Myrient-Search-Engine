import { DataTypes, DATE } from "sequelize";

export default function (sequelize) {
  const Metadata = sequelize.define(
    "Metadata",
    {
      id: {
        //these will match the igdbid to make things a little easier
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      alternatetitles: {
        type: DataTypes.STRING(1024),
      },
      description: {
        type: DataTypes.STRING(16384),
      },
      rating: {
        type: DataTypes.STRING,
      },
      coverartid: {
        type: DataTypes.STRING,
      },
      releasedate: {
        type: DataTypes.DATEONLY,
      },
      genre: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      developers: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      publishers: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      gamemodes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      platforms: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      screenshots: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      videos: {
        type: DataTypes.ARRAY(DataTypes.STRING),
      },
      searchVector: {
        type: DataTypes.TSVECTOR,
        allowNull: true,
      },
    },
    {
      indexes: [
        { fields: ["title"] },
        {
          name: "metadata_search_idx",
          using: "gin",
          fields: ["searchVector"],
        },
      ],
    }
  );

  Metadata.beforeSave("addVector", async (instance) => {
    const title = instance.title || "";
    const query = `
                SELECT to_tsvector('english', $1)
            `;
    const [results] = await sequelize.query(query, {
      bind: [title],
      raw: true,
    });
    instance.searchVector = results[0].to_tsvector;
  });

  // Add a class method for full-text search
  Metadata.searchByText = async function (searchQuery, platform, limit = 1) {
    let platformClause = "";
    let limitClause = `limit ${limit}`;
    if (platform) {
      platformClause = `AND '${platform}' = ANY(platforms)`;
    }
    const query = `
            SELECT * FROM "Metadata"
            WHERE "searchVector" @@ plainto_tsquery('english', :search) :platformClause
            ORDER BY ts_rank("searchVector", plainto_tsquery('english', :search)) DESC :limit
        `;
    return await sequelize.query(query, {
      model: Metadata,
      replacements: {
        search: searchQuery,
        platformClause: platformClause,
        limit: limitClause,
      },
      type: sequelize.QueryTypes.SELECT,
    });
  };

  return Metadata;
}
