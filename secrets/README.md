# Secrets (SOPS + age)

App secrets are encrypted with **SOPS + age**. Bootstrap tokens stay in the CI secret store. Never commit plaintext secrets, decrypted outputs, or age **private** keys in cleartext.

## Layers

| Layer | Where | Examples |
|-------|-------|----------|
| Bootstrap | GitHub Environments / GitLab masked CI vars | `SOPS_AGE_KEY`, `NEON_API_KEY`, `VERCEL_TOKEN`, `POSTGRES_ADMIN_URL` |
| App (encrypted in git) | `secrets/secrets.enc.yaml` | Mode-specific app config under `common` / `cloud` / `selfhosted` |

`sops-decrypt.sh` flattens `common` + `$DEPLOY_TARGET` into `secrets/secrets.dec.json` (mode `0600`, gitignored). Bootstrap keys (`NEON_*`, `VERCEL_*`, `POSTGRES_ADMIN_URL`, `SOPS_AGE_*`) are rejected if present in the encrypted app file.

## Template demo (passphrase)

This repository ships a **demo-only** encrypted file decryptable with example passphrase `Example123!`.

| File | Role |
|------|------|
| `secrets/secrets.enc.yaml` | Real SOPS ciphertext (placeholder app values only) |
| `secrets/.sops.yaml` | Public age recipient used at encrypt time |
| `secrets/template-age-identity.age` | Age identity wrapped with `age --passphrase` |

**Rotate before any real use.** Do not put real Neon/Vercel credentials in the demo file.

```bash
export DEPLOY_TARGET=cloud   # or selfhosted
export SOPS_AGE_PASSPHRASE='Example123!'
nix develop -c ./scripts/ci/sops-decrypt.sh
```

Rebuild the demo bundle (still placeholders only):

```bash
nix develop -c ./scripts/ci/bootstrap-template-secrets.sh --force
```

`sops-decrypt.sh` accepts either:

1. `SOPS_AGE_KEY` / `SOPS_AGE_KEY_FILE` — plaintext X25519 identity (CI / production), or
2. `SOPS_AGE_PASSPHRASE` + `secrets/template-age-identity.age` (template demo).

## Production bootstrap (first real project)

1. Generate an age keypair **outside** the repo (never commit the private key):

   ```bash
   mkdir -p ~/.config/sops/age
   age-keygen -o ~/.config/sops/age/keys.txt
   ```

2. Copy `secrets.example.yaml` to a path **outside** this repository and replace placeholder values with real app secrets.

3. Encrypt and write the committed files:

   ```bash
   export AGE_RECIPIENT="$(age-keygen -y ~/.config/sops/age/keys.txt)"
   export SOPS_PLAINTEXT_FILE=/secure/path/outside-repo/app-secrets.yaml
   nix develop -c ./scripts/ci/bootstrap-sops.sh --force
   ```

4. Commit only `secrets/secrets.enc.yaml` and `secrets/.sops.yaml` (public recipient). Remove the demo `template-age-identity.age` once you no longer need the passphrase path. Delete the external plaintext.

5. Store the private key as CI secret `SOPS_AGE_KEY` (contents of `keys.txt`) for preview jobs.

## Decrypt (local / CI — production key)

```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
export DEPLOY_TARGET=cloud   # or selfhosted
nix develop -c ./scripts/ci/sops-decrypt.sh
```

Preview / deploy jobs **fail loud** when:

- `secrets/secrets.enc.yaml` is missing or not a real SOPS document
- no decrypt credential is set (`SOPS_AGE_KEY` / `SOPS_AGE_KEY_FILE` / `SOPS_AGE_PASSPHRASE`)
- decryption or layer flattening fails

`npm run ci:validate-secrets` refuses any tracked `*.enc.*` that is not SOPS-encrypted and refuses committed plaintext age private keys.

## Files in this directory

| File | Commit? | Purpose |
|------|---------|---------|
| `secrets.example.yaml` | yes | Schema only — placeholders, no real values |
| `.sops.yaml.example` | yes | Shows public-recipient `creation_rules` shape |
| `.sops.yaml` | yes | Public age recipient for SOPS |
| `secrets.enc.yaml` | yes | Real SOPS ciphertext only |
| `template-age-identity.age` | yes (demo) | Passphrase-wrapped identity for `Example123!` — rotate / replace for real projects |
| `*.dec.yaml` / `*.dec.json` | **never** | Decrypt outputs (gitignored) |
| plaintext age private keys | **never** | CI secret / local `~/.config/sops/age/` only |
