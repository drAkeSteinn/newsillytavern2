/**
 * LanceDB Vector Database Wrapper
 * 
 * Handles vector storage, similarity search, and namespace management.
 * Uses dynamic module loading for cross-platform compatibility.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { Embedding, SearchResult, RecordNamespace, EmbeddingStats } from './types';

// ============ Platform Detection ============

export type Platform = 'win32' | 'linux' | 'darwin' | 'unknown';

export function getPlatform(): Platform {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform as Platform;
  }
  return 'unknown';
}

export function isWindows(): boolean { return getPlatform() === 'win32'; }
export function isLinux(): boolean { return getPlatform() === 'linux'; }
export function isMacOS(): boolean { return getPlatform() === 'darwin'; }

// ============ Path Utilities ============

const EMBEDDINGS_TABLE = 'embeddings';
const NAMESPACES_TABLE = 'namespaces';

export function getDefaultLanceDBPath(): string {
  const cwd = process.cwd();
  if (isWindows()) {
    return path.resolve(cwd, 'data', 'lancedb');
  }
  return path.join(cwd, 'data', 'lancedb');
}

export function normalizePath(uri: string): string {
  if (uri.startsWith('mem://') || uri.startsWith('lancedb://')) return uri;
  let normalized = path.normalize(uri);
  if (isWindows()) normalized = normalized.replace(/\//g, '\\');
  return normalized;
}

export function checkDirectoryPermissions(dirPath: string): {
  exists: boolean; writable: boolean; error?: string;
} {
  try {
    const normalizedPath = normalizePath(dirPath);
    const parentDir = path.dirname(normalizedPath);

    if (!fs.existsSync(parentDir)) {
      return { exists: false, writable: false, error: 'Parent directory does not exist' };
    }

    if (fs.existsSync(normalizedPath)) {
      try {
        fs.accessSync(normalizedPath, fs.constants.W_OK);
        return { exists: true, writable: true };
      } catch {
        return { exists: true, writable: false, error: 'No write permission' };
      }
    }

    try {
      fs.accessSync(parentDir, fs.constants.W_OK);
      return { exists: false, writable: true };
    } catch {
      return { exists: false, writable: false, error: 'No write permission on parent directory' };
    }
  } catch (error: any) {
    return { exists: false, writable: false, error: error.message };
  }
}

export function ensureLanceDBDirectory(uri: string): { success: boolean; path: string; error?: string } {
  try {
    if (uri.startsWith('mem://') || uri.startsWith('lancedb://')) {
      return { success: true, path: uri };
    }
    const normalizedPath = normalizePath(uri);
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true });
    }
    return { success: true, path: normalizedPath };
  } catch (error: any) {
    return { success: false, path: uri, error: error.message };
  }
}

// ============ Global State ============

let lancedbModule: any = null;
let lancedbLoadError: string | null = null;
let isModuleLoadAttempted = false;

let db: any = null;
let embeddingsTable: any = null;
let namespacesTable: any = null;
let isInitialized = false;
let currentUri: string | null = null;

// ============ Error Types ============

export class LanceDBError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform?: Platform,
    public details?: any
  ) {
    super(message);
    this.name = 'LanceDBError';
  }

  getSuggestion(): string {
    switch (this.code) {
      case 'PERMISSION_DENIED':
        return isWindows()
          ? 'Run as administrator or change the database path.'
          : 'Check directory permissions with chmod.';
      case 'NATIVE_MODULE_ERROR':
        return isWindows()
          ? 'Install Visual C++ Redistributable. Reinstall @lancedb/lancedb.'
          : 'Check native dependencies (glibc, etc.).';
      case 'MODULE_NOT_AVAILABLE':
        return 'LanceDB is not available on this system. Check platform compatibility.';
      case 'TABLE_NOT_FOUND':
        return 'Table does not exist. It will be created on first operation.';
      default:
        return 'Check the documentation or logs for more details.';
    }
  }
}

// ============ Dynamic Module Loading ============

async function loadLanceDBModule(): Promise<{ success: boolean; error?: string }> {
  if (isModuleLoadAttempted) {
    return { success: lancedbModule !== null, error: lancedbLoadError || undefined };
  }
  isModuleLoadAttempted = true;

  try {
    lancedbModule = await import('@lancedb/lancedb');
    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    lancedbLoadError = errorMsg;
    return { success: false, error: errorMsg };
  }
}

export async function isLanceDBAvailable(): Promise<{ available: boolean; error?: string }> {
  const result = await loadLanceDBModule();
  return { available: result.success, error: result.error };
}

// ============ Helpers ============

function parseMetadata(metadata: any): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  return metadata;
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(val => val / magnitude);
}

function l2ToCosineSimilarity(l2Distance: number): number {
  return 1 - (l2Distance * l2Distance) / 2;
}

async function tableToArray(table: any): Promise<any[]> {
  return await table.query().toArray();
}

async function tableFilter(table: any, filter: string): Promise<any[]> {
  return await table.query().where(filter).toArray();
}

// ============ Initialization ============

// Track the dimension that the embeddings table was created with
let tableDimension: number | null = null;

async function initializeTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Get vector dimension from config
  let vectorDimension = 1024;
  let embeddingModel = 'bge-m3:567m';
  try {
    const { getConfig } = await import('./config-persistence');
    const config = getConfig();
    vectorDimension = config.dimension || 1024;
    embeddingModel = config.model || 'bge-m3:567m';
  } catch {
    // Use defaults
  }

  const defaultEmbedding = {
    id: 'placeholder',
    content: 'placeholder',
    vector: new Array(vectorDimension).fill(0),
    metadata: '{}',
    namespace: 'default',
    source_type: 'system',
    source_id: 'init',
    model_name: embeddingModel,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const defaultNamespace = {
    id: 'placeholder',
    namespace: 'default',
    description: 'Default namespace',
    metadata: '{}',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Try to open existing embeddings table
  try {
    embeddingsTable = await db.openTable(EMBEDDINGS_TABLE);

    // Check if dimension matches by reading the first row's vector
    // If the table was created with a different dimension, we must recreate it
    const existingRows = await embeddingsTable.query().limit(1).toArray();
    if (existingRows.length > 0 && existingRows[0].vector) {
      const existingDim = existingRows[0].vector.length;
      tableDimension = existingDim;

      if (existingDim !== vectorDimension) {
        console.warn(
          `[LanceDB] Dimension mismatch detected! Table has ${existingDim}D vectors, but config requires ${vectorDimension}D. ` +
          `Dropping and recreating embeddings table. All existing embeddings will be lost.`
        );

        // Drop the old table
        try { await db.dropTable(EMBEDDINGS_TABLE); } catch { /* ignore */ }

        // Also drop any namespace-specific tables that might have wrong dimensions
        try {
          const tables = await db.tableNames();
          for (const tableName of tables) {
            if (tableName !== EMBEDDINGS_TABLE && tableName !== NAMESPACES_TABLE) {
              try { await db.dropTable(tableName); } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }

        // Recreate with new dimension
        await db.createTable(EMBEDDINGS_TABLE, [defaultEmbedding]);
        embeddingsTable = await db.openTable(EMBEDDINGS_TABLE);
        await embeddingsTable.delete("id = 'placeholder'");
        tableDimension = vectorDimension;
      }
    } else if (existingRows.length === 0) {
      // Table exists but is empty — recreate with new dimension to be safe
      try { await db.dropTable(EMBEDDINGS_TABLE); } catch { /* ignore */ }
      await db.createTable(EMBEDDINGS_TABLE, [defaultEmbedding]);
      embeddingsTable = await db.openTable(EMBEDDINGS_TABLE);
      await embeddingsTable.delete("id = 'placeholder'");
      tableDimension = vectorDimension;
    }
  } catch {
    // Table doesn't exist yet, create it
    await db.createTable(EMBEDDINGS_TABLE, [defaultEmbedding]);
    embeddingsTable = await db.openTable(EMBEDDINGS_TABLE);
    await embeddingsTable.delete("id = 'placeholder'");
    tableDimension = vectorDimension;
  }

  // Namespaces table (no vectors, no dimension concern)
  try {
    namespacesTable = await db.openTable(NAMESPACES_TABLE);
  } catch {
    await db.createTable(NAMESPACES_TABLE, [defaultNamespace]);
    namespacesTable = await db.openTable(NAMESPACES_TABLE);
    await namespacesTable.delete("id = 'placeholder'");
  }
}

