import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { AmperProject } from '../../domain/models/AmperProject';
import { AmperTask, AmperTaskType } from '../../domain/models/AmperTask';

export class TaskService {
  constructor(private projectRepo: IProjectRepository) {}

  async getTasksForWorkspace(workspaceRoot: string): Promise<{ project: AmperProject, tasks: { moduleName: string, task: AmperTask }[] } | null> {
    const project = await this.projectRepo.findProject(workspaceRoot);
    if (!project) return null;

    const tasks: { moduleName: string, task: AmperTask }[] = [];
    for (const module of project.modules) {
      tasks.push({ moduleName: module.name, task: new AmperTask(AmperTaskType.Build) });
      
      // Only add Run if it's an app (simplified check)
      if (module.type.includes('app')) {
        tasks.push({ moduleName: module.name, task: new AmperTask(AmperTaskType.Run) });
      }
      
      tasks.push({ moduleName: module.name, task: new AmperTask(AmperTaskType.Test) });
    }

    return { project, tasks };
  }
}
