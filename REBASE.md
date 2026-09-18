# Compare and update the source ports

This repository has one workspace branch and two separate source histories. The
workspace branch is `main`. It stores `base-ui` and `shadcn-ui` as Git submodules
at exact commits. The source branches do not share history with `main` or with
each other.

| Branch | Contents |
| --- | --- |
| `baseline/base-ui` | Unchanged Base UI at the pinned source commit |
| `solid/base-ui` | That Base UI commit plus `packages/solid` |
| `baseline/shadcn-ui` | Unchanged Shadcn UI at the pinned source commit |
| `solid/shadcn-ui` | That Shadcn UI commit plus `packages/solid` |
| `main` | Build tools, gallery, checks, and exact source commit links |

Use these GitHub views to see only the port changes:

- [Base UI port diff](https://github.com/irispot/solidcn/compare/baseline/base-ui...solid/base-ui)
- [Shadcn UI port diff](https://github.com/irispot/solidcn/compare/baseline/shadcn-ui...solid/shadcn-ui)

Do not compare `main` with a source branch. Those histories are unrelated.

## Clone

```sh
git clone --recurse-submodules https://github.com/irispot/solidcn.git
cd solidcn
npm ci
npm run typecheck
npm run build
```

If you already cloned the repository, run `git submodule update --init --recursive`.
Git checks out the exact source commits recorded by `main`. The submodules will
start at detached `HEAD`; this is normal for a pinned checkout.

## Review an upstream update

The source ports add files under `packages/solid`. They do not edit original
source or test files. This keeps source text conflicts small, but it does not
convert new React behavior into Solid code by itself.

In a fresh clone, add the official source remote to the submodule that you want
to update. Use `master` for Base UI and `main` for Shadcn UI:

```sh
git -C base-ui remote add upstream https://github.com/mui/base-ui.git
git -C base-ui fetch upstream master
npm run upstream:candidate -- base-ui upstream/master
```

```sh
git -C shadcn-ui remote add upstream https://github.com/shadcn-ui/ui.git
git -C shadcn-ui fetch upstream main
npm run upstream:candidate -- shadcn-ui upstream/main
```

If `upstream` already exists, skip the `remote add` command. The candidate
command writes a review report to a new temporary directory. It does not
change source files or Git refs. Read its changed-source and native-port
sections before you rebase.

After review, rebase only the matching `solid/*` branch onto the selected
official commit. Update the pinned commit and protected-file checksum record
in `main`, run the checks, then commit the new submodule pointer in `main`.
Keep old port commits reachable while a published `main` commit points to them.
See [the upstream review guide](tooling/upstream/README.md) for the limits of
the candidate check.
