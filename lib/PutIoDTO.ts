export class PutIoDTO {
  public error = '';
  public items = new Array<any>();

  public constructor(items?: Array<any>, error?: string) {
    if (items) this.items = items;
    if (error) this.error = error;
  }

  public hasError(): boolean {
    return this.error !== undefined && this.error !== '';
  }
}