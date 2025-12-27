export enum AmperTaskType {
  Build = 'Build',
  Run = 'Run',
  Test = 'Test',
  Clean = 'Clean',
}

export class AmperTask {
  constructor(public readonly type: AmperTaskType, public readonly name?: string) {}
}
