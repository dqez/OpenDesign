$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param([string]$Command)
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command"
  }
}

Push-Location worker
Invoke-Checked "npm run types"
Invoke-Checked "npm test"
Invoke-Checked "npm run typecheck"
Invoke-Checked "npx wrangler d1 migrations apply opendesign-prod --local"
Pop-Location

Push-Location container
Invoke-Checked "npm test"
Invoke-Checked "npm run typecheck"
Invoke-Checked "npm run build:image"
Pop-Location

Push-Location frontend
Invoke-Checked "npm test"
Invoke-Checked "npm run build"
Pop-Location
