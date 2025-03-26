import { field } from '@lastolivegames/becsy';

export class Name {
  @field.dynamicString(1000) declare value: string;

  constructor(value?: string) {
    this.value = value || '';
  }
}
