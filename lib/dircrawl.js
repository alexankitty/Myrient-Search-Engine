import { getTableRows, parseOutFile } from "./fileworker.js";
import { Piscina, FixedQueue } from "piscina";
import { resolve } from "path";
import debugPrint from "./debugprint.js";
import { File } from "./models/index.js";
import { bulkIndexFiles } from "./services/elasticsearch.js";
import { optimizeDatabaseKws } from "./dboptimize.js";
import { Timer } from "./time.js";

let piscina = new Piscina({
  filename: resolve("./lib", "fileworker.js"),
  taskQueue: new FixedQueue(),
});

const BATCH_SIZE = 1000; // Process files in batches for better performance

export default async function getAllFiles(catList) {
  var proctime = new Timer();
  const url = "https://myrient.erista.me/files/";
  let parentRows = await getTableRows({ url: url, base: "" });
  let parents = [];
  for (let x = 0; x < parentRows.html.length; x++) {
    parents.push(
      await parseOutFile({
        file: parentRows.html[x],
        base: "",
        url: url,
        catList: catList,
      })
    );
  }
  let dirWork = splitFilesAndFolders(parents);
  // First run should only have directories. Is there a reason this could change in the future?
  let dirs = dirWork.directories;
  let fetchTasks = [];
  let resolvedFetchTasks = [];
  let parseTasks = [];
  let fileCount = 0;
  let currentBatch = [];

  while (
    dirs.length > 0 ||
    fetchTasks.length > 0 ||
    parseTasks.length > 0 ||
    resolvedFetchTasks.length > 0
  ) {
    let dirStatus = "";
    if (dirs.length > 0) {
      debugPrint(`Queueing: ${dirs[0].name}`);
      fetchTasks.push(
        piscina
          .run(
            { url: dirs[0].path, base: dirs[0].name },
            { name: "getTableRows" }
          )
          .catch((err) => {
            console.error(err);
          })
      );
      dirs.shift();
    }

    if (
      fetchTasks.length >= parseInt(process.env.MAX_FETCH_JOBS) ||
      ((fetchTasks.length > 0 || resolvedFetchTasks.length > 0) &&
        parseTasks.length == 0)
    ) {
      debugPrint(`Resolving ${fetchTasks.length} fetch tasks.`);
      let settledTasks = await Promise.all(fetchTasks);
      resolvedFetchTasks.push(...settledTasks);
      while (resolvedFetchTasks.length > 0) {
        if (piscina.queueSize >= parseInt(process.env.MAX_JOB_QUEUE)) {
          break;
        }
        let completedTask = resolvedFetchTasks[0];
        if (!completedTask) {
          console.log("Myrient crawl failed, try again later.");
          return;
        }
        for (let y = 0; y < completedTask.html.length; y++) {
          parseTasks.push(
            piscina.run(
              {
                file: completedTask.html[y],
                base: completedTask.base,
                url: completedTask.url,
                catList: catList,
              },
              { name: "parseOutFile" }
            )
          );
        }
        resolvedFetchTasks.shift();
      }

      fetchTasks = [];
      dirStatus = `Directories Remaining: ${
        dirs.length
      }, Files Found: ${fileCount} (${proctime.elapsed()}`;
    }

    if (dirs.length == 0 && parseTasks.length > 0) {
      debugPrint(`Resolving ${parseTasks.length} parse tasks.`);
      let settledTasks = await Promise.all(parseTasks);
      let working = splitFilesAndFolders(settledTasks);

      if (working.files.length > 0) {
        // Process files in smaller chunks to avoid stack overflow
        for (let i = 0; i < working.files.length; i++) {
          currentBatch.push(working.files[i]);
          if (currentBatch.length >= BATCH_SIZE) {
            await processBatch(currentBatch);
            fileCount += currentBatch.length;
            currentBatch = [];
          }
        }
      }

      if (working.directories.length > 0) {
        // Process directories in chunks to avoid stack overflow
        for (let i = 0; i < working.directories.length; i++) {
          dirs.push(working.directories[i]);
        }
      }

      parseTasks = [];
      dirStatus = `Directories Remaining: ${
        dirs.length
      }, Files Found: ${fileCount} (${proctime.elapsed()}`;
    }

    if (dirStatus) {
      if (process.env.DEBUG == "1") {
        console.log(dirStatus);
      } else {
        singleLineStatus(dirStatus);
      }
    }
  }

  // Process any remaining files in the last batch
  if (currentBatch.length > 0) {
    await processBatch(currentBatch);
    fileCount += currentBatch.length;
  }

  console.log(`\nFinished crawling Myrient in ${proctime.elapsed()}.`);
  await piscina.close();
  await optimizeDatabaseKws();
  return fileCount;
}

async function processBatch(files) {
  try {
    // Process in small chunks to avoid memory issues
    const chunkSize = 1000;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      const dbFiles = await File.bulkCreate(
        chunk.map((file) => ({
          filename: file.filename,
          path: file.path,
          size: file.size,
          category: file.category,
          type: file.type,
          date: file.date,
          region: file.region,
          group: file.group,
          nongame: file.nongame,
        })),
        {
          returning: true,
          updateOnDuplicate: ["path"],
        }
      );

      // Index chunk in Elasticsearch
      await bulkIndexFiles(dbFiles);
      debugPrint(
        `Processed ${i + chunk.length} of ${
          files.length
        } files in current batch`
      );
    }
  } catch (error) {
    console.error("Error processing batch:", error);
  }
}

function splitFilesAndFolders(dirArray) {
  let directories = [];
  let files = [];
  //first item is always the parent directory
  for (let x = 1; x < dirArray.length; x++) {
    if (typeof dirArray[x] == "undefined") continue;
    if (dirArray[x].size == "-") {
      directories.push(dirArray[x]);
    } else {
      files.push(dirArray[x]);
    }
  }
  return {
    directories: directories,
    files: files,
  };
}

function singleLineStatus(str) {
  if (process.stdout.isTTY) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(str);
  } else {
    console.log(str);
  }
}
