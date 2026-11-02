// Plan morning-digest § 1. The shape every part of § 2 builds against.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One job across one night. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null when runs/<night>.jsonl does not exist. Rows sorted by job.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
