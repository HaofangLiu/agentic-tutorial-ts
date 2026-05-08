import { ChatOpenAI } from '@langchain/openai';
import '../../load-env.mjs';

const model = new ChatOpenAI({
    modelName: process.env.DMX_CHAT_MODEL_QWEN || "MiniMax-M2.7-free",
    apiKey: process.env.DMX_API_KEY,
    configuration: {
        baseURL: process.env.DMX_BASE_URL,
    },
});

const response = await model.invoke("介绍下自己");
console.log(response.content);