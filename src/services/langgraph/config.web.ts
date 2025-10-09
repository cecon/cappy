import { ChatOpenAI } from "@langchain/openai";

export const langGraphConfig = {
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
  }),
  tools: [] as any[],
  graph: {
    maxIterations: 10,
    recursionLimit: 50,
  },
};

export default langGraphConfig;