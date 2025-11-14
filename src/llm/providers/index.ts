import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Config } from '../../config/index.js';
import { createOpenAILLM } from './openai.js';
import { logger } from '../../logger.js';

export function createLLMProvider(config: Config): BaseChatModel {
  logger.debug({ provider: config.llmProvider }, 'Creating LLM provider');

  switch (config.llmProvider) {
    case 'openai':
      return createOpenAILLM(config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.llmProvider}`);
  }
}
