declare global {
  namespace NodeJS {
    type ProcessEnv = import("./schemas/env.ts").AppEnv;
  }
}
