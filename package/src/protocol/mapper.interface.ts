import { BaseViewModel } from './base-view-model';

export type MapperType = new () => ILoaderMapper;

export interface ILoaderMapper {
  onLoad(data: any): Promise<BaseViewModel | BaseViewModel[]>;
  onReorganisation(data: any): Promise<BaseViewModel | BaseViewModel[]>;
}
