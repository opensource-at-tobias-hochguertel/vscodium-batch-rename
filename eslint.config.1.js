// eslint.config.js

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import { globalIgnores } from "eslint/config";
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 2022,
            sourceType: "module",

            parserOptions: {
                project: "./tsconfig.json",
            },
        },

        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/recommended",
            "plugin:@typescript-eslint/recommended-requiring-type-checking",
        ),

        rules: {
            "@typescript-eslint/explicit-function-return-type": "warn",

            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],

            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-non-null-assertion": "warn",

            "no-console": ["warn", {
                allow: ["warn", "error"],
            }],

            "eqeqeq": "error",
        },
    },
    globalIgnores(["**/out", "**/dist", "**/*.d.ts"])
);
