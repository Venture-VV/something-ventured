#!/usr/bin/env python3
"""
Generate every model in tripo/assets.json with the Tripo OpenAPI (v3) and save the GLBs where
import_tripo.py expects them: assets/models/<id>.glb

    export TRIPO_API_KEY=tsk_...              (Windows PowerShell:  $env:TRIPO_API_KEY="tsk_...")
    python scripts/tripo_batch.py --dry-run          # show what would be sent, spend nothing
    python scripts/tripo_batch.py                    # all required assets, one variant each
    python scripts/tripo_batch.py --only hero_3_michael_dragon --variants 3
    python scripts/tripo_batch.py --optional         # also the optional props
    python scripts/tripo_batch.py --moderated hero_1_demon_rising   # use the softer prompt

Image-to-3D instead of text-to-3D: drop a concept image at tripo/images/<id>.png (or .jpg/.webp)
and that asset is generated from the image (more control over the pose; 20 credits instead of 10).

Only the Python standard library is used. Task ids are stored in tripo/tasks.json, so a run that is
interrupted (or times out) is resumed instead of paid for twice.

NOTE  written against https://developers.tripo3d.ai (API v3) as read on 2026-11-12, but never run
      against the live API from the cloud session that wrote it (no key there). If a response has
      an unexpected shape the script prints it and stops instead of guessing.
      API credits are billed separately from a Tripo Studio (web) subscription.
"""
import argparse, json, mimetypes, os, sys, time, urllib.error, urllib.request, uuid

BASE = os.environ.get("TRIPO_API_BASE", "https://openapi.tripo3d.ai/v3")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, "tripo", "assets.json")
STATE = os.path.join(ROOT, "tripo", "tasks.json")
IMAGES = os.path.join(ROOT, "tripo", "images")
MODELS = os.path.join(ROOT, "assets", "models")
TERMINAL_BAD = ("failed", "cancelled", "banned", "expired")


def key():
    k = os.environ.get("TRIPO_API_KEY", "").strip()
    if not k:
        sys.exit("TRIPO_API_KEY is not set (create one at https://developers.tripo3d.ai, it starts with tsk_)")
    return k


def call(method, path, body=None, raw=None, content_type=None):
    url = BASE + path
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    for attempt in range(7):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", "Bearer " + key())
        if data is not None:
            req.add_header("Content-Type", content_type or "application/json")
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                payload = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            text = e.read().decode(errors="replace")
            if e.code == 429:                                   # rate limit / concurrency cap
                wait = e.headers.get("Retry-After", "")
                time.sleep(int(wait) if wait.isdigit() else min(60, 2 ** attempt * 2))
                continue
            raise SystemExit("HTTP %s on %s %s\n%s" % (e.code, method, path, text))
        if payload.get("code") != 0 or "data" not in payload:
            raise SystemExit("unexpected response on %s %s:\n%s" % (method, path, json.dumps(payload, indent=2)))
        return payload["data"]
    raise SystemExit("still rate-limited after several retries: " + path)


def upload(path):
    boundary = uuid.uuid4().hex
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        blob = f.read()
    body = (("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"
             % (boundary, os.path.basename(path), ctype)).encode() + blob + ("\r\n--%s--\r\n" % boundary).encode())
    data = call("POST", "/files", raw=body, content_type="multipart/form-data; boundary=" + boundary)
    token = data.get("file_token")
    if not token:
        raise SystemExit("upload: no file_token in " + json.dumps(data))
    return token


def find_image(asset_id):
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = os.path.join(IMAGES, asset_id + ext)
        if os.path.exists(p):
            return p
    return None


