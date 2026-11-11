import {appendFileSync, writeFileSync} from 'fs';
import {join} from 'path';

const LOG_FILE = join(process.cwd(), '..', 'client-logs.txt');

writeFileSync(LOG_FILE, '');

type LogEntry = {
  level: string;
  timestamp: string;
  message: string;
};

export const POST = async (request: Request): Promise<Response> => {
  try {
    const {entries} = (await request.json()) as {entries: LogEntry[]};

    const lines = entries
      .map(({level, timestamp, message}) => `[${timestamp}] [${level.toUpperCase()}] ${message}\n`)
      .join('');

    appendFileSync(LOG_FILE, lines);
  } catch {}

  return new Response(null, {status: 204});
};
