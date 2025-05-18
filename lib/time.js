export class timer {
  constructor() {
    this.startTime = process.hrtime();
  }
  parseHrtimetoSeconds(hrtime) {
    var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
    return seconds;
  }
  elapsed() {
    let elapsed = this.parseHrtimetoSeconds(process.hrtime(this.startTime));
    let h = Math.floor(elapsed / 3600);
    let m = Math.floor(elapsed / 60);
    let s = Math.floor(elapsed % 60);
    return `${h ? h + "h" : ""}${m ? m + "m" : ""}${s + "s"}`;
  }
}
