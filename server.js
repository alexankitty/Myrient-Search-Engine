import getAllFiles from "./lib/crawler/dircrawl.js";
import { optimizeDatabaseKws } from "./lib/database/dboptimize.js";
import FileHandler from "./lib/crawler/filehandler.js";
import Searcher from "./lib/search/search.js";
import cron from "node-cron";
import "dotenv/config";
import express from "express";
import http from "http";
import sanitize from "sanitize";
import debugPrint from "./lib/utility/printutils.js";
import compression from "compression";
import cookieParser from "cookie-parser";
import { generateAsciiArt } from "./lib/utility/asciiart.js";
import {
  getEmulatorConfig,
  isEmulatorCompatible,
  isNonGameContent,
} from "./lib/emulator/emulatorConfig.js";
import fetch from "node-fetch";
import { initDB, File, QueryCount, Metadata } from "./lib/database/database.js";
import { initElasticsearch } from "./lib/services/elasticsearch.js";
import i18n, { locales } from "./config/i18n.js";
import { v4 as uuidv4 } from "uuid";
import Flag from "./lib/images/flag.js";
import ConsoleIcons from "./lib/images/consoleicons.js";
import MetadataManager from "./lib/crawler/metadatamanager.js";

let categoryListPath = "./lib/json/terms/categories.json";
let nonGameTermsPath = "./lib/json/terms/nonGameTerms.json";
let emulatorsPath = "./lib/json/dynamic_content/emulators.json";
let localeNamePath = "./lib/json/maps/name_localization.json";
let categoryList = await FileHandler.parseJsonFile(categoryListPath);
let nonGameTerms = await FileHandler.parseJsonFile(nonGameTermsPath);
let emulatorsData = await FileHandler.parseJsonFile(emulatorsPath);
let localeNames = await FileHandler.parseJsonFile(localeNamePath);
let crawlTime = 0;
let queryCount = 0;
let fileCount = 0;
let metadataMatchCount = 0;
let indexPage = "pages/index";
let flags = new Flag();
let consoleIcons = new ConsoleIcons(emulatorsData);
let updatingFiles = false;
import { Op } from "sequelize";

// Initialize databases
await initDB();
await initElasticsearch();

// Get initial counts
fileCount = await File.count();
crawlTime = (await File.max("updatedAt"))?.getTime() || 0;
queryCount = (await QueryCount.findOne())?.count || 0;
metadataMatchCount = await File.count({
  where: { detailsId: { [Op.ne]: null } },
});

let searchFields = ["filename", "category", "type", "region"];

let defaultSettings = {
  boost: {},
  combineWith: "AND",
  fields: searchFields,
  fuzzy: 0,
  prefix: true,
  hideNonGame: true,
  useOldResults: false,
};

//programmatically set the default boosts while reducing overhead when adding another search field
for (let field in searchFields) {
  let fieldName = searchFields[field];
  if (searchFields[field] == "filename") {
    defaultSettings.boost[fieldName] = 2;
  } else {
    defaultSettings.boost[fieldName] = 1;
  }
}

let search = new Searcher(searchFields);
let metadataManager = new MetadataManager();

async function getFilesJob() {
  updatingFiles = true;
  console.log("Updating the file list.");
  let oldFileCount = fileCount || 0;
  fileCount = await getAllFiles(categoryList);
  if (!fileCount) {
    console.log("File update failed");
    return;
  }
  crawlTime = Date.now();
  console.log(`Finished updating file list. ${fileCount} found.`);
  if (fileCount > oldFileCount) {
    if (
      (await Metadata.count()) < (await metadataManager.getIGDBGamesCount())
    ) {
      await metadataManager.syncAllMetadata();
    }
    await metadataManager.matchAllMetadata();
    metadataMatchCount = await File.count({
      where: { detailsId: { [Op.ne]: null } },
    });
    if(process.env.DB_KEYWORD_OPTIMIZER === "1"){
      await optimizeDatabaseKws();
    }
  }
  //this is less important and needs to run last.
  if (fileCount > oldFileCount && (await Metadata.count())) {
    metadataManager.matchAllMetadata(true);
  }
  metadataMatchCount = await File.count({
    where: { detailsId: { [Op.ne]: null } },
  });
  updatingFiles = false;
}

