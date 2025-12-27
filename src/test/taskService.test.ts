import * as assert from 'assert';
import { TaskService } from '../application/services/TaskService';
import { IProjectRepository } from '../domain/repositories/IProjectRepository';
import { AmperProject } from '../domain/models/AmperProject';
import { AmperModule } from '../domain/models/AmperModule';
import { AmperTaskType } from '../domain/models/AmperTask';

class MockProjectRepository implements IProjectRepository {
  async findProject(rootPath: string): Promise<AmperProject | null> {
    if (rootPath === '/test') {
      return new AmperProject('/test', [
        new AmperModule('app', '/test/app', 'jvm/app'),
        new AmperModule('lib', '/test/lib', 'lib')
      ]);
    }
    return null;
  }
}

suite('TaskService Test Suite', () => {
  test('should return correct tasks for app and lib modules', async () => {
    const repo = new MockProjectRepository();
    const service = new TaskService(repo);
    const result = await service.getTasksForWorkspace('/test');

    assert.ok(result);
    const appTasks = result.tasks.filter(t => t.moduleName === 'app').map(t => t.task.type);
    const libTasks = result.tasks.filter(t => t.moduleName === 'lib').map(t => t.task.type);

    assert.ok(appTasks.includes(AmperTaskType.Build));
    assert.ok(appTasks.includes(AmperTaskType.Run));
    assert.ok(appTasks.includes(AmperTaskType.Test));
    assert.ok(appTasks.includes(AmperTaskType.Clean));

    assert.ok(libTasks.includes(AmperTaskType.Build));
    assert.ok(!libTasks.includes(AmperTaskType.Run));
    assert.ok(libTasks.includes(AmperTaskType.Test));
    assert.ok(libTasks.includes(AmperTaskType.Clean));
  });
});
