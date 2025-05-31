import { readFile, writeFile } from "fs/promises";
import fs from "fs";
import path from "path";

export default class FileHandler {
  static async parseJsonFile(filePath) {
    try {
      let data = await JSON.parse(await readFile(filePath, "utf8"));
      return data;
    } catch (err) {
      console.error(err);
    }
  }

  static async saveJsonFile(filePath, fileArr) {
    try {
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

      let data = await JSON.stringify(fileArr);
      await writeFile(filePath, data);
      console.log(`Successfully saved file list to ${filePath}.`);
    } catch (err) {
      console.error(err);
    }
  }

  static fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  static async fileTime(filePath) {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch (err) {
      console.error(err);
    }
  }

  static async readFile(filePath) {
    try {
      return await readFile(filePath, "utf8");
    } catch (err) {
      console.error(err);
    }
  }

  static async writeFile(filePath, data) {
    try {
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

      await writeFile(filePath, data);
    } catch (err) {
      console.error(err);
    }
  }
}