async function updateMetadata() {
  if (updatingFiles) return;
  let updateMatches = process.env.FORCE_METADATA_RESYNC == "1" ? true : false
  if ((await Metadata.count()) < (await metadataManager.getIGDBGamesCount())) {
    await metadataManager.syncAllMetadata();
    updateMatches = true;
  }
  if(updateMatches){
    if (await Metadata.count()) {
      await metadataManager.matchAllMetadata();
    }
    metadataMatchCount = await File.count({
      where: { detailsId: { [Op.ne]: null } },
    });
  }
}

async function updateKws() {
  if (updatingFiles) return;
  if (process.env.DB_KEYWORD_OPTIMIZER !== "1") return;
  if (!(await File.count({ where: { filenamekws: { [Op.ne]: null } } })) || process.env.FORCE_DB_OPTIMIZE == "1") {
    await optimizeDatabaseKws();
  }
}

function buildOptions(page, options) {
  return { page: page, ...options, ...defaultOptions };
}

let defaultOptions = {
  crawlTime: crawlTime,
  queryCount: queryCount,
  fileCount: fileCount,
  metadataMatchCount: metadataMatchCount,
  generateAsciiArt: generateAsciiArt,
  isEmulatorCompatible: isEmulatorCompatible,
  isNonGameContent: isNonGameContent,
  nonGameTerms: nonGameTerms,
  aiEnabled: process.env.AI_ENABLED === 'true',
  aiConfig: {
    apiUrl: process.env.AI_API_URL || 'https://example.com',
    model: process.env.AI_MODEL || 'default',
  },
};

function updateDefaults() {
  defaultOptions.crawlTime = crawlTime;
  defaultOptions.queryCount = queryCount;
  defaultOptions.fileCount = fileCount;
  defaultOptions.metadataMatchCount = metadataMatchCount;
}

let app = express();
let server = http.createServer(app);

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

//static files
app.use("/public", express.static("views/public"));

//middleware
app.use(sanitize.middleware);
app.use(compression());
app.use(express.json());
app.use(cookieParser());
app.set("view engine", "ejs");

app.use((req, res, next) => {
  req.requestId = uuidv4();
  next();
});

app.use(i18n.init);