export function getTableDimension(): number | null {
  return tableDimension;
}

export async function initLanceDB(uri?: string, forceReinit: boolean = false): Promise<void> {
  const dbUri = uri || process.env.LANCEDB_URI || getDefaultLanceDBPath();

  if (isInitialized && db && currentUri === dbUri && !forceReinit) return;

  if (db) await closeLanceDB();

  const { success, error } = await loadLanceDBModule();
  if (!success) {
    throw new LanceDBError(
      `LanceDB not available: ${error}`,
      'MODULE_NOT_AVAILABLE',
      getPlatform(),
      { uri: dbUri, originalError: error }
    );
  }

  isInitialized = true;
  currentUri = dbUri;

  try {
    const dirResult = ensureLanceDBDirectory(dbUri);
    if (!dirResult.success) {
      throw new LanceDBError(
        `Cannot create/verify directory: ${dirResult.error}`,
        'DIRECTORY_ERROR',
        getPlatform(),
        { uri: dbUri }
      );
    }

    db = await lancedbModule.connect(dirResult.path);
    await initializeTables();
  } catch (error: any) {
    if (error instanceof LanceDBError) throw error;

    isInitialized = false;
    db = null;
    currentUri = null;

    const msg = error.message || String(error);
    const lowerMsg = msg.toLowerCase();

    let code = 'UNKNOWN_ERROR';
    if (lowerMsg.includes('permission') || lowerMsg.includes('access denied')) code = 'PERMISSION_DENIED';
    else if (lowerMsg.includes('native') || lowerMsg.includes('binding')) code = 'NATIVE_MODULE_ERROR';

    throw new LanceDBError(msg, code, getPlatform(), { uri: dbUri, originalError: error });
  }
}

