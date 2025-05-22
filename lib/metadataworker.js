import { twitchAccessToken, igdb, request } from "@phalcode/ts-igdb-client";
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

const twitchSecrets = {
  client_id: process.env.TWITCH_CLIENT_ID,
  client_secret: process.env.TWITCH_CLIENT_SECRET,
};
const accessToken = await twitchAccessToken(twitchSecrets);

const client = igdb(twitchSecrets.client_id, accessToken);

const gameFields = [
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
  "multiplayer_modes.*",
  "game_localizations.name",
  "game_localizations.region",
  "platforms.name",
];

export async function getMetadata(query) {
  const data = await client
    .request("games")
    .pipe(
      fields(gameFields),
      or(...buildOrAndClauses("name", "~", query)),
      sort("name", "asc")
    )
    .execute();
  return data;
}

function buildOrClauses(field, op, queries) {
  let orClauses = [];
  for (let x in queries) {
    orClauses.push(where(field, op, queries[x], WhereFlags.CONTAINS));
  }
  return orClauses;
}

function buildOrAndClauses(field, op, queries) {
  let orClauses = [];

  for (let x in queries) {
    let name = [...new Set(queries[x].split(" "))]; //dedupe;
    let andClauses = [];
    for (let y in name) {
      andClauses.push(where(field, op, name[y], WhereFlags.CONTAINS));
    }
    orClauses.push(and(...andClauses));
  }
  return orClauses;
}

function normalizeName(filename) {
  if (!filename) return;
  return filename
    .replace(/\.[A-z]{3,3}|\.|&|-|,|v[0-9]+\.[0-9]+|\[.*?\]|\(.*?\)/g, "")
    .trim();
}

function getBestMatch(filename, data) {
  const words = filename.split(" ");
  let bestIndex = null;
  let bestMatchCount = 0;
  let lengthDifference = 0;
  for (let x in data) {
    let matchingWords = 0;
    for (let y in words) {
      if (data[x].name.toLowerCase().includes(words[y].toLowerCase()))
        matchingWords++;
    }
    let diff = matchingWords - dataWords.length;
    if (matchingWords > bestMatchCount && diff < lengthDifference) {
      bestIndex = x;
      bestMatchCount = matchingWords;
      lengthDifference = diff;
      if (lengthDifference < 0) lengthDifference = 0;
    }
  }
  if (bestIndex != null) {
    return data[bestIndex];
  }
  return;
}

let games = await getMetadata([
  "The Legend of Zelda A Link to the Past",
  "Super Mario Sunshine",
]);
console.log(JSON.stringify(games.data, null, 2));
//console.log(await getMetadata(games))
