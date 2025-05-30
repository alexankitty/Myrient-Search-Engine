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
        type: DataTypes.STRING(4096),
      },
      description: {
        type: DataTypes.STRING(16384),
      },
      rating: {
        type: DataTypes.STRING,
      },
      coverartid: {
        type: DataTypes.STRING(2048),
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
      titleVector: {
        type: DataTypes.TSVECTOR,
        allowNull: true,
      },
      alternatetitlesVector: {
        type: DataTypes.TSVECTOR,
        allowNull: true,
      },
    },
    {
      indexes: [
        { fields: ["title"] },
        {
          name: "metadata_search_t_idx",
          using: "gin",
          fields: ["titleVector"],
        },
        {
          name: "metadata_search_at_idx",
          using: "gin",
          fields: ["alternatetitlesVector"],
        },
      ],
    }
  );

  Metadata.beforeSave("addVector", async (instance) => {
    const title = instance.title || "";
    const alternateTitles =
      JSON.parse(instance.alternatetitles || "[]")
    const titles = Object.values(alternateTitles).join(', ')
    let query = `
                SELECT to_tsvector('english', $1)
            `;
    let [results] = await sequelize.query(query, {
      bind: [title],
      raw: true,
    });
    instance.titleVector = results[0].to_tsvector;
    query = `
                SELECT to_tsvector('english', $1)
            `;
    [results] = await sequelize.query(query, {
      bind: [titles],
      raw: true,
    });
    instance.alternatetitlesVector = results[0].to_tsvector;
  });

  // Add a class method for full-text search
  Metadata.searchByText = async function (field, searchQuery, platform, limit = 1) {
    let platformClause = "";
    let limitClause = `LIMIT ${limit}`;
    if (platform && platform != "Others") {
      platformClause = `AND '${platform}' = ANY(platforms)`;
    }
    let fieldName = field + 'Vector'
    const query = `
            SELECT id FROM "Metadata"
            WHERE "${fieldName}" @@ plainto_tsquery('english', $1) ${platformClause}
            ORDER BY length(title) ${limitClause}
        `;
    return await sequelize.query(query, {
      bind: [searchQuery],
      type: sequelize.QueryTypes.SELECT,
    });
  };

  Metadata.fuzzySearchByText = async function (
    field,
    searchQuery,
    fuzziness,
    platform,
    limit = 1
  ) {
    fuzziness = fuzziness || 0.6;
    let platformClause = "";
    let limitClause = `LIMIT ${limit}`;
    if (platform && platform != "Others") {
      platformClause = `AND '${platform}' = ANY(platforms)`;
    }
    const query = `
            SELECT id FROM "Metadata"
            WHERE SIMILARITY($1, $2) > $3
            ${platformClause}
            ORDER BY length(title) ${limitClause}
    `;

    return await sequelize.query(query, {
      model: Metadata,
      bind: [field, searchQuery, fuzziness],
      type: sequelize.QueryTypes.SELECT,
    });
  };

  return Metadata;
}
