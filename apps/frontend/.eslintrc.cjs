/**
 * @type {import("eslint").Linter.Config}
 */
const config = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
    "airbnb",
    "airbnb-typescript",
    "prettier",
    "react-app",
    "plugin:storybook/recommended",
    "plugin:compat/recommended",
    "plugin:@vitest/legacy-recommended",
    "plugin:testing-library/react",
  ],
  globals: {
    window: true,
    document: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2015,
    project: "./tsconfig.json",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "jsx-a11y", "prettier", "compat", "@vitest"],
  settings: {
    react: {
      pragma: "React",
      fragment: "Fragment",
      version: "detect",
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
    },
  },
  env: {
    browser: true,
  },
  root: true,
  rules: {
    /* base prettier rule */
    "prettier/prettier": "error",

    /* base compatibility rule */
    "compat/compat": "error",

    "max-len": "off",
    "no-param-reassign": "off",
    "object-curly-newline": "off",
    "no-underscore-dangle": "off",
    "no-console": "warn",
    "arrow-body-style": "warn",
    "eol-last": "warn",
    "no-unreachable": "warn",

    /* typescript-eslint overwritten rules */
    "no-use-before-define": "off",
    "no-unused-vars": "off",
    "no-loss-of-precision": "off",
    "no-shadow": "off",
    "no-empty-function": "off",
    "dot-notation": "off",

    /* react rules */
    "react/prop-types": "off",
    "react/jsx-filename-extension": [1, { extensions: [".js", ".jsx", ".tsx", ".ts"] }],
    "react/jsx-props-no-spreading": "off",
    "react/react-in-jsx-scope": "off",
    "react/require-default-props": "off",
    "react/jsx-max-props-per-line": [1, { maximum: 1, when: "multiline" }],
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],
    "react/jsx-key": [
      "error",
      {
        checkFragmentShorthand: true,
        checkKeyMustBeforeSpread: true,
        warnOnDuplicates: true,
      },
    ],
    "react/destructuring-assignment": ["error", "always", { destructureInSignature: "always" }],

    /* typescript-eslint rules */
    "@typescript-eslint/no-empty-function": "error",
    "@typescript-eslint/no-use-before-define": "error",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-loss-of-precision": "error",
    "@typescript-eslint/no-redundant-type-constituents": "error",
    "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
    "@typescript-eslint/no-shadow": "off",
    "@typescript-eslint/dot-notation": "error",
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: "variable",
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        leadingUnderscore: "allow",
      },
    ],
    "@typescript-eslint/ban-ts-comment": "off",

    /* create-react-app rules */
    "react-hooks/rules-of-hooks": "off",
    "react-hooks/exhaustive-deps": "off",

    /* import rules */
    "import/prefer-default-export": "off",
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: [
          "**/*.d.ts",
          "**/*.{stories,test}.{ts,tsx}",
          "**/setupTests.{ts,tsx}",
          "**/customRender.tsx",
          "vite.config.ts",
        ],
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

    /* testing-library rules */
    "testing-library/prefer-screen-queries": "off",
    "testing-library/no-wait-for-multiple-assertions": "off",
    "testing-library/no-node-access": "off",
    "testing-library/no-container": "off",
  },
};

module.exports = config;
