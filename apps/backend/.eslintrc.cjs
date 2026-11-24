/**
 * @type {import("eslint").Linter.Config}
 */
const config = {
  root: true,
  extends: ["eslint:recommended", "airbnb-base", "prettier"],
  plugins: ["prettier"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "script",
  },
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".cjs", ".mjs", ".json"],
      },
    },
  },
  rules: {
    /* base prettier rule */
    "prettier/prettier": "error",

    "max-len": "off",
    "no-param-reassign": "off",
    "object-curly-newline": "off",
    "no-underscore-dangle": "off",
    "no-console": "off",
    "arrow-body-style": "warn",
    "eol-last": "warn",
    "no-unreachable": "warn",

    /* import rules */
    "import/prefer-default-export": "off",
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["**/test/**", "**/integration-tests/**", "jest.config.js"],
        optionalDependencies: false,
      },
    ],
    "import/newline-after-import": [
      "error",
      {
        count: 1,
        considerComments: true,
      },
    ],
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", ["sibling", "index"]],
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
        "newlines-between": "always",
      },
    ],
  },
};

module.exports = config;
