declare module '*.png?url' {
  const url: string;
  export default url;
}

declare module '*.vue' {
  const component: import('vue').DefineComponent;
  export default component;
}