// Add language detection middleware
app.use((req, res, next) => {
  // check query parameter (dropdown)
  let lang = null;
  if (req.query.lang) {
    lang = locales.includes(req.query.lang) ? req.query.lang : null;
  }

  // check cookie
  if (!lang && req.cookies.lang) {
    // Verify the cookie language is available
    lang = locales.includes(req.cookies.lang) ? req.cookies.lang : null;
  }

  // check browser locale
  if (!lang) {
    lang = req.acceptsLanguages(locales);
  }

  // Fallback to English
  if (!lang) {
    lang = "en";
  }
  req.setLocale(lang);
  res.locals.locale = lang;

  res.locals.availableLocales = locales;

  res.cookie("lang", lang, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year

  next();
});

// Add helper function to all templates
app.locals.__ = function () {
  return i18n.__.apply(this, arguments);
};

app.get("/", function (req, res) {
  let page = "search";
  res.render(indexPage, buildOptions(page));
});

app.get("/search", async function (req, res) {
  let loadOldResults =
    req.query.old === "true" || !(await Metadata.count()) ? true : false;
  let query = req.query.q ? req.query.q : "";
  let pageNum = parseInt(req.query.p);
  let urlPrefix = encodeURI(
    `/search?s=${req.query.s}&q=${req.query.q}${
      req.query.o ? "&o=" + req.query.o : ""
    }${loadOldResults ? "&old=true" : ""}&p=`
  );
  pageNum = pageNum ? pageNum : 1;
  let settings = {};
  try {
    settings = req.query.s ? JSON.parse(atob(req.query.s)) : defaultSettings;
  } catch {
    debugPrint("Search settings corrupt, forcing default.");
    settings = defaultSettings;
  }
  for (let key in defaultSettings) {
    let failed = false;
    if (typeof settings[key] != "undefined") {
      if (typeof settings[key] != typeof defaultSettings[key]) {
        debugPrint("Search settings corrupt, forcing default.");
        failed = true;
        break;
      }
    }
    if (failed) {
      settings = defaultSettings;
    }
  }
  if (settings.combineWith != "AND") {
    delete settings.combineWith;
  }
  settings.pageSize = loadOldResults ? 100 : 10;
  settings.page = pageNum - 1;
  settings.sort = req.query.o || "";
  let results = await search.findAllMatches(query.trim(), settings);
  debugPrint(results);
  if (results.count && pageNum == 1) {
    queryCount += 1;
    await QueryCount.update({ count: queryCount }, { where: { id: 1 } });
    updateDefaults();
  }
  let options = {
    query: query,
    results: results.items,
    count: results.count,
    elapsed: results.elapsed,
    pageNum: pageNum,
    pageCount: Math.ceil(results.count / settings.pageSize),
    indexing: search.indexing,
    urlPrefix: urlPrefix,
    settings: settings,
    flags: flags,
    consoleIcons: consoleIcons,
    localeNames: localeNames,
  };
  let page = loadOldResults ? "resultsold" : "results";
  options = buildOptions(page, options);
  res.render(indexPage, options);
});

app.get("/lucky", async function (req, res) {
  let results = { items: [] };
  if (req.query.q) {
    let settings = req.query.s
      ? JSON.parse(atob(req.query.s))
      : defaultSettings;
    results = await search.findAllMatches(req.query.q, settings);
    debugPrint(results);
  }
  if (results?.items?.length) {
    res.redirect(results.items[0].path);
  } else {
    const count = await File.count();
    const randomId = Math.floor(Math.random() * count);
    const luckyFile = await File.findOne({
      offset: randomId,
    });
    debugPrint(`${randomId}: ${luckyFile?.path}`);
    res.redirect(luckyFile?.path || "/");
  }
  queryCount += 1;
  await QueryCount.update({ count: queryCount }, { where: { id: 1 } });
  updateDefaults();
});

app.get("/settings", async function (req, res) {
  let options = { defaultSettings: defaultSettings };
  let page = "settings";
  options.oldSettingsAvailable = (await Metadata.count()) ? true : false;
  options = buildOptions(page, options);
  res.render(indexPage, options);
});

app.post("/suggest", async function (req, res) {
  if (!req.body) {
    return;
  }
  if (typeof req.body.query == "undefined") {
    return;
  }
  let suggestions = await search.getSuggestions(
    req.body.query,
    defaultSettings
  );
  debugPrint(suggestions);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ suggestions }));
});

app.get("/about", function (req, res) {
  let page = "about";
  res.render(indexPage, buildOptions(page));
});

app.get("/play/:id", async function (req, res) {
  // Block access if emulator is disabled
  if (process.env.EMULATOR_ENABLED !== "true") {
    res.redirect("/");
    return;
  }

  let fileId = parseInt(req.params.id);
  let romFile = await search.findIndex(fileId);

  if (!romFile) {
    res.redirect("/");
    return;
  }

  let options = {
    romFile: romFile,
    emulatorConfig: getEmulatorConfig(romFile.category),
    isNonGame: isNonGameContent(romFile.filename, nonGameTerms),
  };

  let page = "emulator";
  options = buildOptions(page, options);
  res.render(indexPage, options);
});

app.get("/info/:id", async function (req, res) {
  //set header to allow video embed
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-non");
  let romId = parseInt(req.params.id);
  let romFile = await search.findIndex(romId);
  if (!romFile) {
    res.redirect("/");
    return;
  }
  let options = {
    file: {
      ...romFile.dataValues,
    },
    metadata: {
      ...romFile?.details?.dataValues,
    },
    flags: flags,
    consoleIcons: consoleIcons,
    localeNames: localeNames,
  };
  let page = "info";
  options = buildOptions(page, options);
  res.render(indexPage, options);
});

