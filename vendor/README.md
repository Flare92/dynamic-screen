# Librerie incluse

- `three.module.min.js` — three.js 0.170.0 (MIT)
- `anthropic-sdk.js` — `@anthropic-ai/sdk` 1.6.0 (MIT), impacchettato per il browser con esbuild:

```bash
npm i @anthropic-ai/sdk@1.6.0 esbuild
printf "export { default as Anthropic } from '@anthropic-ai/sdk';\nexport { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema';\n" > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify --legal-comments=eof --outfile=vendor/anthropic-sdk.js
```