// ============ Table Getters ============

async function getEmbeddingsTable(): Promise<any> {
  if (!db || !isInitialized) await initLanceDB();
  if (!embeddingsTable) throw new LanceDBError('Embeddings table not initialized', 'TABLE_NOT_FOUND');
  return embeddingsTable;
}

async function getNamespacesTable(): Promise<any> {
  if (!db || !isInitialized) await initLanceDB();
  if (!namespacesTable) throw new LanceDBError('Namespaces table not initialized', 'TABLE_NOT_FOUND');
  return namespacesTable;
}

export function closeLanceDB(): Promise<void> {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
  }
  db = null;
  embeddingsTable = null;
  namespacesTable = null;
  isInitialized = false;
  currentUri = null;
  tableDimension = null;
  return Promise.resolve();
}

// ============ LanceDBWrapper (static methods) ============

export class LanceDBWrapper {
  static async checkConnection(): Promise<boolean> {
    try {
      if (!db) await initLanceDB();
      return db !== null;
    } catch {
      return false;
    }
  }

  static getSystemInfo() {
    return {
      platform: getPlatform(),
      isWindows: isWindows(),
      isLinux: isLinux(),
      isMacOS: isMacOS(),
      currentUri,
      isInitialized: isInitialized && db !== null,
    };
  }

  static async close(): Promise<void> {
    return closeLanceDB();
  }

