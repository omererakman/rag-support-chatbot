import { ChromaClient } from 'chromadb';
import { getConfig } from '../config/index.js';
import { logger } from '../logger.js';

export async function checkChromaHealth(): Promise<boolean> {
  const config = getConfig();

  if (config.vectorStoreType !== 'chromadb') {
    return true;
  }

  try {
    const client = new ChromaClient({
      host: config.chromaHost,
      port: config.chromaPort,
      ssl: config.chromaSsl,
      ...(config.chromaApiKey && {
        auth: {
          provider: 'token',
          credentials: config.chromaApiKey,
        },
      }),
    });

    await client.heartbeat();
    return true;
  } catch (error) {
    logger.debug({ error }, 'ChromaDB health check failed');
    return false;
  }
}
