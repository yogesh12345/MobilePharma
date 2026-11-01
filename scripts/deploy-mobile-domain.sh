#!/bin/sh
set -eu

SOURCE_DIR=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
WEB_ROOT=/var/www/mobilepharma

cd "$SOURCE_DIR"

if [ ! -f package.json ] || [ ! -f package-lock.json ]; then
    echo "MobilePharma source files are missing from $SOURCE_DIR" >&2
    exit 1
fi

npm ci
./node_modules/.bin/tsc -b
./node_modules/.bin/vite build --mode web --base /

if [ ! -f dist/index.html ] || ! grep -q '"/assets/' dist/index.html; then
    echo "The root-path web build is missing or invalid" >&2
    exit 1
fi

mobile_stock_status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://mobile.meenaagencies.co.in/mobile/stock/current/1 || true)
mobile_stock_type=$(curl -sS -o /dev/null -w '%{content_type}' --max-time 15 https://mobile.meenaagencies.co.in/mobile/stock/current/1 || true)
legacy_stock_type=$(curl -sS -o /dev/null -w '%{content_type}' --max-time 15 https://mobile.meenaagencies.co.in/stock/current/1 || true)
case "$mobile_stock_status" in
    401|403) mobile_stock_available=1 ;;
    200) if printf '%s' "$mobile_stock_type" | grep -qi 'application/json'; then mobile_stock_available=1; else mobile_stock_available=0; fi ;;
    *) mobile_stock_available=0 ;;
esac
if [ "$mobile_stock_available" -eq 0 ] && ! printf '%s' "$legacy_stock_type" | grep -qi 'application/json'; then
    echo "Current stock is not routed through the mobile hostname." >&2
    echo "Deploy the Go /mobile/stock/current route or add stock to the Nginx API proxy and reload Nginx." >&2
    exit 1
fi

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a dist/ "$WEB_ROOT/"

expected_asset=$(grep -oE '/assets/index-[^"]+\.js' dist/index.html | head -n 1)
served_asset=$(curl -fsS --max-time 15 https://mobile.meenaagencies.co.in/ | grep -oE '/assets/index-[^"]+\.js' | head -n 1 || true)
if [ "$expected_asset" != "$served_asset" ]; then
    echo "Published files, but the public site still serves $served_asset instead of $expected_asset" >&2
    exit 1
fi

echo "Published MobilePharma to $WEB_ROOT"
echo "Verified https://mobile.meenaagencies.co.in/ serves $served_asset"
