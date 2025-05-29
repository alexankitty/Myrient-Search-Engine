import debugPrint from "./debugprint.js";
import { bulkIndexFiles } from "./services/elasticsearch.js";
import { File } from "./models/index.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Piscina, FixedQueue } from "piscina";
import { Timer } from "./time.js";

let piscina = new Piscina({
  filename: resolve("./lib", "dbkwworker.js"),
  taskQueue: new FixedQueue(),
});

const BATCH_SIZE = 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const relatedKwRoot = "../lib/json/relatedkeywords/";
const catKwPath = resolve(__dirname, relatedKwRoot + "categories.json");
const nameKwpath = resolve(__dirname, relatedKwRoot + "names.json");
const regionKwpath = resolve(__dirname, relatedKwRoot + "regions.json");
//make sure the child object matches the column in the file db model
const keywords = {
  filename: JSON.parse(readFileSync(nameKwpath, "utf8")),
  category: JSON.parse(readFileSync(catKwPath, "utf8")),
  subcategories: JSON.parse(readFileSync(catKwPath, "utf8")),
  region: JSON.parse(readFileSync(regionKwpath, "utf8")),
};

export async function optimizeDatabaseKws() {
  let proctime = new Timer();
  let changes = 0;
  console.log("Optimizing DB Keywords...");
  let dbLength = await File.count();
  let optimizeTasks = [];
  let resolvedTasks = [];
  for (let i = 0; i < dbLength; ) {
    singleLineStatus(
      `Optimizing Keywords: ${i} / ${dbLength} ${((i / dbLength) * 100).toFixed(
        2
      )} (${proctime.elapsed()})}`
    );
    let result = await File.findAndCountAll({
      limit: BATCH_SIZE,
      offset: i,
      order: ["id"],
    });
    for (let x = 0; x < result.rows.length; x++) {
      debugPrint(`Submitting job for: ${result.rows[x]["filename"]}`);
      let data = [];
      for (let column in keywords) {
        data[column] = result.rows[x][column];
      }
      optimizeTasks.push(
        piscina
          .run(
            {
              data: data,
              keywords: keywords,
            },
            { name: "optimizeKws" }
          )
          .catch((err) => {
            console.error(err);
          })
      );
      i++;
    }
    let settledTasks = await Promise.all(optimizeTasks);
    resolvedTasks.push(...settledTasks);
    debugPrint(`Resolving ${resolvedTasks.length} optimization tasks.`);
    for (let y = 0; y < resolvedTasks.length; y++) {
      let changed = false;
      for (let column in keywords) {
        if (result.rows[y][column + "kws"] == resolvedTasks[y][column + "kws"])
          continue;
        result.rows[y][column + "kws"] = resolvedTasks[y][column + "kws"];
        changed = true;
      }
      if (changed) {
        result.rows[y].save();
        changes++;
      }
    }
    await bulkIndexFiles(result.rows);
    optimizeTasks = [];
    resolvedTasks = [];
  }
  console.log(
    `\nCompleted Keyword Optimization for ${changes} row${
      changes > 1 || changes == 0 ? "s" : ""
    } in ${proctime.elapsed()}.`
  );
}

function singleLineStatus(str) {
  if (process.stdout.isTTY && process.env.DEBUG != "1") {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(str);
  } else {
    console.log(str);
  }
}
