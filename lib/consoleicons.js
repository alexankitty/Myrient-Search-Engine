export default class ConsoleIcons {
    constructor(consoleData){
        this.consoleData = consoleData
    }

    getConsoleImage(console){
        return this.consoleData[console]?.icon
    }
    ifConsoleExists(console){
        return this.consoleData[console] ? true : false
    }
    createConsoleImage(console){
        //fixups
        console = console.replace('Sony PlayStation', 'PlayStation')
        console = console.replace('Microsoft Xbox', 'Xbox')
        console = console.replace(/^Xbox$/, 'Xbox Classic')
        console = console.replace(/^Nintendo Game Boy$/, 'Nintendo Game Boy/Color')
        console = console.replace('Nintendo Game Boy Color', 'Nintendo Game Boy/Color')
        if(this.ifConsoleExists(console)){
            return `<img class='console' src='/proxy-image?url=${encodeURIComponent(this.getConsoleImage(console))}'>`
        }
        return ''
    }
}