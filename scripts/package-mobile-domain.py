"""Build and bundle the root-path mobile website for the Linux host."""

import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "release" / "MobilePharma-mobile-domain-2026-11-01-item-search.zip"
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
    "MOBILE_DOMAIN_DEPLOY.md",
    "scripts/deploy-mobile-domain.sh",
)
SOURCE_DIRS = ("src", "public", "deploy")


def main() -> None:
    with TemporaryDirectory(prefix="mobilepharma-domain-") as output:
        npm = "npm.cmd" if os.name == "nt" else "npm"
        subprocess.run(
            [npm, "run", "build:mobile-domain", "--", "--outDir", output],
            cwd=ROOT,
            check=True,
        )
        archive_root = Path(output)
        index = (archive_root / "index.html").read_text(encoding="utf-8")
        if "/mobile-app/" in index or "/assets/" not in index:
            raise RuntimeError("The build does not use the mobile hostname root")

        ARCHIVE.parent.mkdir(exist_ok=True)
        with ZipFile(ARCHIVE, "w", ZIP_DEFLATED, compresslevel=9) as bundle:
            bundle.writestr(
                "DEPLOY_LINUX.md",
                "# MobilePharma domain bundle\n\n"
                "The ready-built website is in `dist/`; source is in `source/`.\n"
                "Read `source/MOBILE_DOMAIN_DEPLOY.md` before replacing the live site.\n\n"
                "To rebuild after extracting:\n\n"
                "    cd source\n"
                "    npm ci\n"
                "    npm run build:mobile-domain\n\n"
                "The generated `source/dist/` then replaces the bundled `dist/`.\n",
            )
            for path in sorted(archive_root.rglob("*")):
                if path.is_file():
                    bundle.write(path, "dist/" + path.relative_to(archive_root).as_posix())
            for name in SOURCE_FILES:
                bundle.write(ROOT / name, "source/" + name)
            for name in SOURCE_DIRS:
                for path in sorted((ROOT / name).rglob("*")):
                    if path.is_file():
                        bundle.write(path, "source/" + path.relative_to(ROOT).as_posix())
        with ZipFile(ARCHIVE) as bundle:
            bad = bundle.testzip()
            if bad:
                raise RuntimeError(f"Corrupt ZIP entry: {bad}")
        print(f"Created {ARCHIVE}")


if __name__ == "__main__":
    main()