app.get("/proxy-rom/:id", async function (req, res, next) {
  // Block access if emulator is disabled
  if (process.env.EMULATOR_ENABLED !== "true") {
    return next(new Error("Emulator feature is disabled"));
  }

  let fileId = parseInt(req.params.id);
  let romFile = await search.findIndex(fileId);

  if (!romFile) {
    return next(new Error("ROM not found"));
  }

  try {
    const response = await fetch(romFile.path);
    const contentLength = response.headers.get("content-length");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", contentLength);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${romFile.filename}"`
    );

    // Add all required cross-origin headers
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    response.body.pipe(res);
  } catch (error) {
    console.error("Error proxying ROM:", error);
    next(error);
  }
});

app.get("/proxy-bios", async function (req, res, next) {
  // Block access if emulator is disabled
  if (process.env.EMULATOR_ENABLED !== "true") {
    return next(new Error("Emulator feature is disabled"));
  }

  const biosUrl = req.query.url;

  // Validate that URL is from GitHub
  if (!biosUrl || !biosUrl.startsWith("https://github.com")) {
    return next(new Error("Invalid BIOS URL - only GitHub URLs are allowed"));
  }

  try {
    const response = await fetch(biosUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type");

    res.setHeader("Content-Type", contentType || "application/octet-stream");
    res.setHeader("Content-Length", contentLength);

    // Add all required cross-origin headers
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    response.body.pipe(res);
  } catch (error) {
    console.error("Error proxying BIOS:", error);
    next(error);
  }
});

// Proxy route for EmulatorJS content
app.get("/emulatorjs/*", async function (req, res, next) {
  try {
    // Extract the path after /emulatorjs/
    const filePath = req.path.replace(/^\/emulatorjs\//, "");

    // Support both stable and latest paths
    const emulatorJsUrl = `https://cdn.emulatorjs.org/stable/${filePath}`;

    const response = await fetch(emulatorJsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Copy content type and length
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    // Set special headers for WASM files
    if (filePath.endsWith(".wasm")) {
      res.setHeader("Content-Type", "application/wasm");
    }

    // Special handling for JavaScript files
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    }

    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    response.body.pipe(res);
  } catch (error) {
    console.error("Error proxying EmulatorJS content:", error);
    next(error);
  }
});

app.get("/emulators", function (req, res) {
  let page = "emulators";
  let options = { emulators: emulatorsData };
  res.render(indexPage, buildOptions(page, options));
});

app.get("/api/emulators", function (req, res) {
  res.json(emulatorsData);
});

