import innertext from "innertext";
import HTMLParse from "node-html-parser";
import { fileURLToPath } from 'url';
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

export async function getTableRows(data) {
  let retryLeft = 5;
  const delayMs = 500
  while (retryLeft) {
    try{
      return await fetch(data.url)
        .then((response) => {
          return checkStatus(response).text();
        })
        .then(async (html) => {
          const fileHtml = HTMLParse.parse(html);
          const rows = fileHtml.getElementById("list").getElementsByTagName("tr");
          let htmlCollection = [];
          for (let x = 0; x < rows.length; x++) {
            htmlCollection.push(rows[x].innerHTML);
          }
          return {
            html: htmlCollection,
            base: data.base,
            url: data.url,
          };
        })
    }
    catch(error){
      console.error(`\nFetch failed for ${data.url}, retries remaining: ${retryLeft}\n`, error)
      await sleep(delayMs)
    }
    finally{
      retryLeft -= 1
    }
  }
}

export async function parseOutFile(data) {
  let file = HTMLParse.parse(data.file);
  if (file.querySelector(".link") == null) return; //invalid don't need it
  let path = file.querySelector(".link").firstChild.getAttribute("href");
  if (path == "../") return;
  let name = innertext(file.querySelector(".link").innerHTML).trim();
  if (name == "Parent directory/") return;
  let fullName = data.base + name;
  let size = innertext(file.querySelector(".size").innerHTML).trim();
  let cats = findCategory(fullName, data.catList)
  let category = `${cats.cat} ${cats.subCat}`.trim()
  let processedFile = {
    filename: name,
    name: fullName,
    path: data.url + path,
    size: size,
    category: category,
    subcategories: `${cats.subCat.replaceAll(' ', '')}`,
    type: findType(fullName, data.catList),
    date: innertext(file.querySelector(".date").innerHTML).trim(),
    region: findRegion(fullName, data.catList),
    group: findGroup(fullName),
    nongame: checkNonGame(name)
  };
  return processedFile;
}

function findCategory(str, catList) {
  let lowerStr = str.toLowerCase();
  let foundCat = "";
  let catLength = 0;
  let foundSubCat = "";
  let subCatLength = 0;
  for (let cat in catList.Categories) {
    if (lowerStr.includes(cat.toLowerCase())) {
      if (cat.length > catLength) {
        foundCat = cat;
        catLength = cat.length;
      }
    }
  }
  if (foundCat) {
    for (let subCat in catList.Categories[foundCat]) {
      let subCatString = catList.Categories[foundCat][subCat]; //I will go insane if this is inlined repeatedly
      if (lowerStr.includes(subCatString.toLowerCase())) {
        if (subCatString.length > subCatLength) {
          foundSubCat = subCatString;
          subCatLength = subCatString.length;
        }
      }
    }
  } else {
    for (let cat in catList.Categories["Others"]) {
      let catString = catList.Categories["Others"][cat];
      if (lowerStr.includes(catString.toLowerCase())) {
        if (catString.length > catLength) {
          foundCat = catString;
          catLength = catString.length;
        }
      }
    }
    if (!foundCat) {
      foundCat = "Others";
    }
  }
  //special fix ups
  for(let cat in catList.Special){
    let specialString = catList.Special[cat]
    if(foundCat == cat){
      foundCat = specialString
    }
    if(foundSubCat == cat){
      foundSubCat = specialString
    }
    if(foundCat == "Others"){
      if(lowerStr.includes(cat.toLowerCase())){
        foundCat == specialString
      }
    }
  }
  if (foundSubCat.includes(foundCat)) {
    foundCat = "";
  }

  return {
    cat: foundCat,
    subCat: foundSubCat
  }
}

function findType(str, catList) {
  let lowerStr = str.toLowerCase();
  let foundTypes = "";
  for (let type in catList.Types) {
    let typeString = catList.Types[type]; //including here
    if (lowerStr.includes(typeString.toLowerCase())) {
      foundTypes += `${typeString} `;
    }
  }
  return foundTypes.trim();
}

function findRegion(str, catList) {
  let lowerStr = str.toLowerCase();
  let foundRegions = "";
  for (let region in catList.Regions) {
    let regionString = catList.Regions[region]; //including here
    if (
      lowerStr.includes("(" + regionString.toLowerCase()) ||
      lowerStr.includes(regionString.toLowerCase() + ")")
    ) {
      if (foundRegions) {
        foundRegions += `, ${regionString}`;
      } else {
        foundRegions += `${regionString}`;
      }
    }
  }
  if (!foundRegions) {
    return "None";
  }
  return foundRegions.trim();
}

function findGroup(str){
  if(str.includes('/')){
    return str.split('/')[0]
  }
  else{
    return ''
  }
}

// Cache for nonGameTerms
let nonGameTermsCache = null;

function getNonGameTerms() {
  if (nonGameTermsCache) {
    return nonGameTermsCache;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const nonGameTermsPath = resolve(__dirname, '../../json/terms/nonGameTerms.json');
  nonGameTermsCache = JSON.parse(readFileSync(nonGameTermsPath, 'utf8'));

  return nonGameTermsCache;
}

function checkNonGame(str){
  const nonGameTerms = getNonGameTerms();
  const termPatterns = nonGameTerms.terms.map(term => new RegExp(term, 'i'));
  return termPatterns.some(pattern => pattern.test(str));
}

class HTTPResponseError extends Error {
  constructor(response) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`);
    this.response = response;
  }
}

const checkStatus = (response) => {
  if (response.ok) {
    // response.status >= 200 && response.status < 300
    return response;
  } else {
    throw new HTTPResponseError(response);
  }
};

function sleep(delay){
  return new Promise((resolve) => setTimeout(resolve, delay));
}