import { ChatPromptTemplate } from '@langchain/core/prompts';

export const ragPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a helpful support assistant. Answer the user's question based on the following context.
    
If the context doesn't contain enough information to answer the question, say so.
Be concise and accurate.`,
  ],
  ['human', 'Context:\n{context}\n\nQuestion: {question}\n\nAnswer:'],
]);
