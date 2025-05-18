import { ToWords } from "to-words";
import { getSample } from "./services/elasticsearch.js";

const toWords = new ToWords({
  localeCode: "en-US",
  converterOptions: {
    ignoreDecimal: false,
    doNotAddOnly: true,
  },
});

function stringToWordArray(string) {
  let symbolRegex =
    /_|\+|=|\)|\(|\[|{|}|]|;|:|"|'|<|>|\.|,|\/|\?|\||\\|!|@|#|\$|%|\^|&|\*/g;
  let workingString = string.replaceAll("-", " ");
  workingString = workingString.replaceAll(symbolRegex, " ");
  let stringArray = workingString.split(" ");
  return stringArray.filter((entry) => entry.trim() != "");
}

function kwProcessor(terms, kwArr) {
  for (let term in terms) {
    terms[term] = terms[term].toLowerCase();
  }
  let foundKws = [];

  for (let word in terms) {
    for (let group in kwArr) {
      let currentGroup = kwArr[group];
      for (let index in currentGroup) {
        if (currentGroup[index] == terms[word]) {
          foundKws.push(...currentGroup);
          break;
        }
      }
    }
  }
  if (foundKws) return [...new Set(foundKws)];
}

async function getNumerals(stringArr) {
  let numerals = [];
  let nameWordLen = 0;
  for (let word in stringArr) {
    let curWord = stringArr[word];
    if (validateRomanNumeral(curWord)) {
      nameWordLen = word;
      let numeral = parseNumeral(curWord);
      if (numeral) numerals.push(numeral);
    }
  }
  //Guard clause, exits when we didn't find a valid numeral
  if (!nameWordLen) return;
  let searchQuery = stringArr.slice(0, nameWordLen).join(" ").trim();
  //Check if this is a series (Using suggestions right now as we don't need a whole lot)
  //Todo: Make a custom elastic search function for this
  let results = await getSample(searchQuery);
  let series = false;
  //always return ii if it's available
  for (let x in numerals) {
    if (numerals[x] == 2) return [...new Set(numerals)];
  }
  if (results.length > 1) {
    for (let x in results) {
      let seriesNumeral = [];
      let words = stringToWordArray(results[x].sample);
      for (let word in words) {
        let numeral = parseNumeral(words[word]);
        if (numeral) seriesNumeral.push(numeral);
      }
      if (seriesNumeral > 0) {
        for (let x in numerals) {
          for (let y in seriesNumeral) {
            if (numerals[x] != seriesNumeral[y]) {
              series = true;
            }
          }
        }
      }
    }
    if (!series) return;
    numerals.push(getNumberNames(numerals));
    return [...new Set(numerals)];
  }
}

function parseNumeral(string) {
  //Keep these upper case to reduce the number of false positives. Make sure the input isn't tolower
  const romanNumerals = {
    /*M: 1000,
        CM: 900,
        D: 500,
        CD: 400,
        C: 100,
        XC: 90,
        L: 50,
        XL: 40,*/
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1,
  };
  if (validateRomanNumeral(string)) {
    let numeralSum = 0;
    string = string.toUpperCase();
    for (let numeral in romanNumerals) {
      while (string.startsWith(numeral)) {
        numeralSum += romanNumerals[numeral];
        string = string.substring(numeral.length);
      }
    }
    if (string.length > 0) return 0;
    return numeralSum;
  }
}

function getNumberNames(stringArr) {
  let numbers = [];
  for (let number in stringArr) {
    let curNum = stringArr[number];
    if (/^\d+$/.test(curNum)) {
      let numberName = toWords.convert(parseInt(curNum));
      if (numberName) numbers.push(numberName.trim());
    }
  }
  return [...new Set(numbers)];
}

function validateRomanNumeral(string) {
  if (!string) return false;
  if (string == "vim") return false;
  let romanRegex = /i|v|x|l|c|d|m/gi;
  return !string.replaceAll(romanRegex, "");
}

export async function optimizeKws(object) {
  for (let column in object.keywords) {
    if (!object.data[column]) continue;
    let wordArr = stringToWordArray(object.data[column]);
    let workKws = kwProcessor(wordArr, object.keywords[column]);
    //special case for filenames
    if (column == "filename") {
      let numerals = await getNumerals(wordArr);
      if (numerals) {
        workKws.push(...numerals);
      }
      workKws.push(...getNumberNames(wordArr));
    }
    object.data[column + "kws"] = workKws.join(" ").trim();
  }
  return object.data;
}
