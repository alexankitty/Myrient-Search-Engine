import { Client } from '@elastic/elasticsearch';
import debugPrint from '../debugprint.js';
import { File } from '../models/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

const INDEX_NAME = 'myrient_files';

// Cache for nonGameTerms
let nonGameTermsCache = null;

function getNonGameTerms() {
  if (nonGameTermsCache) {
    return nonGameTermsCache;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const nonGameTermsPath = resolve(__dirname, '../../lib/nonGameTerms.json');
  nonGameTermsCache = JSON.parse(readFileSync(nonGameTermsPath, 'utf8'));

  return nonGameTermsCache;
}

export async function initElasticsearch() {
  try {
    const indexExists = await client.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          settings: {
            analysis: {
              analyzer: {
                filename_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'word_delimiter_graph']
                }
              }
            }
          },
          mappings: {
            properties: {
              filename: {
                type: 'text',
                analyzer: 'filename_analyzer'
              },
              category: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              type: {
                type: 'text',
                analyzer: 'standard'
              },
              region: {
                type: 'text',
                analyzer: 'standard'
              },
              filenamekws: {
                type: 'text',
                analyzer: 'standard'
              },
              categorykws: {
                type: 'text',
                analyzer: 'standard'
              },
              regionkws: {
                type: 'text',
                analyzer: 'standard'
              }
            }
          }
        }
      });
      console.log('Elasticsearch index created');
    }
  } catch (error) {
    console.error('Elasticsearch init error:', error);
    process.exit(1);
  }
}

export async function indexFile(file) {
  try {
    await client.index({
      index: INDEX_NAME,
      id: file.id.toString(),
      document: file
    });
    debugPrint(`Indexed file: ${file.filename}`);
  } catch (error) {
    console.error('Error indexing file:', error);
  }
}

export async function bulkIndexFiles(files) {
  const operations = files.flatMap(file => [
    { index: { _index: INDEX_NAME, _id: file.id.toString() } },
    {
      filename: file.filename,
      category: file.category,
      type: file.type,
      region: file.region,
      filenamekws: file.filenamekws,
      categorykws: file.categorykws,
      regionkws: file.regionkws
    }
  ]);

  try {
    const { errors, items } = await client.bulk({
      refresh: true,
      operations
    });

    if (errors) {
      console.error('Bulk indexing had errors');
      items.forEach(item => {
        if (item.index.error) {
          console.error(item.index.error);
        }
      });
    }

    debugPrint(`Bulk indexed ${files.length} files`);
  } catch (error) {
    console.error('Bulk indexing error:', error);
  }
}

export async function search(query, options) {
  //add kws for selected fields
  let builtFields = []
  for(let field in options.fields){
    builtFields.push(options.fields[field])
    builtFields.push(options.fields[field] + 'kws')
  }
  const searchQuery = {
    index: INDEX_NAME,
    body: {
      size: 1500,
      query: {
        bool: {
          must: buildMustClauses(query, options, builtFields),
          should: buildShouldClauses(query, options, builtFields)
        }
      },
      highlight: {
        fields: {
          filename: {},
          category: {},
          type: {},
          region: {}
        }
      }
    }
  };

  try {
    const startTime = process.hrtime();
    const response = await client.search(searchQuery);

    // Fetch full records from PostgreSQL for the search results
    const ids = response.hits.hits.map(hit => hit._id);
    const fullRecords = await File.findAll({
      where: { id: ids }
    });

    // Create a map of full records by id
    const recordMap = fullRecords.reduce((map, record) => {
      map[record.id] = record;
      return map;
    }, {});

    // Build results with full PostgreSQL records
    let results = response.hits.hits.map(hit => ({
      ...recordMap[hit._id].dataValues,
      score: hit._score,
      highlights: hit.highlight
    }));

    // Apply non-game content filtering in JavaScript if the option is enabled
    if (options.hideNonGame) {
      const nonGameTerms = getNonGameTerms();
      const termPatterns = nonGameTerms.terms.map(term => new RegExp(term, 'i'));

      // Filter results in JavaScript (much faster than complex Elasticsearch queries)
      results = results.filter(item => {
        // Check if filename contains any of the non-game terms
        return !termPatterns.some(pattern => pattern.test(item.filename));
      });
    }

    const elapsed = parseHrtimeToSeconds(process.hrtime(startTime));
    return {
      items: results,
      elapsed
    };
  } catch (error) {
    console.error('Search error:', error);
    return { items: [], elapsed: 0 };
  }
}

function buildMustClauses(query, options, builtFields) {
  const clauses = [];

  if (options.combineWith === 'AND') {
    query.split(' ').forEach(term => {
      clauses.push({
        multi_match: {
          query: term,
          fields: builtFields.map(field =>
            field === 'filename' || 'filenamekws' ? `${field}^2` : field
          ),
          fuzziness: options.fuzzy || 0,
          type: 'best_fields'
        }
      });
    });
  }

  return clauses;
}

function buildShouldClauses(query, options, builtFields) {
  const clauses = [];

  if (options.combineWith !== 'AND') {
    clauses.push({
      multi_match: {
        query,
        fields: builtFields.map(field =>
          field === 'filename' || 'filenamekws' ? `${field}^2` : field
        ),
        fuzziness: options.fuzzy || 0,
        type: 'best_fields'
      }
    });
  }

  return clauses;
}

function parseHrtimeToSeconds(hrtime) {
  return (hrtime[0] + (hrtime[1] / 1e9)).toFixed(3);
}

export async function getSuggestions(query, options) {
  try {
    const response = await client.search({
      index: INDEX_NAME,
      body: {
        query: {
          multi_match: {
            query,
            fields: ['filename^2', 'filenamekws^2', 'category', 'categorykws'],
            fuzziness: 'AUTO',
            type: 'best_fields'
          }
        },
        _source: ['filename', 'category'],
        size: 10
      }
    });

    return response.hits.hits.map(hit => ({
      suggestion: hit._source.filename
    }));
  } catch (error) {
    console.error('Suggestion error:', error);
    return [];
  }
}

export async function getSample(query, options){
  try {
    const response = await client.search({
      index: INDEX_NAME,
      body: {
        query: {
          match: {
            filename: query,
          }
        },
        _source: ['filename'],
        size: 30
      }
    });

    return response.hits.hits.map(hit => ({
      sample: hit._source.filename
    }));
  } catch (error) {
    console.error('Sample error:', error);
    return [];
  }
}