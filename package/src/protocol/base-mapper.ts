import { BaseViewModel } from './base-view-model';

export type MapperType = new () => BaseMapper;

export abstract class BaseMapper {
  private readonly _filepath: string;

  constructor(path: string) {
    this._filepath = path;
  }

  public get filepath(): string {
    return this._filepath;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onLoad(data: any): Promise<BaseViewModel | BaseViewModel[]> {
    throw new Error('The onLoad() method is not implemented yet.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onReorganisation(data: any): Promise<BaseViewModel | BaseViewModel[]> {
    throw new Error('The onReorganisation() method is not implemented yet.');
  }
}
