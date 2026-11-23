#!/usr/bin/env bash
# Model-check the "no double stock posting" properties.
# Usage:  bash formal/run.sh            (all models)
#         bash formal/run.sh TransferStock_UI   (one config)
# Needs Java 11+. Downloads TLA+ tools v1.7.4 once into formal/.tools/ (git-ignored).
set -u
cd "$(dirname "$0")"
JAR=.tools/tla2tools.jar
SHA=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
if [ ! -f "$JAR" ]; then
  mkdir -p .tools
  curl -sSL -o "$JAR" https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar || exit 2
fi
echo "$SHA  $JAR" | sha256sum -c --quiet - || { echo "tla2tools.jar checksum mismatch"; exit 2; }

# config:module:EXPECT. EXPECT=fail marks a KNOWN BUG in today's code that the model must keep
# catching; change it to pass only after the product code is fixed AND the model updated.
MODELS="
Checkout_NoKill:Checkout:pass
Checkout_KillAfterCommit:Checkout:pass
TransferStock_UI:TransferStock:pass
TransferStock_AllRoutes:TransferStock:pass
SaleReturns_Concurrent:SaleReturns:pass
SaleReturns_OneAtATime:SaleReturns:pass
Receiving_OneAtATime:Receiving:pass
Receiving_ConcurrentApprove:Receiving:pass
Receiving_Concurrent:Receiving:pass
"
status=0
for line in $MODELS; do
  cfg=${line%%:*}; rest=${line#*:}; mod=${rest%%:*}; expect=${rest#*:}
  [ $# -gt 0 ] && [ "$1" != "$cfg" ] && continue
  out=$(java -XX:+UseParallelGC -cp "$JAR" tlc2.TLC -workers auto -deadlock \
        -metadir ".tools/states/$cfg" -config "$cfg.cfg" "$mod.tla" 2>&1)
  echo "$out" > ".tools/$cfg.out"
  if echo "$out" | grep -q "No error has been found"; then got=pass
  elif echo "$out" | grep -q "is violated"; then got=fail
  else got=error; fi
  printf '%-26s expected=%-4s got=%-5s  (%s)\n' "$cfg" "$expect" "$got" \
    "$(echo "$out" | grep -oE 'Invariant [A-Za-z]+ is violated' | head -1)$(echo "$out" | grep -oE '[0-9,]+ distinct states found' | head -1)"
  [ "$got" = "$expect" ] || status=1
done
[ $status = 0 ] && echo "ALL AS EXPECTED" || echo "UNEXPECTED RESULT - read formal/.tools/<config>.out"
exit $status
