import { ChatOpenAI } from "@langchain/openai";
import { terminalTool } from "../tools/terminal/terminalTool";

export const langGraphConfig = {
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
    // Add your OpenAI API key here or use environment variables
    // openAIApiKey: process.env.OPENAI_API_KEY,
  }),
  
  tools: [
    terminalTool,
    // Add more tools here as needed
  ],
  
  // LangGraph specific configurations
  graph: {
    // Graph configuration will be added here
    maxIterations: 10,
    recursionLimit: 50,
  }
};

export default langGraphConfig;