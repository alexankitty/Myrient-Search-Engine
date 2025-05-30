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
  let promiseIndex = 0;
  let currentIndex = 0;
  let result = await File.findAll({
    order: ["id", "filename"],
    attributes: [
      "id",
      "filename",
      "filenamekws",
      "category",
      "categorykws",
      "subcategories",
      "subcategorieskws",
      "region",
      "regionkws",
      "type",
      "nongame"
    ],
  });
  for (let i = 0; i < dbLength; ) {
    let loopIndexStart = i;
    singleLineStatus(
      `Optimizing Keywords: ${i} / ${dbLength} ${((i / dbLength) * 100).toFixed(
        2
      )}% (${proctime.elapsed()})`
    );

    for (let x = i; x < currentIndex + BATCH_SIZE; x++) {
      if(x >= dbLength) break; //Abort abandon ship, otherwise we sink
      debugPrint(`Submitting job for: ${result[x].filename}`);
      let data = [];
      for (let column in keywords) {
        data[column] = result[x][column];
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
    currentIndex = i;
    let settledTasks = await Promise.all(optimizeTasks);
    resolvedTasks.push(...settledTasks);
    debugPrint(`Resolving ${resolvedTasks.length} optimization tasks.`);
    for (let y = 0; y < resolvedTasks.length; y++) {
      let changed = false;
      for (let column in keywords) {
        if (
          result[promiseIndex][column + "kws"] ==
          resolvedTasks[y][column + "kws"]
        )
          continue;
        result[promiseIndex][column + "kws"] = resolvedTasks[y][column + "kws"];
        changed = true;
      }
      if (changed) {
        result[promiseIndex].save();
        changes++;
      }
      promiseIndex++;
    }
    await bulkIndexFiles(result.slice(loopIndexStart, currentIndex));
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
