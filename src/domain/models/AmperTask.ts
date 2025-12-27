export enum AmperTaskType {
  Build = 'Build',
  Run = 'Run',
  Test = 'Test',
  Clean = 'Clean',
  ShowTasks = 'Show Tasks',
}

export class AmperTask {
  constructor(public readonly type: AmperTaskType, public readonly name?: string) {}
}
