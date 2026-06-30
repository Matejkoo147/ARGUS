# TLS for ARGUS HTTPS (:9443)

## iPhone home screen icon = certificate must be VALID

If Safari padlock shows **"This certificate is not valid"**, iOS shows **"A"** instead of the eye icon — even when `/apple-touch-icon.png` opens fine.

You open **`https://10.8.0.1:9443`** — the server cert must include **`10.8.0.1`** in CN or SAN, and the **ARGUS Home CA** must be **fully trusted** on iPhone.

## Generate (on mato-server)

```bash
./scripts/generate-argus-ca.sh --force
argus-update build
```

| File | Install on iPhone? |
|------|-------------------|
| `argus-ca.crt` | **YES** — only this one |
| `argus.crt` | **NO** — server only (nginx) |
| `argus.key` | **NO** — secret, server only |

## iPhone steps

1. Remove any old **argus** leaf profile if you installed `argus.crt` by mistake (keep or reinstall CA only).
2. AirDrop / install **`argus-ca.crt`**
3. **Settings → General → About → Certificate Trust Settings** → **ON** for **ARGUS Home CA**
4. Open `https://10.8.0.1:9443` → padlock → must **not** say invalid
5. Delete old shortcut → Add to Home Screen

Without `tls/argus.crt`, Docker auto-generates a self-signed cert — icons will not work on iPhone HTTPS.
