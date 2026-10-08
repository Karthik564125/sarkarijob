import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, afterEach } from 'node:test';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { supabase } = await import('../config/supabase.js');
const { getUserApplications, saveApplicationDecision } = await import('../controllers/recruitment.controller.js');

type SupabaseResult = { data: unknown; error: null | { code?: string; message: string } };
type QueryCall = { table: string; operation: string; payload?: unknown; options?: unknown; filters: [string, unknown][] };

let queryCalls: QueryCall[] = [];
let queryResult: SupabaseResult = { data: null, error: null };
const originalFrom = supabase.from;

class MockQuery {
  private call: QueryCall;

  constructor(table: string) {
    this.call = { table, operation: 'select', filters: [] };
    queryCalls.push(this.call);
  }

  select(): this { return this; }

  upsert(payload: unknown, options: unknown): this {
    this.call.operation = 'upsert';
    this.call.payload = payload;
    this.call.options = options;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push([column, value]);
    return this;
  }

  order(): this { return this; }

  single(): Promise<SupabaseResult> { return Promise.resolve(queryResult); }

  then<TResult1 = SupabaseResult, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(queryResult).then(onfulfilled, onrejected);
  }
}

supabase.from = ((table: string) => new MockQuery(table)) as unknown as typeof supabase.from;

function createResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

afterEach(() => {
  queryCalls = [];
  queryResult = { data: null, error: null };
  supabase.from = originalFrom;
  supabase.from = ((table: string) => new MockQuery(table)) as unknown as typeof supabase.from;
});

describe('manual application tracking API', () => {
  it('saves applied and not_applied using the JWT user and same upsert key', async () => {
    const userId = '655875a4-878d-40ad-8be1-78e763e9eac1';
    const recruitmentId = 'd0756bbd-87fe-4257-b5e1-9ef6a836e86e';
    const statuses = ['applied', 'not_applied'] as const;

    for (const application_status of statuses) {
      queryResult = { data: { recruitment_id: recruitmentId, application_status }, error: null };
      const response = createResponse();
      await saveApplicationDecision({
        user: { userId },
        params: { recruitmentId },
        body: { application_status, user_id: 'another-user-id' },
      } as never, response as never);
      assert.equal(response.statusCode, 200);
    }

    assert.equal(queryCalls.length, 2);
    for (const call of queryCalls) {
      assert.equal(call.table, 'user_recruitment_applications');
      assert.equal(call.operation, 'upsert');
      assert.deepEqual(call.options, { onConflict: 'user_id,recruitment_id' });
      assert.equal((call.payload as { user_id: string }).user_id, userId);
      assert.equal((call.payload as { recruitment_id: string }).recruitment_id, recruitmentId);
      assert.ok(!('eligibility_status' in (call.payload as object)));
    }
    assert.deepEqual(queryCalls.map((call) => (call.payload as { application_status: string }).application_status), statuses);
  });

  it('returns only applications filtered by the authenticated user', async () => {
    const userId = '655875a4-878d-40ad-8be1-78e763e9eac1';
    const response = createResponse();
    queryResult = { data: [{ id: 'application-1', application_status: 'applied' }], error: null };

    await getUserApplications({ user: { userId }, query: { user_id: 'attacker-id' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(queryCalls[0].filters, [['user_id', userId]]);
    assert.deepEqual(response.body, { applications: queryResult.data });
  });

  it('rejects unsupported application statuses without issuing a database write', async () => {
    const response = createResponse();
    await saveApplicationDecision({
      user: { userId: '655875a4-878d-40ad-8be1-78e763e9eac1' },
      params: { recruitmentId: 'd0756bbd-87fe-4257-b5e1-9ef6a836e86e' },
      body: { application_status: 'eligible' },
    } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.equal(queryCalls.length, 0);
  });
});

describe('application tracking schema', () => {
  const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');

  it('enforces controlled statuses, per-user uniqueness, and cascade foreign keys', () => {
    assert.match(schema, /application_status TEXT NOT NULL CHECK \(application_status IN \('applied', 'not_applied'\)\)/);
    assert.match(schema, /UNIQUE \(user_id, recruitment_id\)/);
    assert.match(schema, /user_id UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    assert.match(schema, /recruitment_id UUID NOT NULL REFERENCES recruitments\(id\) ON DELETE CASCADE/);
    assert.match(schema, /ALTER TABLE user_recruitment_applications ENABLE ROW LEVEL SECURITY/);
  });
});