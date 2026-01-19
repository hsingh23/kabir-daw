declare module '*.css';
declare module '*.png';
declare module '*.svg';
declare module '*.jpeg';
declare module '*.jpg';

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
