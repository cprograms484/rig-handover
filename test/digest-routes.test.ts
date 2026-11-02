import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const line = (job: string, owner: string | null) =>
  JSON.stringify({ at: '2026-11-01T23:00:00+01:00', job, status: 'ok', owner });

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  copyFileSync('runs/2026-10-28.jsonl', join(dir, '2026-10-28.jsonl'));
  writeFileSync(join(dir, '2026-11-01.jsonl'), '');
  writeFileSync(
    join(dir, '2026-11-02.jsonl'),
    [line('zeta/job', 'rook'), 'not json', line('alpha/job', null)].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const json = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as NightDigest };
};

describe('GET /digest/:night', () => {
  it('renders a real night with rows sorted by job, matching the JSON', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    const { body } = await json('2026-10-28');
    expect(res.status).toBe(200);
    expect(body.rows.length).toBeGreaterThan(0);
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2020-01-01')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders valid jobs when a line is bad, owner null as a dash', async () => {
    const res = await app.request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('alpha/job')).toBeGreaterThan(-1);
    expect(html.indexOf('alpha/job')).toBeLessThan(html.indexOf('zeta/job'));
    expect(html).toContain('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows sorted by job and badLines', async () => {
    const { res, body } = await json('2026-10-28');
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(typeof body.badLines).toBe('number');
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort((a, b) => a.localeCompare(b)));
  });

  it('404s with an error body for a night with no file', async () => {
    const res = await app.request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2020-01-01' });
  });

  it('returns no rows and no bad lines for an empty night', async () => {
    const { res, body } = await json('2026-11-01');
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line and keeps the valid jobs', async () => {
    const { res, body } = await json('2026-11-02');
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'zeta/job']);
  });
});
