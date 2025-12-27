import { AmperProject } from '../models/AmperProject';

export interface IProjectRepository {
  /** Detect if the given rootPath is an Amper project, and return it if so. */
  findProject(rootPath: string): Promise<AmperProject | null>;
}
