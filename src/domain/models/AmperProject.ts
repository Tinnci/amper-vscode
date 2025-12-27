import { AmperModule } from './AmperModule';

export class AmperProject {
  constructor(
    public readonly rootPath: string,
    public readonly modules: AmperModule[] = []
  ) {}
}
