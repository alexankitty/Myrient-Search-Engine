export default function debugPrint(string){
    if(process.env.DEBUG == "1"){
        console.log(string)
    }
}

export function debugPrintDir(string){
    if(process.env.DEBUG == "1"){
        console.dir(string)
    }
}

export function singleLineStatus(string){
    if(process.stdout.isTTY && process.env.DEBUG != "1"){
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(string);
    } else {
        console.log(string);
    }
}