#!/usr/bin/env bash
set -euo pipefail

ORGANIZED=".env.organized"
ORIGINAL=".env"
SHOW_VALUES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --organized) ORGANIZED="$2"; shift 2 ;;
    --original)  ORIGINAL="$2";  shift 2 ;;
    --show-values) SHOW_VALUES=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f "$ORGANIZED" ]]; then echo "Missing organized env: $ORGANIZED" >&2; exit 1; fi
if [[ ! -f "$ORIGINAL"  ]]; then echo "Missing original env:  $ORIGINAL"  >&2; exit 1; fi

declare -A A B

trim() { # trim leading/trailing spaces
  local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "$s";
}
parse_env() {
  local file="$1" ; local -n ref="$2"
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Strip BOM, ignore comments/blank
    line="${line//$'\r'/}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    # Accept lines like KEY=VALUE (first = splits)
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      key="$(trim "$key")"
      # Keep value as-is (no expansion), but trim surrounding spaces
      val="$(trim "$val")"
      # Normalize: strip matching surrounding quotes
      if [[ "$val" == '"'*'"' && ${#val} -ge 2 ]]; then
        val="${val:1:${#val}-2}"
      elif [[ "$val" == "'"*"'" && ${#val} -ge 2 ]]; then
        val="${val:1:${#val}-2}"
      fi
      # Normalize: unescape common backslash escapes (e.g., \$, \&, \\)
      val="${val//\\\$/\$}"
      val="${val//\\\&/&}"
      val="${val//\\\\/\\}"
      ref["$key"]="$val"
    fi
  done < "$file"
}

parse_env "$ORGANIZED" A
parse_env "$ORIGINAL"  B

# Collect union of keys
declare -A UNION=()
for k in "${!A[@]}"; do UNION["$k"]=1; done
for k in "${!B[@]}"; do UNION["$k"]=1; done

only_in_A=()
only_in_B=()
diff_vals=()
same_vals=()

mask() {
  local v="$1"
  local n=${#v}
  if (( SHOW_VALUES )); then
    printf '%s' "$v"
  else
    # Mask but keep length hint and a short hash
    local h; h=$(printf '%s' "$v" | sha1sum | awk '{print $1}')
    printf '<masked len=%d sha1=%s>' "$n" "${h:0:12}"
  fi
}

for k in "${!UNION[@]}"; do
  if [[ -z "${A[$k]+_}" ]]; then
    only_in_B+=("$k")
  elif [[ -z "${B[$k]+_}" ]]; then
    only_in_A+=("$k")
  else
    if [[ "${A[$k]}" == "${B[$k]}" ]]; then
      same_vals+=("$k")
    else
      diff_vals+=("$k")
    fi
  fi
done

echo "Comparing:"
echo "  Organized: $ORGANIZED"
echo "  Original : $ORIGINAL"
echo

echo "== Keys only in ORGANIZED (${#only_in_A[@]}) =="
printf '%s\n' "${only_in_A[@]}" | sort
echo

echo "== Keys only in ORIGINAL (${#only_in_B[@]}) =="
printf '%s\n' "${only_in_B[@]}" | sort
echo

echo "== Keys with DIFFERENT values (${#diff_vals[@]}) =="
for k in $(printf '%s\n' "${diff_vals[@]}" | sort); do
  av="${A[$k]}"; bv="${B[$k]}"
  echo "- $k"
  echo "    organized: $(mask "$av")"
  echo "    original : $(mask "$bv")"
done
echo

echo "== Keys with IDENTICAL values (${#same_vals[@]}) =="
printf '%s\n' "${same_vals[@]}" | sort