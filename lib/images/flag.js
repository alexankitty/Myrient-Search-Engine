import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flagsDir = path.join(__dirname, "../../views/public/images/flags");


export default class Flags {
  constructor() {
    this.flags = this.getAvailableFlags();
    this.basePath = '/public/images/flags/'
  }

  getAvailableFlags() {
    try {
      return fs
        .readdirSync(flagsDir)
        .filter((file) => file.endsWith(".png"))
        .map((file) => path.basename(file, ".png"));
    } catch (error) {
      console.error("Error reading flags directory:", error);
      return [];
    }
  }

  ifFlagExists(string){
    return this.flags.includes(string)
  }

  getFlagPath(string){
    return `${this.basePath}${string}.png`
  }

  createFlag(string){
    if(this.ifFlagExists(string)){
        return `<img class="flag" src="${this.getFlagPath(string)}"></img>`
    }
    return ''
  }
}
