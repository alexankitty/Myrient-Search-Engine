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
import TaskQueue from "./taskqueue.js";
import { singleLineStatus } from "./debugprint.js";
import { Timer } from "./time.js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";

export default class MetadataSearch {
  constructor() {
    this.twitchSecrets = {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
    };
    this.setupClient();
    this.queue = new TaskQueue();
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
    "screenshots.image_id",
    "videos.video_id",
  ];

  getPlatformMapping() {
    
  }

  async setupClient() {
    try {
      if (this.twitchSecrets.client_id && this.twitchSecrets.client_secret) {
        this.accessToken = await twitchAccessToken(this.twitchSecrets);
        this.client = igdb(this.twitchSecrets.client_id, this.accessToken);
        const mapFilePath = "./lib/json/igdb_platform_map.json";
        this.platformMap = JSON.parse(readFileSync(mapFilePath, "utf8"));
        if (this.accessToken) {
          this.authorized = true;
          this.syncAllMetadata();
          return;
        }
      }
      this.authorized = false; //disable
    } catch (error) {
      this.authorized = false;
    }
  }

  normalizeName(filename) {
    if (!filename) return;
    return filename
      .replace(
        /\.[A-z]{3,3}|\.|&|-|\+|,|v[0-9]+\.[0-9]+|\[.*?\]|\(.*?\)|the|usa/gi,
        ""
      )
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async getIGDBGamesCount(retrying = false) {
    try {
      if (!this.authorized) return 0;
      const { data } = await this.client
        .request("games/count")
        .pipe(
          and(
            where("game_type.type", "!=", "Mod"),
            where("game_type.type", "!=", "DLC")
          )
        )
        .execute();
      return data.count;
    } catch (error) {
      if (error.code === "ERR_BAD_REQUEST" && !retrying) {
        this.setupClient();
        return this.getIGDBGamesCount(true);
      }
      console.error("Error getting IGDB games count:", error);
      return 0;
    }
  }

  async matchAllMetadata() {
    let games = await File.findAndCountAll({
      where: {
        nongame: false,
      },
      limit: 1000,
    });
    for (let x in games) {
      let game = games[x];
      let metadata = await Metadata.searchByText(this.normalizeName(game.filename), game.category);
      if (metadata) {
        await game.setDetails(metadata);
        await metadata.addFile(game);
      }
    }
  }

  async syncAllMetadata(retrying = false) {
    try {
      const timer = new Timer();
      if (!this.authorized) {
        console.log(
          "Twitch credentials are unavailable or invalid; metadata sync is unavailable."
        );
        return;
      }
      console.log("Syncing all metadata...");
      let count = await this.getIGDBGamesCount();
      let pageSize = 500;
      let pages = Math.ceil(count / pageSize);
      let retryCount = 0;
      for (let x = 0; x < pages; x++) {
        if (retryCount == 5) continue;
        singleLineStatus(
          `Syncing metadata: ${x * 500} / ${count} ${(
            ((x * 500) / count) *
            100
          ).toFixed(2)}% (${timer.elapsed()})`
        );
        try {
          let { data } = await this.client
            .request("games")
            .pipe(
              limit(pageSize),
              offset(x * pageSize),
              fields(this.gameFields)
            )
            .execute();
          for (let y in data) {
            await this.addMetadataToDb(data[y]);
          }
        } catch (error) {
          if (error.code === "ERR_BAD_RESPONSE") {
            x--;
            await this.sleep(1000);
            retryCount++;
            console.log(
              `Retrieving metadata at offset ${
                x * 500
              } failed. Retry count: ${retryCount}`
            );
            continue;
          }
          throw error; //hoist it up
        }
        retryCount = 0;
      }
    } catch (error) {
      if (error.code === "ERR_BAD_REQUEST" && !retrying) {
        this.setupClient();
        return this.syncAllMetadata(true);
      }
      console.error("Error syncing all metadata:", error);
    }
  }

  async addMetadataToDb(metadata, game) {
    try {
      let md = await Metadata.findByPk(metadata.id);
      if (!md) {
        md = await Metadata.build(
          {
            id: metadata.id,
          },
          {
            returning: true,
            updateOnDuplicate: ["id"],
            include: File,
          }
        );
      }
      md.title = metadata.name;

      md.description = metadata.summary;
      md.rating = metadata.total_rating;
      md.coverartid = metadata.cover?.image_id;
      md.releasedate = metadata.first_release_date
        ? new Date(metadata.first_release_date * 1000)
        : null;
      md.genre = metadata.genres?.map((genre) => genre.name);
      md.gamemodes = metadata.game_modes?.map((gm) => gm.name);
      md.platforms = metadata.platforms?.map((platform) => this.platformMap[platform.name] || platform.name);
      md.screenshots = metadata.screenshots?.map((ss) => ss.image_id);
      md.videos = metadata.videos?.map((v) => v.video_id);
      md.developers = metadata.involved_companies
        ?.filter((ic) => ic.developer)
        ?.map((ic) => ic.company.name);
      md.publishers = metadata.involved_companies
        ?.filter((ic) => ic.publisher)
        ?.map((ic) => ic.company.name);
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
      //this needs to remain json as we want the keys to be retained
      md.alternatetiles = JSON.stringify(alternates);
      await md.save();
      if (game) {
        await game.setDetails(md);
        await md.addFile(game);
      }
    } catch (error) {
      console.error("Error adding metadata:", error);
    }
  }
  async sleep(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
