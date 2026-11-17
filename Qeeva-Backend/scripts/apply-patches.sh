#!/usr/bin/env bash
# apply-patches.sh  (lives in Qeeva-Backend/scripts/)
#
# Applies the patch files you name with "git am", in the order you type them,
# skips a patch whose changes are already in your history, and pushes once at the end.
# It never forces a push and never makes a commit by itself (the commits come from the
# patches). It deletes nothing unless you pass --clean. If a patch fails it cancels only
# that patch and leaves your repository clean.
#
# Run it from inside the repository, naming the patch files in order. Example from Qeeva-Backend:
#   bash scripts/apply-patches.sh --clean 0025-....patch 0026-....patch
#   bash scripts/apply-patches.sh --no-push 0025-....patch     (apply but do not push)
#
# --clean deletes only the .patch files you named, only when git does not track them, and only
# after every patch was applied (or skipped as already applied) AND the push worked.
# It never deletes any other file and never deletes this script.

set -u

push=1
clean=0
files=()
for arg in "$@"; do
  case "$arg" in
    --no-push) push=0 ;;
    --clean) clean=1 ;;
    -h|--help) sed -n '2,/^$/p' "$0"; exit 0 ;;
    *) files+=("$arg") ;;
  esac
done

if [ "${#files[@]}" -eq 0 ]; then
  echo "Give me the patch files, in order. Example:"
  echo "  bash scripts/apply-patches.sh --clean 0025-....patch 0026-....patch"
  exit 1
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "STOP: this folder is not inside a git repository."; exit 1; }

# 1) Make every patch path absolute and check the files exist, before touching anything.
abs=()
for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then echo "STOP: file not found: $f (are you in the folder that holds the patches?)"; exit 1; fi
  abs+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")")
done

# 2) A half-finished "git am" from before blocks everything.
if [ -d "$(git -C "$root" rev-parse --git-path rebase-apply)" ]; then
  echo "STOP: an earlier 'git am' is unfinished. Run:  git am --abort   then run this script again."
  exit 1
fi

# 3) git am needs a clean tree (untracked files are fine).
if [ -n "$(git -C "$root" status --porcelain --untracked-files=no)" ]; then
  echo "STOP: you have uncommitted changes to tracked files:"
  git -C "$root" status --short --untracked-files=no
  echo "Commit or undo them first, then run this script again."
  exit 1
fi

# 4) Warning only: patch files must stay OUTSIDE the repository history.
tracked=$(git -C "$root" ls-files -- '*.patch')
if [ -n "$tracked" ]; then
  echo "NOTE: these .patch files are committed in your repository (they should not be):"
  echo "$tracked"
  echo "To stop tracking them (the files stay on disk):  git rm --cached -q -- '*.patch'"
  echo
fi

applied=0
skipped=0
for p in "${abs[@]}"; do
  name=$(basename "$p")
  subject=$(git mailinfo /dev/null /dev/null < "$p" | sed -n 's/^Subject: //p')

  if [ -n "$subject" ] && git -C "$root" log --format=%s | grep -Fxq -- "$subject"; then
    echo "SKIP (already in your history): $name"; skipped=$((skipped+1)); continue
  fi
  if (cd "$root" && git apply --reverse --check "$p" >/dev/null 2>&1); then
    echo "SKIP (its changes are already in your files): $name"; skipped=$((skipped+1)); continue
  fi

  echo "APPLY: $name"
  if ! (cd "$root" && git am "$p"); then
    (cd "$root" && git am --abort >/dev/null 2>&1)
    echo
    echo "FAILED on $name. I cancelled only this patch; your repository is clean."
    echo "Copy everything above and send it to me. Nothing was pushed and no file was deleted."
    exit 1
  fi
  applied=$((applied+1))
done

echo
echo "Applied: $applied   Skipped: $skipped"
git -C "$root" log --oneline -5

pushed=0
if [ "$push" -eq 1 ]; then
  echo
  echo "Pushing..."
  if git -C "$root" push; then
    echo "DONE: pushed."
    pushed=1
  else
    echo "PUSH FAILED. Nothing was lost and no file was deleted; copy the message above and send it to me."
    exit 1
  fi
else
  echo "DONE: applied, not pushed (--no-push)."
fi

# 5) --clean: delete the named patch files, only after a successful push.
if [ "$clean" -eq 1 ]; then
  echo
  if [ "$pushed" -ne 1 ]; then
    echo "KEPT the patch files: --clean deletes them only after a successful push."
  else
    removed=0
    for p in "${abs[@]}"; do
      case "$p" in
        *.patch) ;;
        *) echo "KEPT (not a .patch file): $p"; continue ;;
      esac
      if git -C "$root" ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
        echo "KEPT (git tracks it): $(basename "$p")"; continue
      fi
      if rm -- "$p"; then echo "DELETED: $(basename "$p")"; removed=$((removed+1)); fi
    done
    echo "Deleted $removed patch file(s)."
  fi
fi
