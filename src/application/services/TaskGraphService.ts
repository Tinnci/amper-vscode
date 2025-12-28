import { IProcessExecutor } from '../../domain/interfaces/IProcessExecutor';
import { TaskGraph, TaskNode, TaskEdge } from '../../domain/models/TaskGraph';

export class TaskGraphService {
    constructor(private executor: IProcessExecutor) { }

    async getTaskGraph(cwd: string, moduleName?: string): Promise<TaskGraph> {
        // Run "amper show tasks"
        // If moduleName is provided, we might want to filter or run specifically for that module.
        // Based on CLI analysis, 'amper show tasks' usually shows all tasks or tasks for the context.
        // For now, run in root.

        let output = '';
        try {
            output = await this.executor.exec('amper', ['show', 'tasks'], { cwd });
        } catch (e) {
            console.error('Failed to get task graph', e);
            throw e;
        }

        return this.parseTaskOutput(output, cwd);
    }

    private parseTaskOutput(output: string, rootPath: string): TaskGraph {
        const lines = output.split('\n');
        const nodes = new Map<string, TaskNode>();
        const edges: TaskEdge[] = [];

        // Regex: task <taskName> [-> <deps>]
        // Example: task :app:build -> :app:compile, :lib:jar
        const lineRegex = /^task\s+([^-\s]+)(?:\s+->\s+(.*))?$/;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            const match = trimmed.match(lineRegex);
            if (match) {
                const taskName = match[1];
                const depsStr = match[2];

                // Add main node
                if (!nodes.has(taskName)) {
                    nodes.set(taskName, {
                        id: taskName,
                        name: taskName,
                        module: this.extractModule(taskName)
                    });
                }

                if (depsStr) {
                    const deps = depsStr.split(',').map(d => d.trim());
                    for (const dep of deps) {
                        // Add dep node if not exists (though it should appear as its own task line usually)
                        if (!nodes.has(dep)) {
                            nodes.set(dep, {
                                id: dep,
                                name: dep,
                                module: this.extractModule(dep)
                            });
                        }

                        // Edge: dependency -> task (dep must run before task)
                        // Or visualization usually shows Task -> Dependency?
                        // "task A -> B" usually means A depends on B.
                        // In visualization, we usually verify direction.
                        // For a build graph, usually Arrows point to dependencies (A depends on B).
                        edges.push({ from: taskName, to: dep });
                    }
                }
            }
        }

        return {
            nodes: Array.from(nodes.values()),
            edges,
            rootPath
        };
    }

    private extractModule(taskName: string): string | undefined {
        // Assuming format :module:task or module:task
        const parts = taskName.split(':');
        if (parts.length > 1) {
            // :app:build -> module is :app or app
            // return the segment before the last part
            return parts.slice(0, -1).join(':') || 'root';
        }
        return undefined;
    }
}
