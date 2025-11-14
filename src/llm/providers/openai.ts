import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Config } from '../../config/index.js';
import { createCallbackManager } from '../../monitoring/callbacks.js';
import { logger } from '../../logger.js';

export function createOpenAILLM(config: Config): BaseChatModel {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key is required for OpenAI provider');
  }

  const llm = new ChatOpenAI({
    openAIApiKey: config.openaiApiKey,
    modelName: config.llmModel,
    temperature: 0.7,
    callbacks: createCallbackManager(),
  });

  logger.debug({ provider: 'openai', model: config.llmModel }, 'OpenAI LLM instance created');
  return llm;
}
