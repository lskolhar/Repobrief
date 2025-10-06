// Type definitions for environment variables
// Helps TypeScript know GITHUB_TOKEN will always be a string

declare namespace NodeJS {
  interface ProcessEnv {
    GITHUB_TOKEN: string;
  }
}

// Allow detection of ESM main module in Bun

declare global {
  interface ImportMeta {
    readonly main: boolean;
  }
}

export {};
