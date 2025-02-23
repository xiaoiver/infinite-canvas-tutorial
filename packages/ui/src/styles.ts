import { css } from 'lit';

export const panelStyles = css`
  sl-input::part(input) {
    width: 100px;
  }
  sl-input::part(form-control) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  sl-input::part(form-control-label) {
    font-size: var(--sl-font-size-small);
  }

  sl-select::part(combobox) {
    width: 102px;
  }
  sl-select::part(form-control) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  sl-select::part(form-control-label) {
    font-size: var(--sl-font-size-small);
  }

  sl-radio-group::part(form-control) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  sl-radio-group::part(form-control-label) {
    font-size: var(--sl-font-size-small);
  }
`;
