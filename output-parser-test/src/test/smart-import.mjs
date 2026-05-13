import "../../../load-env.mjs";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import mysql from "mysql2/promise";

const model = new ChatOpenAI({
  modelName: process.env.DMX_CHAT_MODEL,
  apiKey: process.env.DMX_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.DMX_BASE_URL,
  },
});

const friendSchema = z.object({
  name: z.string().describe("姓名"),
  gender: z.string().describe("性别（男/女）"),
  birth_date: z
    .string()
    .describe("出生日期，格式：YYYY-MM-DD，如果无法确定具体日期，根据年龄估算"),
  company: z.string().nullable().describe("公司名称，如果没有则返回 null"),
  title: z.string().nullable().describe("职位/头衔，如果没有则返回 null"),
  phone: z.string().nullable().describe("手机号，如果没有则返回 null"),
  wechat: z.string().nullable().describe("微信号，如果没有则返回 null"),
});

const friendsArraySchema = z.array(friendSchema).describe("好友信息数组");

const structuredModel = model.withStructuredOutput(friendsArraySchema);

const connectionConfig = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "admin",
  multipleStatements: true,
};

async function extractAndInsert(text) {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.query(`USE hello;`);

    const prompt = `请从以下文本中提取所有好友信息，文本中可能包含一个或多个人的信息。请将每个人的信息分别提取出来，以 JSON 数组格式返回。

${text}

要求：
1. 如果文本中包含多个人，请为每个人创建一个对象
2. 每个对象必须使用以下英文字段名（key）：
   - "name"：姓名
   - "gender"：性别（男/女）
   - "birth_date"：出生日期（格式：YYYY-MM-DD，如果无法确定具体日期，根据年龄估算）
   - "company"：公司名称（如果没有则填 null）
   - "title"：职位/头衔（如果没有则填 null）
   - "phone"：手机号（如果没有则填 null）
   - "wechat"：微信号（如果没有则填 null）
3. 如果某个字段在文本中找不到，请返回 null
4. 返回格式必须是 JSON 数组，即使只有一个人也要放在数组中
5. 注意：JSON 的 key 必须使用英文字段名，不能使用中文`;

    const results = await structuredModel.invoke(prompt);

    if (results.length === 0) {
      return { count: 0, insertIds: [] };
    }

    const values = results.map((result) => [
      result.name,
      result.gender,
      result.birth_date || null,
      result.company,
      result.title,
      result.phone,
      result.wechat,
    ]);

    const insertSql = `
      INSERT INTO friends (
        name,
        gender,
        birth_date,
        company,
        title,
        phone,
        wechat
      ) VALUES ?;
    `;

    const [insertResult] = await connection.query(insertSql, [values]);

    return {
      count: insertResult.affectedRows,
      insertIds: Array.from(
        { length: insertResult.affectedRows },
        (_, i) => insertResult.insertId + i,
      ),
    };
  } catch (err) {
    throw err;
  } finally {
    await connection.end();
  }
}

async function main() {
  const sampleText = `我最近认识了几个新朋友。第一个是张总，女的，看起来30出头，在腾讯做技术总监，手机13800138000，微信是zhangzong2024。第二个是李工，男，大概28岁，在阿里云做架构师，电话15900159000，微信号lee_arch。还有一个是陈经理，女，35岁左右，在美团做产品经理，手机号是18800188000，微信chenpm2024。`;

  try {
    const result = await extractAndInsert(sampleText);
    console.log(`处理完成！成功插入 ${result.count} 条记录`);
    console.log(`插入的ID：${result.insertIds.join(", ")}`);
  } catch (error) {
    console.error("处理失败：", error.message);
    if (error.status) console.error("HTTP状态码:", error.status);
    if (error.type) console.error("错误类型:", error.type);
    if (error.code) console.error("错误代码:", error.code);
    process.exit(1);
  }
}

main();
