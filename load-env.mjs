import { config } from "dotenv";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

config({
  path: join(rootDir, ".env"),
  quiet: true,
});

const entryFile = process.argv[1] ? resolve(process.argv[1]) : "";
const projectName = entryFile ? relative(rootDir, entryFile).split(/[\\/]/)[0] : "";

const projectProfiles = {
  "memory-test": {
    CHAT_API_KEY: "MEMORY_CHAT_API_KEY",
    CHAT_BASE_URL: "MEMORY_CHAT_BASE_URL",
    CHAT_MODEL_NAME: "MEMORY_CHAT_MODEL_NAME",
    OPENAI_API_KEY: "MEMORY_CHAT_API_KEY",
    OPENAI_BASE_URL: "MEMORY_CHAT_BASE_URL",
    OPENAI_MODEL_NAME: "MEMORY_CHAT_MODEL_NAME",
    MODEL_NAME: "MEMORY_CHAT_MODEL_NAME",
    EMBEDDINGS_API_KEY: "MEMORY_EMBEDDINGS_API_KEY",
    EMBEDDINGS_BASE_URL: "MEMORY_EMBEDDINGS_BASE_URL",
    EMBEDDINGS_MODEL_NAME: "MEMORY_EMBEDDINGS_MODEL_NAME",
  },
  "milvus-test": {
    CHAT_API_KEY: "MILVUS_CHAT_API_KEY",
    CHAT_BASE_URL: "MILVUS_CHAT_BASE_URL",
    CHAT_MODEL_NAME: "MILVUS_CHAT_MODEL_NAME",
    EMBEDDINGS_API_KEY: "MILVUS_EMBEDDINGS_API_KEY",
    EMBEDDINGS_BASE_URL: "MILVUS_EMBEDDINGS_BASE_URL",
    EMBEDDINGS_MODEL_NAME: "MILVUS_EMBEDDINGS_MODEL_NAME",
  },
  "output-parser-test": {
    CHAT_API_KEY: "OUTPUT_PARSER_CHAT_API_KEY",
    CHAT_BASE_URL: "OUTPUT_PARSER_CHAT_BASE_URL",
    CHAT_MODEL_NAME: "OUTPUT_PARSER_CHAT_MODEL_NAME",
    EMBEDDINGS_API_KEY: "OUTPUT_PARSER_EMBEDDINGS_API_KEY",
    EMBEDDINGS_BASE_URL: "OUTPUT_PARSER_EMBEDDINGS_BASE_URL",
    EMBEDDINGS_MODEL_NAME: "OUTPUT_PARSER_EMBEDDINGS_MODEL_NAME",
  },
  "rag-test": {
    CHAT_API_KEY: "RAG_CHAT_API_KEY",
    CHAT_BASE_URL: "RAG_CHAT_BASE_URL",
    CHAT_MODEL_NAME: "RAG_CHAT_MODEL_NAME",
    OPENAI_API_KEY: "RAG_CHAT_API_KEY",
    OPENAI_BASE_URL: "RAG_CHAT_BASE_URL",
    OPENAI_MODEL_NAME: "RAG_CHAT_MODEL_NAME",
    MODEL_NAME: "RAG_CHAT_MODEL_NAME",
    EMBEDDINGS_API_KEY: "RAG_EMBEDDINGS_API_KEY",
    EMBEDDINGS_BASE_URL: "RAG_EMBEDDINGS_BASE_URL",
    EMBEDDINGS_MODEL_NAME: "RAG_EMBEDDINGS_MODEL_NAME",
  },
  tool: {
    API_KEY: "TOOL_OPENAI_API_KEY",
    BASE_URL: "TOOL_OPENAI_BASE_URL",
    MODEL_NAME: "TOOL_OPENAI_MODEL_NAME",
    OPENAI_API_KEY: "TOOL_OPENAI_API_KEY",
    OPENAI_BASE_URL: "TOOL_OPENAI_BASE_URL",
    OPENAI_MODEL_NAME: "TOOL_OPENAI_MODEL_NAME",
  },
};

for (const [targetName, sourceName] of Object.entries(projectProfiles[projectName] ?? {})) {
  if (process.env[sourceName]) {
    process.env[targetName] = process.env[sourceName];
  }
}
