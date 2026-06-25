# Push ARGUS to GitHub

One-time setup (GitHub website):

1. Open https://github.com/new
2. Repository name: **ARGUS**
3. Private or Public — your choice
4. Do **not** add README / .gitignore (we already have them)
5. Create repository

Then in PowerShell (replace `YOUR_GITHUB_USER`):

```powershell
cd "C:\Users\matej\Desktop\MV Security HA-App"

git init
git add .
git commit -m "Initial ARGUS — cyberpunk Home Assistant security UI"

git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/ARGUS.git
git push -u origin main
```

## Deploy on mato-server after push

```bash
cd ~/apps
git clone https://github.com/YOUR_GITHUB_USER/ARGUS.git argus
cd argus
cp .env.example .env
# edit .env — set ARGUS_HA_UPSTREAM and ARGUS_PUBLIC_URL
chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh
sudo ln -sf ~/apps/argus/scripts/argus-update.sh /usr/local/bin/argus-update
argus-update
```

## Daily update from laptop

```powershell
git add -A
git commit -m "Describe your change"
git push
ssh mato-server "argus-update"
```

Or:

```powershell
.\scripts\argus-deploy-remote.ps1 -Server mato-server
```
