# Changelog

All notable changes to the "NoIME" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-06-05

### Added

- New configuration option `noime.enableDebugLog` to control debug logging output
- Debug logging is now disabled by default for better performance
- Enhanced debug output with conditional logging based on user settings

### Changed

- Improved logging system with centralized DebugLogger class
- Debug output channel now only shows when debug logging is enabled
- Better user experience with cleaner output by default

## [0.0.4] - 2025-03-10

### Fixed

- Added "ui" category to the extension for compatibility with remote development environments.
