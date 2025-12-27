export class AmperModule {
  constructor(
    public readonly name: string,
    public readonly path: string,
    public readonly type: string // e.g., 'jvm/app', 'lib', etc.
  ) {}
}
