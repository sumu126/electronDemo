export interface Module {
  name: string;
  version?: string;
  description?: string;
  init(): Promise<void>;
  destroy?(): Promise<void>;
}
