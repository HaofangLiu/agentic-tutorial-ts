import "../load-env.mjs";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";

const model = new ChatOpenAI({
  modelName: process.env.DMX_CHAT_MODEL,
  apiKey: process.env.DMX_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.DMX_BASE_URL,
  },
});

// 定义输出结构 schema
const schema = z.object({
  translation: z.string().describe("翻译后的英文文本"),
  keywords: z.array(z.string()).length(3).describe("3个关键词"),
});

const outputParser = StructuredOutputParser.fromZodSchema(schema);

const promptTemplate = PromptTemplate.fromTemplate(
  "将以下文本翻译成英文，然后总结为3个关键词。\n\n文本：{text}\n\n{format_instructions}",
);
//第一种写法
// const chain = RunnableSequence.from([promptTemplate, model, outputParser]);
// 第二种写法（更推荐，链式调用更简洁）
const chain = promptTemplate.pipe(model).pipe(outputParser);
const input = {
  text: "LangChain 是一个强大的 AI 应用开发框架",
  format_instructions: outputParser.getFormatInstructions(),
};

const result = await chain.invoke(input);

console.log("✅ 最终结果:");
console.log(result);
