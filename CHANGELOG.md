# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added
- `sn-lint` CLI for exported update sets (`sys_update_xml` payloads, CDATA or entity-escaped) and
  single-record unload XML.
- 14 rules (SN001-SN014) covering Business Rules, Client Scripts, Script Includes and UI Actions.
- JSON configuration: enable/disable, severity overrides, rule options, record ignore globs, `failOn`.
- Inline suppressions: `sn-lint-disable-line` and `sn-lint-disable-next-line`.
- Table, JSON and SARIF 2.1.0 reporters; findings mapped to exact lines in the exported XML.
- CI exit codes (0/1/2) and the `--fail-on` threshold.
- Safe XML parser that rejects DOCTYPE/entity declarations.
- Synthetic examples, a Dockerfile, and a GitHub Actions workflow (Node 18/20, SARIF artifact).
