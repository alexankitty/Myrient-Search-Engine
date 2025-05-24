import {
  twitchAccessToken,
  igdb,
  request,
  multi,
} from "@phalcode/ts-igdb-client";
import {
  fields,
  or,
  and,
  where,
  whereIn,
  WhereFlags,
  WhereInFlags,
  sort,
  limit,
  offset,
} from "@phalcode/ts-igdb-client";
import { File, Metadata } from "./database.js";
import { Sequelize } from "sequelize";

export default class MetadataSearch {
  constructor() {
    this.twitchSecrets = {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
    };
    this.setupClient();
  }
  gameFields = [
    "name",
    "alternative_names.comment",
    "alternative_names.name",
    "cover.image_id",
    "total_rating",
    "first_release_date",
    "summary",
    "genres.name",
    "involved_companies.company.name",
    "involved_companies.developer",
    "involved_companies.publisher",
    "involved_companies.supporting",
    "game_modes.name",
    "game_localizations.name",
    "game_localizations.region",
    "game_localizations.region.name",
    "platforms.name",
    "game_type.type",
  ];

  async setupClient() {
    try {
      if (this.twitchSecrets.client_id && this.twitchSecrets.client_secret) {
        this.accessToken = await twitchAccessToken(this.twitchSecrets);
        this.client = igdb(this.twitchSecrets.client_id, this.accessToken);
        if (this.accessToken) {
          this.authorized = true;
          return;
        }
      }
      this.authorized = false; //disable
    } catch (error) {
      this.authorized = false;
    }
  }

  async getMetadata(query, retrying = false) {
    try {
      if (!this.authorized) return;
      const { data } = await this.client
        .multi(...this.buildGameMultiQuery(query))
        .execute();
      return data;
    } catch (error) {
      if (error === "ERR_BAD_REQUEST" && !retrying) {
        this.setupClient();
        return this.getMetadata(query, true);
      }
      console.error("Failed to retrieve metadata:", error);
    }
  }

  buildGameMultiQuery(query) {
    let multiQuery = [];
    for (let x in query) {
      multiQuery.push(
        request("games")
          .alias(x)
          .pipe(
            fields(this.gameFields),
            and(
              ...this.buildAndClauses("name", "~", query[x].name),
              where("game_type.type", "=", "Main Game"),
              where("platforms.name", "~", query[x].platform)
            ),
            limit(1)
          )
      );
    }
    return multiQuery;
  }

  buildAndClauses(field, op, string) {
    let andClauses = [];
    let name = [...new Set(string.split(" "))].filter((n) => n); //dedupe;
    for (let x in name) {
      andClauses.push(where(field, op, name[x], WhereFlags.CONTAINS));
    }
    return andClauses;
  }

  normalizeName(filename) {
    if (!filename) return;
    return filename
      .replace(/\.[A-z]{3,3}|\.|&|-|,|v[0-9]+\.[0-9]+|\[.*?\]|\(.*?\)/g, "")
      .trim();
  }

  async getGamesMetadata(games) {
    try {
      if (!this.authorized || !games.length) return [];
      let gameQuery = [];
      for (let x in games) {
        if (!(await games[x].getDetails()))
          if (!games[x].nongame) {
            if (!games[x].blockmetadata) {
              gameQuery.push({
                name: this.normalizeName(games[x].filename),
                platform: games[x].category,
                id: x,
              });
            }
          }
      }
      if (!gameQuery.length) return [];
      let gameMetas = await this.getMetadata(gameQuery);
      if (!gameMetas.length) return [];
      for (let x in gameMetas) {
        if (gameMetas[x].result.length) {
          await this.addMetadataToDb(
            gameMetas[x].result[0],
            games[gameQuery[x].id]
          );
        }
      }
      let details = await Promise.all(games.map((game) => game.getDetails()));
      return details.map((details) => details?.dataValues);
    } catch (error) {
      console.error("Error getting metadata:", error);
    }
  }

  async addMetadataToDb(metadata, game) {
    try {
      let md = await Metadata.findOne({
        where: {
          id: metadata.id,
        },
      });
      if (!md) {
        md = await Metadata.build(
          {
            id: metadata.id,
            title: metadata.name,

            description: metadata.summary,
            rating: metadata.total_rating,
            coverartid: metadata.cover?.image_id,
            releasedate: metadata.first_release_date
              ? new Date(metadata.first_release_date * 1000)
              : null,
            genre: JSON.stringify(metadata.genres?.map((genre) => genre.name)),
            gamemodes: JSON.stringify(
              metadata.game_modes?.map((gm) => gm.name)
            ),
            platforms: JSON.stringify(
              metadata.platforms?.map((platform) => platform.name)
            ),
          },
          {
            returning: true,
            updateOnDuplicate: ["id"],
            include: File,
          }
        );
      }
      //these don't work right unless I do them after the fact.
      md.developers = JSON.stringify(
        metadata.involved_companies
          ?.filter((ic) => ic.developer)
          ?.map((ic) => ic.company.name)
      );
      md.publishers = JSON.stringify(
        metadata.involved_companies
          ?.filter((ic) => ic.publisher)
          ?.map((ic) => ic.company.name)
      );
      let alternates = [];
      if (metadata.alternative_names) {
        alternates.push(
          metadata.alternative_names.map((an) => ({
            type: an.comment,
            name: an.name,
          }))
        );
      }
      if (metadata.game_localizations) {
        alternates.push(
          metadata.game_localizations.map((gn) => ({
            type: gn.region.name,
            name: gn.name,
          }))
        );
      }
      md.alternatetiles = JSON.stringify(alternates);
      await md.save();
      await game.setDetails(md);
      await md.addFile(game);
    } catch (error) {
      console.error("Error adding metadata:", error);
    }
  }
}
