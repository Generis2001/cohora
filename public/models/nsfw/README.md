# Self-hosted NSFW moderation model

The upload safety scan (`src/lib/nsfw/scanner.ts`) loads its TensorFlow.js model
from this directory (`/models/nsfw/`) instead of nsfwjs's default third-party
CDN. That default host (`d1zv2aa70wpiur.cloudfront.net`) can fail to resolve,
which blocks every image/video upload with
"Cohora could not complete the required safety scan."

## Files you must place here

Drop the **quantized MobileNet** nsfwjs model (the same one nsfwjs loads by
default) into this folder:

- `model.json`
- every weight shard it references, e.g. `group1-shard1of1.bin`
  (open `model.json` → `weightsManifest[].paths` to see the exact shard names)

### Requirements (must match what the code expects)

- **Layers model** (Keras `loadLayersModel` format), **not** the graph/InceptionV3 model.
- Input **size 224** and class order `[Drawing, Hentai, Neutral, Porn, Sexy]`.
- This is the model at the nsfwjs default path
  `tfjs_quant_nsfw_mobilenet/` — vendor those exact files here.

> If you instead use the graph InceptionV3 model, the loader in
> `scanner.ts` must be changed to `nsfwjs.load(NSFW_MODEL_URL, { type: 'graph', size: 299 })`.

## Verifying

After placing the files, load the upload page, open DevTools → Network, pick an
image, and confirm the requests to `/models/nsfw/model.json` and the `.bin`
shard(s) return **200**. The "safety scan" error should be gone.
