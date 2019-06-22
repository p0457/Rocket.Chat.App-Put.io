export class PutIoDTO {
  public error = '';
  public item;

  public constructor(item?: any, error?: string) {
    if (item) this.item = item;
    if (error) this.error = error;
  }

  public hasError(): boolean {
    return this.error !== undefined && this.error !== '';
  }
}