app.post("/api/ai-chat", async function (req, res) {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if AI is enabled and configured
    const aiEnabled = process.env.AI_ENABLED === 'true';
    const apiKey = process.env.AI_API_KEY;
    const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
    const model = process.env.AI_MODEL || 'gpt-3.5-turbo';

    if (!aiEnabled) {
      return res.status(503).json({
        error: 'AI chat is currently disabled. Please contact the administrator.'
      });
    }

    if (!apiKey) {
      return res.status(503).json({
        error: 'AI service is not configured. Please contact the administrator.'
      });
    }

    // Create system prompt with context about Myrient
    const systemPrompt = `You are a helpful AI assistant for the Myrient Search Engine, a website that helps users find and search through retro games and ROMs.

About Myrient:
- Myrient is a preservation project that offers a comprehensive collection of retro games
- Users can search for games by filename, category, type, and region
- The site includes an emulator feature for playing games directly in the browser
- The search engine indexes thousands of games from various gaming systems and regions

Your role:
- Help users find games they're looking for by using the search tools available to you
- Provide information about gaming history, consoles, and game recommendations
- Answer questions about how to use the search features
- Be knowledgeable about retro gaming but stay focused on being helpful
- When users ask for games, always use the search_games tool to find them
- Keep responses SHORT, CONCISE and SIMPLE - the chat interface is small
- Present search results as simple lists, NOT tables (tables don't fit in the small chat window)
- Use bullet points or numbered lists instead of tables
- Limit responses to 3-5 game recommendations maximum to keep it readable
- If users ask about downloading or legal issues, remind them that Myrient focuses on preservation

IMPORTANT SEARCH STRATEGY:
- When users describe a game, THINK about what the actual game title might be before searching
- Don't search literal descriptions - identify the likely game name first
- Use SIMPLE searches with just the game title for best results
- The search is fuzzy and will find partial matches - keep queries simple
- If first search fails or returns few results, try alternative searches with different terms
- For empty results, suggest the user try different search terms or check spelling

GAME RECOMMENDATION STRATEGY:
- When users ask for "best [console] games", don't search the console name
- Instead, search for specific popular titles for that console
- EFFICIENCY: Limit to 2-3 searches maximum for recommendations to avoid hitting rate limits
- Stop searching when you have enough games (3-5) for a good recommendation
- Focus on well-known AAA titles, not obscure indie games

Available Tools:
- search_games: Fuzzy text search for games by title/name (returns URLs for each game)
- get_search_suggestions: Get search suggestions for partial queries

CRITICAL LINKING RULES:
- NEVER make up or guess URLs - ONLY use URLs from search tool results
- When mentioning specific games found via search_games tool, ALWAYS link to them using EXACTLY the urls.info value from the search results
- Format: [Game Title](EXACT_INFO_URL_FROM_SEARCH_RESULTS)
- Do NOT create links like /info/123 - use the EXACT urls.info field from the tool response
- If you haven't searched for a game using the tool, do NOT create any links for it
- Only link to games that were actually returned by the search_games tool with their provided URLs`;

    // Import tools dynamically
    const { tools, executeToolCall } = await import('./lib/ai/tools.js');

    // Build conversation history
    let messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if provided
    if (req.body.conversation && Array.isArray(req.body.conversation)) {
      messages = messages.concat(req.body.conversation);
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    let aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Myrient-Search-Engine/1.0'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      })
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}));
      console.error('AI API Error on initial request:');
      console.error('Status:', aiResponse.status);
      console.error('Error data:', errorData);
      console.error('Request details:');
      console.error('- Model:', model);
      console.error('- Messages count:', messages.length);
      console.error('- User message:', message.substring(0, 100) + '...');

      // Handle specific error cases
      if (aiResponse.status === 401) {
        return res.status(503).json({
          error: 'AI service authentication failed. Please contact the administrator.'
        });
      } else if (aiResponse.status === 429) {
        return res.status(429).json({
          error: 'AI service is currently busy. Please try again in a moment.'
        });
      } else {
        return res.status(503).json({
          error: 'AI service is temporarily unavailable. Please try again later.'
        });
      }
    }

    let aiData = await aiResponse.json();

    if (!aiData.choices || aiData.choices.length === 0) {
      return res.status(503).json({
        error: 'AI service returned an unexpected response.'
      });
    }

    let assistantMessage = aiData.choices[0].message;
    let toolCallsCount = 0; // Track tool calls executed
    let toolsUsed = []; // Track which tools were used

    console.log('Initial AI request successful');

    // Handle multiple rounds of tool calls
    let maxToolRounds = 3; // Prevent infinite loops and token exhaustion
    let currentRound = 0;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && currentRound < maxToolRounds) {
      currentRound++;
      const roundToolCalls = assistantMessage.tool_calls.length;
      const roundToolsUsed = assistantMessage.tool_calls.map(tc => tc.function.name);

      console.log(`Round ${currentRound}: AI wants to use ${roundToolCalls} tools: ${roundToolsUsed.join(', ')}`);

      // Track total tools across all rounds
      toolCallsCount += roundToolCalls;
      toolsUsed = toolsUsed.concat(roundToolsUsed);

      // Add assistant message with tool calls to conversation
      messages.push(assistantMessage);

      // Execute each tool call in this round
      for (const toolCall of assistantMessage.tool_calls) {
        try {
          const toolResult = await executeToolCall(toolCall);

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        } catch (error) {
          console.error('Tool execution error:', error);
          // Add error result
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message })
          });
        }
      }

      // Get AI response after this round of tool execution
      console.log(`Making AI request after round ${currentRound} tool execution...`);
      aiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Myrient-Search-Engine/1.0'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          tools: tools,
          tool_choice: 'auto',
          max_tokens: 1000,
          temperature: 0.7,
          stream: false
        })
      });

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json().catch(() => ({}));
        console.error(`AI API Error after round ${currentRound} tool execution:`);
        console.error('Status:', aiResponse.status);
        console.error('Error data:', errorData);
        console.error('Request details:');
        console.error('- Model:', model);
        console.error('- Messages count:', messages.length);
        console.error('- Tools used:', toolsUsed);

        // Handle specific error cases
        if (aiResponse.status === 429) {
          // Extract wait time from error message if available
          let waitTime = 5000; // Default 5 seconds
          if (errorData.error?.message) {
            const waitMatch = errorData.error.message.match(/Please try again in ([\d.]+)s/);
            if (waitMatch) {
              waitTime = Math.ceil(parseFloat(waitMatch[1]) * 1000) + 1000; // Add 1 extra second
            }
          }

          console.error(`Rate limit hit after tool execution. Waiting ${waitTime/1000}s and retrying once...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          const retryResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'User-Agent': 'Myrient-Search-Engine/1.0'
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              tools: tools,
              tool_choice: 'auto',
              max_tokens: 1000,
              temperature: 0.7,
              stream: false
            })
          });

          if (retryResponse.ok) {
            console.log('Retry successful after rate limit');
            aiData = await retryResponse.json();
            assistantMessage = aiData.choices[0].message;
          } else {
            console.error('Retry also failed with status:', retryResponse.status);
            return res.status(429).json({
              error: 'AI service is currently busy processing your request. Please try again in a moment.'
            });
          }
        } else if (aiResponse.status === 401) {
          return res.status(503).json({
            error: 'AI service authentication failed. Please contact the administrator.'
          });
        } else {
          return res.status(503).json({
            error: 'AI service encountered an error while processing your request. Please try again later.'
          });
        }
      } else {
        console.log(`AI request after round ${currentRound} tool execution successful`);
        aiData = await aiResponse.json();
        assistantMessage = aiData.choices[0].message;

        console.log(`Round ${currentRound} response - has tool_calls:`, !!assistantMessage.tool_calls);
        console.log(`Round ${currentRound} response - has content:`, !!assistantMessage.content);
      }
    }

    if (currentRound >= maxToolRounds && assistantMessage.tool_calls) {
      console.warn('Maximum tool rounds reached, AI still wants to use tools. Stopping.');
    }

    if (currentRound === 0) {
      console.log('No tool calls needed, using initial response');
    } else {
      console.log(`Total rounds completed: ${currentRound}`);
    }

    console.log('Final tool calls check - has tool_calls:', !!assistantMessage.tool_calls);
    console.log('Final tool calls check - has content:', !!assistantMessage.content);

    console.log('Final assistant message structure:', JSON.stringify(assistantMessage, null, 2));
    console.log('Assistant message content:', assistantMessage.content);
    console.log('Assistant message content type:', typeof assistantMessage.content);
    console.log('Assistant message keys:', Object.keys(assistantMessage));

    const response = assistantMessage.content?.trim() || 'Something went wrong';
    console.log('Final response after processing:', response.substring(0, 100) + '...');
    console.log('Tools used in this request:', toolsUsed);

    // Return the response along with updated conversation
    res.json({
      response,
      conversation: messages.slice(1), // Exclude system message from returned conversation
      tool_calls_made: toolCallsCount,
      tools_used: toolsUsed
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again later.'
    });
  }
});

app.get("/proxy-image", async function (req, res, next) {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return next(new Error("No image URL provided"));
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Copy content type
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    response.body.pipe(res);
  } catch (error) {
    console.error("Error proxying image:", error);
    next(error);
  }
});

// 404 handler
app.use((req, res, next) => {
  const err = new Error("Page Not Found");
  err.status = 404;
  next(err);
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "An unexpected error occurred";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(status);

  res.render("pages/error", {
    status,
    message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : null,
    req,
    requestId: req.requestId,
  });
});

server.listen(process.env.PORT, process.env.BIND_ADDRESS);
server.on("listening", function () {
  console.log(
    "Server started on %s:%s.",
    server.address().address,
    server.address().port
  );
});
console.log(`Loaded ${fileCount} known files.`);
console.log(`${metadataMatchCount} files contain matched metadata.`);

// Run file update job if needed
if (
  process.env.FORCE_FILE_REBUILD == "1" ||
  !fileCount ||
  (crawlTime && Date.now() - crawlTime > 7 * 24 * 60 * 60 * 1000) // 1 week
) {
  await getFilesJob();
}

cron.schedule("0 30 2 * * *", getFilesJob);

//run these tasks after to add new functions
await updateMetadata();
await updateKws();
