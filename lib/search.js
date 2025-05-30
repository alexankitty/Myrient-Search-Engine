import debugPrint from "./debugprint.js";
import {
  search as elasticSearch,
  getSuggestions as elasticSuggestions,
} from "./services/elasticsearch.js";
import { File, Metadata } from "./models/index.js";

export default class Searcher {
  constructor(fields) {
    this.fields = [...fields];
    this.indexing = false;
  }

  async findAllMatches(query, options) {
    try {
      return await elasticSearch(query, options);
    } catch (err) {
      console.error(err);
      return { items: [], elapsed: 0 };
    }
  }

  async getSuggestions(query, options) {
    try {
      return await elasticSuggestions(query, options);
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  findIndex(id) {
    return File.findByPk(id, {
      include: {
        model: Metadata,
        as: "details"
      }
    });
  }

  async getIndexSize() {
    return await File.count();
  }
}
