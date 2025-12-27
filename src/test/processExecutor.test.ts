import * as assert from 'assert';
import * as path from 'path';
import { NodeProcessExecutor } from '../infrastructure/adapters/NodeProcessExecutor';

suite('NodeProcessExecutor', () => {
  test('executes echo', async () => {
    const cwd = path.resolve(__dirname, '..', '..');
    const exec = new NodeProcessExecutor();
    const out = await exec.exec('echo', ['hello'], cwd);
    assert.ok(out.toLowerCase().includes('hello'));
  });
});