  static async insertEmbedding(params: {
    content: string;
    vector: number[];
    metadata?: Record<string, any>;
    namespace?: string;
    source_type?: string;
    source_id?: string;
    model_name?: string;
  }): Promise<string> {
    const { v4: uuidv4 } = await import('uuid');
    const {
      content, vector, metadata = {},
      namespace = 'default', source_type, source_id,
    } = params;

    let model_name = params.model_name;
    if (!model_name) {
      try {
        const { getConfig } = await import('./config-persistence');
        model_name = getConfig().model;
      } catch { model_name = 'unknown'; }
    }

    const table = await getEmbeddingsTable();
    const normalizedVector = normalizeVector(vector);

    const embedding = {
      id: uuidv4(),
      content,
      vector: normalizedVector,
      metadata: JSON.stringify({ ...metadata, created_at: new Date().toISOString(), source_type, source_id }),
      namespace,
      source_type,
      source_id,
      model_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await table.add([embedding]);
    return embedding.id;
  }

  static async searchSimilar(params: {
    queryVector: number[];
    namespace?: string;
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]> {
    const {
      queryVector,
      namespace,
      limit = 10,
      threshold = 0.3,
    } = params;

    const table = await getEmbeddingsTable();
    const normalizedQueryVector = normalizeVector(queryVector);

    let results: any[];

    // All embeddings are stored in the main table with a 'namespace' column.
    // Always search the main table and filter by namespace in-memory.
    const allResults = await table
      .vectorSearch(normalizedQueryVector)
      .limit(limit * 10)
      .toArray();

    results = allResults
      .map((row: any) => ({
        ...row,
        similarity: l2ToCosineSimilarity(row._distance || 0),
      }))
      .filter((r: any) => {
        if (!namespace || namespace === 'all') return r.similarity >= threshold;
        return (r.namespace || 'default') === namespace && r.similarity >= threshold;
      })
      .slice(0, limit);

    return results.map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: parseMetadata(row.metadata),
      namespace: row.namespace || 'default',
      source_type: row.source_type,
      source_id: row.source_id,
      similarity: row.similarity,
    }));
  }

  static async getEmbeddingById(id: string): Promise<Embedding | null> {
    const table = await getEmbeddingsTable();
    const results = await tableFilter(table, `id = '${id}'`);
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id,
      content: row.content,
      metadata: parseMetadata(row.metadata),
      namespace: row.namespace || 'default',
      source_type: row.source_type,
      source_id: row.source_id,
      model_name: row.model_name,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  static async deleteEmbedding(id: string): Promise<boolean> {
    const table = await getEmbeddingsTable();
    await table.delete(`id = '${id}'`);
    return true;
  }

  static async deleteBySource(source_type: string, source_id: string): Promise<number> {
    const table = await getEmbeddingsTable();
    await table.delete(`source_type = '${source_type}' AND source_id = '${source_id}'`);
    return 1;
  }

  static async upsertNamespace(params: {
    namespace: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<RecordNamespace> {
    const { v4: uuidv4 } = await import('uuid');
    const { namespace, description, metadata = {} } = params;
    const table = await getNamespacesTable();
    const existing = await tableFilter(table, `namespace = '${namespace}'`);

    const nsRecord = {
      id: uuidv4(),
      namespace,
      description,
      metadata: JSON.stringify(metadata),
      created_at: existing.length > 0 ? existing[0].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing.length > 0) {
      await table.delete(`namespace = '${namespace}'`);
    }
    await table.add([nsRecord]);

    return {
      id: nsRecord.id,
      namespace: nsRecord.namespace,
      description: nsRecord.description,
      metadata: JSON.parse(nsRecord.metadata),
      created_at: new Date(nsRecord.created_at),
      updated_at: new Date(nsRecord.updated_at),
    };
  }

  static async getAllNamespaces(): Promise<RecordNamespace[]> {
    const table = await getNamespacesTable();
    const results = await tableToArray(table);
    return results.map((row: any) => ({
      id: row.id,
      namespace: row.namespace,
      description: row.description,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  static async deleteNamespace(namespace: string): Promise<boolean> {
    const table = await getNamespacesTable();
    await table.delete(`namespace = '${namespace}'`);
    try { await db!.dropTable(namespace); } catch { /* table may not exist */ }
    return true;
  }

  static async addEmbeddingToNamespace(namespace: string, embeddingId: string): Promise<void> {
    const table = await getEmbeddingsTable();
    const results = await tableFilter(table, `id = '${embeddingId}'`);
    if (results.length === 0) throw new Error(`Embedding ${embeddingId} not found`);

    const embedding = results[0];
    await table.delete(`id = '${embeddingId}'`);
    await table.add([{ ...embedding, namespace, updated_at: new Date().toISOString() }]);
  }

  static async getNamespaceEmbeddings(namespace: string, limit: number = 100): Promise<Embedding[]> {
    const table = await getEmbeddingsTable();
    const results = await tableFilter(table, `namespace = '${namespace}'`);
    return results.slice(0, limit).map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: parseMetadata(row.metadata),
      namespace: row.namespace || 'default',
      source_type: row.source_type,
      source_id: row.source_id,
      model_name: row.model_name,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  static async searchInNamespace(params: {
    namespace: string;
    queryVector: number[];
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]> {
    const { namespace, queryVector, limit = 10, threshold = 0.3 } = params;
    const table = await getEmbeddingsTable();
    const normalizedQueryVector = normalizeVector(queryVector);

    const results = await table
      .vectorSearch(normalizedQueryVector)
      .limit(limit * 5)
      .toArray();

    return results
      .filter((row: any) => (row.namespace || 'default') === namespace)
      .map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: parseMetadata(row.metadata),
        namespace: row.namespace || 'default',
        source_type: row.source_type,
        source_id: row.source_id,
        similarity: l2ToCosineSimilarity(row._distance || 0),
      }))
      .filter((r: any) => r.similarity >= threshold)
      .slice(0, limit);
  }

  static async getAllEmbeddings(limit: number = 100): Promise<Embedding[]> {
    const table = await getEmbeddingsTable();
    const results = await tableToArray(table);
    return results.slice(0, limit).map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: parseMetadata(row.metadata),
      namespace: row.namespace || 'default',
      source_type: row.source_type,
      source_id: row.source_id,
      model_name: row.model_name,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  static async getStats(): Promise<EmbeddingStats> {
    const table = await getEmbeddingsTable();
    const allEmbeddings = await tableToArray(table);
    const namespaces = await this.getAllNamespaces();

    const embeddingsByNamespace: Record<string, number> = {};
    const embeddingsBySourceType: Record<string, number> = {};

    allEmbeddings.forEach((row: any) => {
      const ns = row.namespace || 'default';
      embeddingsByNamespace[ns] = (embeddingsByNamespace[ns] || 0) + 1;
      if (row.source_type) {
        embeddingsBySourceType[row.source_type] = (embeddingsBySourceType[row.source_type] || 0) + 1;
      }
    });

    return {
      totalEmbeddings: allEmbeddings.length,
      totalNamespaces: namespaces.length,
      embeddingsByNamespace,
      embeddingsBySourceType,
    };
  }

  static async resetAll(): Promise<{ deletedEmbeddings: number; deletedNamespaces: number }> {
    const embTable = await getEmbeddingsTable();
    const nsTable = await getNamespacesTable();

    const allEmbeddings = await tableToArray(embTable);
    const allNamespaces = await tableToArray(nsTable);

    // Delete all embeddings one by one (LanceDB doesn't have truncate)
    for (const emb of allEmbeddings) {
      try { await embTable.delete(`id = '${emb.id}'`); } catch { /* skip */ }
    }
    for (const ns of allNamespaces) {
      try { await nsTable.delete(`namespace = '${ns.namespace}'`); } catch { /* skip */ }
    }

    return {
      deletedEmbeddings: allEmbeddings.length,
      deletedNamespaces: allNamespaces.length,
    };
  }

  /**
   * Delete multiple embeddings by their IDs in batch.
   */
  static async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const table = await getEmbeddingsTable();
    let deleted = 0;
    for (const id of ids) {
      try {
        await table.delete(`id = '${id}'`);
        deleted++;
      } catch { /* skip */ }
    }
    return deleted;
  }

  /**
   * Delete all embeddings in a specific namespace from the main embeddings table.
   * NOTE: This does NOT delete the namespace record itself.
   */
  static async deleteAllByNamespace(namespace: string): Promise<number> {
    const table = await getEmbeddingsTable();
    const embeddings = await tableFilter(table, `namespace = '${namespace}'`);
    for (const emb of embeddings) {
      try { await table.delete(`id = '${emb.id}'`); } catch { /* skip */ }
    }
    return embeddings.length;
  }

  /**
   * Count embeddings in a specific namespace without loading full content.
   * Returns the count and optionally basic metadata of each embedding.
   */
  static async countByNamespace(namespace: string): Promise<number> {
    const table = await getEmbeddingsTable();
    const results = await tableFilter(table, `namespace = '${namespace}'`);
    return results.length;
  }
}

export default LanceDBWrapper;
