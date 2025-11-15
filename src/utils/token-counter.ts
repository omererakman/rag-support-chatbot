import { encoding_for_model } from 'tiktoken';
import { logger } from '../logger.js';

function getEncodingForModel(model: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return encoding_for_model(model as any);
  } catch (error) {
    logger.debug({ model, error }, 'Unknown model');
    return encoding_for_model('gpt-4o');
  }
}

export function countTokens(text: string, model: string): number {
  const encoding = getEncodingForModel(model);
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } finally {
    encoding.free();
  }
}

export function countChatTokens(systemMessage: string, userMessage: string, model: string): number {
  const encoding = getEncodingForModel(model);
  try {
    const systemTokens = encoding.encode(systemMessage).length;
    const userTokens = encoding.encode(userMessage).length;
    // Each message in OpenAI's chat format adds overhead tokens:
    // - 4 tokens for base message object structure
    // - 2 tokens for role labels (e.g., "system", "user")
    const messageOverhead = 4 + 2;
    // Multiply by 2 because we have 2 messages (system + user)
    const totalOverhead = messageOverhead * 2;

    return systemTokens + userTokens + totalOverhead;
  } finally {
    encoding.free();
  }
}
