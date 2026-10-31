"""Bundle the current web build and source for Linux deployment."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import subprocess


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "release" / "MobilePharma-linux-2026-10-30-rev2.zip"
SOURCE_FILES = (
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "eslint.config.js",
    ".env.web",
    "README.md",
    "WEB_DEPLOY.md",
)
SOURCE_DIRS = ("src", "public", "deploy", "scripts")

GUIDE = """# MobilePharma Linux deployment

This archive contains a ready-to-serve browser build in `dist/` and source files
in `source/`. It is built for `/mobile-app/` with same-origin API calls.

Target mobile browser URL after deployment:
https://back.meenaagencies.co.in/mobile-app/

The target URL returned HTTP 404 when this archive was created. Deployment and
server routing are required before it will open. The hostname resolved to a
private IP from the build machine; verify public DNS and HTTPS reachability
from a mobile network if the URL must work over the public internet.

## Deploy the prebuilt browser app

Unzip this archive on the Linux server, then from the extracted directory:

    sudo mkdir -p /var/www/mobile-app
    sudo rsync -a --delete dist/ /var/www/mobile-app/

Merge `source/deploy/nginx-mobile-app.conf` into the existing HTTPS Nginx
server block for `back.meenaagencies.co.in`. Keep the API proxy locations
outside `/mobile-app/` intact. Then run:

    sudo nginx -t
    sudo systemctl reload nginx
    curl -I https://back.meenaagencies.co.in/mobile-app/

The URL should return HTTP 200 and its HTML should reference assets under
`/mobile-app/assets/`. Open it on the phone and sign in. The Go API must be
available on the same HTTPS host for login and data requests.

## Rebuild from source on Linux

Node.js and npm are needed. From the extracted directory:

    cd source
    npm ci
    npm run build:web
    sudo rsync -a --delete dist/ /var/www/mobile-app/

The build uses `source/.env.web` and emits files for `/mobile-app/`.
Do not deploy the `source/` directory as the web root.

## Backend compatibility

Immediate Sales Order item selection requires the Go API search response to
include each item's full record. Older backends still work with a fallback
item-detail request, but selecting a searched item can be slower. If this
archive contains `backend-patch/sales-order-search-full-item.patch`, apply it
in the matching backend repository and restart that service.

See `source/WEB_DEPLOY.md` for more context.
"""


def main() -> None:
    if not (ROOT / "dist" / "index.html").is_file():
        raise FileNotFoundError("Run npm run build:web before packaging")
    ARCHIVE.parent.mkdir(exist_ok=True)

    backend_root = ROOT.parent / "Backend"
    patch = ""
    if backend_root.is_dir():
        patch = subprocess.run(
            ["git", "-C", str(backend_root), "diff", "--", "controllers/mobileController.go"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout

    with ZipFile(ARCHIVE, "w", ZIP_DEFLATED, compresslevel=9) as bundle:
        bundle.writestr("DEPLOY_LINUX.md", GUIDE)
        for path in sorted((ROOT / "dist").rglob("*")):
            if path.is_file():
                bundle.write(path, path.relative_to(ROOT).as_posix())
        for name in SOURCE_FILES:
            path = ROOT / name
            bundle.write(path, "source/" + name)
        for name in SOURCE_DIRS:
            for path in sorted((ROOT / name).rglob("*")):
                if path.is_file() and "__pycache__" not in path.parts:
                    bundle.write(path, "source/" + path.relative_to(ROOT).as_posix())
        if patch.strip():
            bundle.writestr("backend-patch/sales-order-search-full-item.patch", patch)

    with ZipFile(ARCHIVE) as bundle:
        corrupt = bundle.testzip()
        if corrupt:
            raise RuntimeError(f"Corrupt ZIP entry: {corrupt}")
        print(f"{ARCHIVE} ({ARCHIVE.stat().st_size:,} bytes, {len(bundle.namelist())} entries)")


if __name__ == "__main__":
    main()
