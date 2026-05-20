# lifeglance-sync

Tiny Node 20 sidecar that persists lifeGLANCE state to a host-mounted folder so
the data survives browser cache wipes.

## Endpoints

| Method | Path             | Purpose                                        |
| ------ | ---------------- | ---------------------------------------------- |
| GET    | `/healthz`       | Liveness check                                 |
| GET    | `/state`         | Returns `state.json` (JSON backup blob)        |
| PUT    | `/state`         | Atomically replaces `state.json`; rotates `.bak` |
| GET    | `/media`         | Lists all stored blobs: `{ id, size, mtime, mimeType }` |
| GET    | `/media/:id`     | Returns binary blob with original mime type    |
| PUT    | `/media/:id`     | Stores binary blob; mime taken from `X-Mime-Type` or `Content-Type` |
| DELETE | `/media/:id`     | Removes blob                                   |

`id` must match `^[A-Za-z0-9._-]{1,128}$` (UUIDs + lifeGLANCE's `${uuid}-photo`
suffix fit). Path traversal is rejected.

## Storage layout

```
/data/
  state.json         <- milestones + chapters + photos (base64)
  state.json.bak     <- previous state.json (one-step undo)
  media/
    <id>.bin         <- raw audio/video bytes
    <id>.meta.json   <- { mimeType, bytes, savedAt }
```

All writes are atomic (`tmp` + `rename`).

## Env

- `DATA_DIR` — defaults to `/data`
- `PORT` — defaults to `8079`
- `MAX_STATE_BYTES` — defaults to 100 MiB
- `MAX_BLOB_BYTES`  — defaults to 500 MiB

## Run locally

```
DATA_DIR=./testdata PORT=8079 node server.js
```
