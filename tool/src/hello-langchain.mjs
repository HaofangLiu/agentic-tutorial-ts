import { ChatOpenAI } from '@langchain/openai';
import '../../load-env.mjs';

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME || "MiniMax-M2.7-free",
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
});

const response = await model.invoke("介绍下自己");
console.log(response.content);