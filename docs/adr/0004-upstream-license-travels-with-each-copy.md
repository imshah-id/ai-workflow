# The upstream license travels inside each copy's folder

The repo is MIT-licensed, copyright `samfaina`. Each copy carries its upstream license as `LICENSE.upstream` inside its own folder, and its text changes only by the mechanical transform (ADR 0001). A root `NOTICE.md` lists every copied or adapted skill with its upstream, pinned commit and kind. This is because `npx skills` installs one skill folder at a time, and MIT requires the copyright notice to accompany every copy. A single root `THIRD_PARTY_LICENSES` file would be left behind on every such install.

## Consequences

- Adapted skills are credited in `NOTICE.md` but do not carry the upstream license text, with one exception: an adaptation that keeps almost all of its upstream's text also carries `LICENSE.upstream`. It installs one folder at a time too, and MIT requires the copyright notice to accompany substantial portions. `aw-security-and-hardening` is the case that motivates this.
- Before anything is copied verbatim from an upstream whose license has not been read at its source, a `research` ticket must confirm the license. At the time of writing that applies to pstack.
