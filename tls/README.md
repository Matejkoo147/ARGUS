# TLS for ARGUS HTTPS (:9443)

Place custom certs here on mato-server (not committed):

| File | Purpose |
|------|---------|
| `argus-ca.crt` | Install on iPhone — enables home screen icon over HTTPS |
| `argus-ca.key` | Private CA key (keep secret) |
| `argus.crt` | Server cert (nginx) |
| `argus.key` | Server key (nginx) |

Generate CA + cert:

```bash
./scripts/generate-argus-ca.sh
argus-update build
```

If these files are missing, Docker entrypoint auto-generates a **self-signed** cert (`cert.pem` / `key.pem`) — fine for browsing, but iOS home screen shows **“A”** instead of the eye icon.

See DEPLOY.md → “iPhone home screen icon shows A”.
