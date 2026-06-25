# Push code to mato-server and run argus-update (from Windows laptop)
#
# Usage:
#   .\scripts\argus-deploy-remote.ps1
#   .\scripts\argus-deploy-remote.ps1 -Server mato@10.8.0.1 -RemotePath ~/apps/argus
#
# Requires: OpenSSH client, SSH key to server, git remote OR rsync

param(
    [string]$Server = "mato-server",
    [string]$RemotePath = "~/apps/argus",
    [switch]$RsyncOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Push-Location $Root

try {
    if (-not $RsyncOnly) {
        $isGit = Test-Path ".git"
        if ($isGit) {
            Write-Host "==> git push"
            git push
        } else {
            Write-Warning "No git repo — using rsync only. Run 'git init' and add a remote for git-based deploy."
            $RsyncOnly = $true
        }
    }

    if ($RsyncOnly) {
        Write-Host "==> rsync to ${Server}:${RemotePath}"
        # Requires rsync on Windows (Git Bash / WSL) or use scp fallback
        if (Get-Command rsync -ErrorAction SilentlyContinue) {
            rsync -avz --delete `
                --exclude node_modules --exclude dist --exclude .git --exclude .env `
                ./ "${Server}:${RemotePath}/"
        } else {
            Write-Host "==> scp (rsync not found — slower, no delete)"
            scp -r ./src ./public ./deploy ./scripts `
                ./package.json ./package-lock.json ./index.html `
                ./Dockerfile ./docker-compose.yml ./.env.example `
                "${Server}:${RemotePath}/"
        }
    }

    Write-Host "==> argus-update on server"
    ssh $Server "cd $RemotePath && argus-update"
}
finally {
    Pop-Location
}