def payload_for(asset, defaults, suffix, textured, moderated):
    p = {
        "model": asset.get("model", defaults["model"]),
        "texture": bool(textured),
        "pbr": bool(textured),                 # pbr defaults to true server-side and forces texture on
        "face_limit": asset.get("face_limit", 200000),
    }
    gq = asset.get("geometry_quality", defaults.get("geometry_quality"))
    if gq and gq != "standard":
        p["geometry_quality"] = gq
    img = find_image(asset["id"])
    if img:
        return "/generation/image-to-model", p, img
    text = asset.get("prompt_if_moderated") if (moderated and asset.get("prompt_if_moderated")) else asset["prompt"]
    p["prompt"] = (text + (suffix if asset.get("slot") else ""))[:1024]     # the sculpture style suffix is for the heroes only
    p["negative_prompt"] = defaults.get("negative_prompt", "")[:255]
    return "/generation/text-to-model", p, None


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    with urllib.request.urlopen(urllib.request.Request(url), timeout=600) as r, open(tmp, "wb") as f:   # signed URL: no auth header
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, dest)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", default="", help="comma separated asset ids")
    ap.add_argument("--variants", type=int, default=1, help="how many seeds per asset (pick the best one, rename it to <id>.glb)")
    ap.add_argument("--optional", action="store_true", help="include assets marked optional")
    ap.add_argument("--textured", action="store_true", help="ask Tripo for PBR textures too (statues are re-shaded in Blender, so normally not needed)")
    ap.add_argument("--moderated", default="", help="comma separated ids that should use prompt_if_moderated")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timeout", type=int, default=1800)
    a = ap.parse_args()

    man = json.load(open(MANIFEST, encoding="utf-8"))
    defaults, suffix = man["defaults"], man.get("style_suffix", "")
    only = {s for s in a.only.split(",") if s}
    moderated = {s for s in a.moderated.split(",") if s}
    assets = [x for x in man["assets"] if (x["id"] in only if only else (a.optional or not x.get("optional")))]
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}

    jobs = []
    for asset in assets:
        for v in range(1, a.variants + 1):
            name = asset["id"] if v == 1 else "%s__v%d" % (asset["id"], v)
            dest = os.path.join(MODELS, name + ".glb")
            if os.path.exists(dest):
                print("have   ", name)
                continue
            path, payload, img = payload_for(asset, defaults, suffix, a.textured, asset["id"] in moderated)
            if v > 1:
                payload["model_seed"] = 1000 + v
            jobs.append(dict(name=name, dest=dest, path=path, payload=payload, img=img))

    if a.dry_run:
        for j in jobs:
            print("\n== %s  ->  POST %s%s" % (j["name"], BASE, j["path"]))
            if j["img"]:
                print("   image:", j["img"])
            print(json.dumps(j["payload"], indent=2, ensure_ascii=False))
        print("\n%d task(s) would be created." % len(jobs))
        return

    for j in jobs:                                              # submit (or pick up a stored task)
        if j["name"] in state:
            j["task"] = state[j["name"]]
            print("resume ", j["name"], j["task"])
            continue
        if j["img"]:
            j["payload"]["input"] = upload(j["img"])
        data = call("POST", j["path"], j["payload"])
        j["task"] = data.get("task_id")
        if not j["task"]:
            raise SystemExit("no task_id in " + json.dumps(data))
        state[j["name"]] = j["task"]
        json.dump(state, open(STATE, "w"), indent=2)
        print("submit ", j["name"], j["task"])

    pending, deadline, spent = list(jobs), time.time() + a.timeout, 0.0
    while pending and time.time() < deadline:
        time.sleep(4)
        for j in list(pending):
            t = call("GET", "/tasks/" + j["task"])
            st = t.get("status")
            if st == "success":
                url = (t.get("output") or {}).get("model_url")
                if not url:
                    raise SystemExit("success without output.model_url:\n" + json.dumps(t, indent=2))
                download(url, j["dest"])
                spent += float(t.get("credits_consumed") or 0)
                print("done   ", j["name"], "->", os.path.relpath(j["dest"], ROOT), "(%s credits)" % t.get("credits_consumed"))
                pending.remove(j)
            elif st in TERMINAL_BAD:
                print("FAILED ", j["name"], st, t.get("error_code"), t.get("error_message"))
                if str(t.get("error_code")) == "2008":
                    print("        (content moderation) retry with:  --only %s --moderated %s" % (j["name"].split("__")[0], j["name"].split("__")[0]))
                state.pop(j["name"], None)
                json.dump(state, open(STATE, "w"), indent=2)
                pending.remove(j)
            else:
                print("  ...  %-28s %-8s %s%%" % (j["name"], st, t.get("progress")), end="\r")
    if pending:
        print("\nstill running (re-run the same command later to collect them, nothing is resubmitted):",
              ", ".join(j["name"] for j in pending))
    print("\ncredits consumed this run: %.0f" % spent)


if __name__ == "__main__":
    main()
