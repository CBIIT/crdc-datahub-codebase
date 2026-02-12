let processEnv = {};
try {
  processEnv = import.meta.env ?? {};
} catch (e) {
  processEnv = {};
}

const { injectedEnv } = window ?? {};

const env: AppEnv = {
  ...injectedEnv,
  ...processEnv,
};

export default env;
