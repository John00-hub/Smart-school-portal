# Deploying SmartSchool on Oracle Cloud Infrastructure

**Target:** Ubuntu Linux + Nginx + HTTPS, deployed from GitHub.
**Current state:** the app runs on Vercel (`vercel.json`). This guide is for a
later move to OCI. Nothing here has been executed — no cloud resources have
been provisioned and none should be provisioned automatically.

---

## Why OCI at all

OCI's Always Free tier includes ARM Ampere instances (up to 4 OCPU / 24 GB
RAM) that are genuinely usable for a school portal, and the egress allowance
is generous. For Midex Edits hosting several pilot schools, a single small
VM behind Nginx is a sensible and cheap starting point.

**Keep the app on Vercel until the pilot is running.** Moving to OCI adds
patching, backup and TLS renewal to your responsibilities. Do it deliberately.

---

## 1. Provision the instance

OCI Console → Compute → Instances → Create instance.

| Setting | Value |
|---|---|
| Image | Ubuntu 24.04 (aarch64 if using Ampere) |
| Shape | VM.Standard.A1.Flex — 2 OCPU / 12 GB (Always Free eligible) |
| Boot volume | 100 GB (free tier allows 200 GB total) |
| VCN | Create new, **assign a public IPv4** |
| SSH keys | Upload your public key — never password auth |

### Ingress rules (VCN → Security List)

Open only what is needed:

| Port | Purpose |
|---|---|
| 22 | SSH — restrict the source to your IP if possible |
| 80 | HTTP — redirect to HTTPS only |
| 443 | HTTPS |

Do **not** open 5173, 4173 or 5432. The app is served as static files by
Nginx; there is no application port to expose.

### Ubuntu firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 2. Install the stack

```bash
sudo apt update && sudo apt upgrade -y
# Node 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
node -v && nginx -v
```

---

## 3. Deploy the build

The app is a static SPA. Build it anywhere (CI is better — see §6) and copy
`dist/` to the server.

```bash
sudo mkdir -p /var/www/smartschool
# from your build machine:
rsync -avz --delete dist/ ubuntu@<instance-ip>:/var/www/smartschool/
```

### Nginx site

`/etc/nginx/sites-available/smartschool`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name portal.yourdomain.com;

    root /var/www/smartschool;
    index index.html;

    # ── SPA rewrite: this is the Nginx equivalent of vercel.json ──
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Hashed assets are immutable — cache them hard.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Never serve dotfiles.
    location ~ /\. { deny all; }

    # Security headers (mirror vercel.json).
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/smartschool /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. HTTPS with Let's Encrypt

```bash
sudo certbot --nginx -d portal.yourdomain.com \
  --redirect --agree-tos -m you@midexedits.com --no-eff-email
```

Certbot installs a systemd timer for renewal. Verify it:

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Point your DNS `A` record at the instance's public IP **before** running
certbot, or the challenge will fail.

---

## 5. Environment variables

The Supabase keys are **public by design** — they are compiled into the
client bundle because the browser must call Supabase directly. Security comes
from Row Level Security, not from hiding the anon key.

Still, keep them out of git:

```bash
# on the build machine, never committed
cat > .env <<'EOF'
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
EOF
npm run build
```

Verify `.env` is gitignored:

```bash
git check-ignore .env && echo "ignored — good"
```

**The `service_role` key must never appear in this project.** It bypasses RLS
entirely. It belongs only in server-side migration scripts or CI, held in an
OCI Vault secret if you need it at all.

Also update Supabase → Authentication → URL Configuration:
- Site URL: `https://portal.yourdomain.com`
- Redirect URLs: add `https://portal.yourdomain.com/**`

---

## 6. GitHub-based deployment

Use GitHub Actions to build and deploy on push to `main`. Store the SSH key
and host as repository secrets — never in the workflow file.

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to OCI
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install and build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: |
          npm ci
          npm run build
          npm test
          npm run check:sql

      - name: Deploy over SSH
        uses: easingthemes/ssh-deploy@v5
        with:
          SSH_PRIVATE_KEY: ${{ secrets.OCI_SSH_KEY }}
          REMOTE_HOST: ${{ secrets.OCI_HOST }}
          REMOTE_USER: ubuntu
          SOURCE: dist/
          TARGET: /var/www/smartschool/
          ARGS: -avz --delete
```

The workflow runs tests and SQL checks before deploying, so a broken build
cannot reach the server.

---

## 7. Basic monitoring

Minimal, no paid services:

```bash
# Uptime + resource alerts (free tier)
sudo apt install -y btop
# Simple cron health check — restart Nginx if the site stops answering
sudo tee /usr/local/bin/smartschool-health <<'EOF'
#!/bin/bash
code=$(curl -s -o /dev/null -w "%{http_code}" https://portal.yourdomain.com/)
if [ "$code" != "200" ]; then
  echo "$(date) health check failed ($code)" >> /var/log/smartschool-health.log
  systemctl restart nginx
fi
EOF
sudo chmod +x /usr/local/bin/smartschool-health
echo '*/5 * * * * root /usr/local/bin/smartschool-health' | sudo tee /etc/cron.d/smartschool-health
```

OCI also provides free monitoring agents and alarms:
Compute → Instance → Metrics → create an alarm on CPU or status.

Log access and errors:

```bash
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

---

## 8. Secure deployment practices

- [ ] SSH key auth only; `PasswordAuthentication no` in `sshd_config`
- [ ] `ufw` enabled, only 22/80/443 open, 22 source-restricted
- [ ] HTTPS enforced, HTTP redirects, certbot renewal verified
- [ ] Automatic security updates: `sudo apt install unattended-upgrades`
- [ ] No `.env` in git (`git check-ignore .env`)
- [ ] `service_role` key absent from the repo and the bundle:
      ```bash
      grep -r "service_role" dist/ && echo "LEAKED" || echo "clean"
      ```
- [ ] OCI Vault for any secret the server needs
- [ ] Object Storage bucket for database backups, versioning enabled
- [ ] Backups tested by actually restoring one

---

## 9. What this guide does not cover

- **Database hosting.** The database stays on Supabase. OCI serves only the
  static frontend. If you later self-host Postgres on OCI you take on backup,
  replication and patching responsibilities — that is a separate decision.
- **Multi-instance load balancing.** Not needed for a single pilot school.
- **Containerisation.** Nginx serving static files is simpler and sufficient.
- **CDN.** OCI Object Storage + a CDN could front the assets later.

None of this has been executed. It is a plan, not a record of a working
deployment.
