import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(
 {ignores:['node_modules/**','.runtime/**','vendor/**','dist/**','.data/**','.venv/**','graphify-out/**','.jev/**']},
 js.configs.recommended,...ts.configs.recommended,
 {files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},
 {files:['apps/**/*.tsx'],plugins:{'react-hooks':hooks},rules:hooks.configs.recommended.rules},
 {files:['apps/desktop/**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'},languageOptions:{globals:{require:'readonly',module:'readonly',process:'readonly',fetch:'readonly',setTimeout:'readonly',clearTimeout:'readonly',URL:'readonly',AbortSignal:'readonly'}}},
 {files:['eslint.config.js'],languageOptions:{globals:{process:'readonly'}}}
);
