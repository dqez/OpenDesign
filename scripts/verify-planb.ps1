$ErrorActionPreference = "Stop"

Push-Location worker
npm run types
npm test
npm run typecheck
npx wrangler d1 migrations apply 2design-prod --local
Pop-Location

Push-Location container
npm test
npm run typecheck
npm run build:image
Pop-Location

Push-Location frontend
npm test
npm run build
Pop-Location
