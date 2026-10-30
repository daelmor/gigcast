#!/usr/bin/env bash
# Every colour in src/ must come from a token: no raw Tailwind palette classes and no hex
# literals outside the token file. Exits non-zero when something slips through.
set -u
cd "$(dirname "$0")/.."
status=0
echo "== raw palette classes"
if grep -rnE '(zinc|indigo|emerald|amber|rose|sky|violet|purple|pink|teal|cyan|orange|gray|slate|neutral|stone|red|green|blue|yellow|lime|fuchsia)-[0-9]{2,3}\b' src --include='*.svelte' --include='*.ts' --include='*.css' --include='*.html'; then
  status=1
else
  echo "none"
fi
echo "== bg/text/border white or black"
if grep -rnE '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black)\b' src --include='*.svelte' --include='*.ts' --include='*.css' --include='*.html'; then
  status=1
else
  echo "none"
fi
echo "== hex literals outside the token file (app.html theme-color metas excepted)"
if grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.svelte' --include='*.ts' --include='*.css' --include='*.html' | grep -v 'src/lib/styles/' | grep -v 'name="theme-color"'; then
  status=1
else
  echo "none"
fi
exit $status
