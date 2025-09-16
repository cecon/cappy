# Changelog

All notable changes to the Cappy extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.8] - 2025-09-16

### Added
- **Automatic XSD Schema Management**: XSD schemas are now automatically copied from `resources/` to `.cappy/schemas/` during project initialization
- **Startup Schema Sync**: Schemas are automatically updated when VS Code loads projects with existing `.cappy/schemas/` directories
- **Enhanced FileManager**: New `copyXsdSchemas()` method for robust schema file management
- **Detailed Logging**: Added comprehensive debug logging for schema copy operations

### Changed
- **Init Process**: Enhanced `cappy.init` command to include automatic schema provisioning
- **Extension Activation**: Added automatic schema sync check during extension startup
- **Error Handling**: Improved error handling for schema copy operations to prevent init failures

### Technical Details
- All `*.xsd` files in `resources/` are recursively discovered and copied to `.cappy/schemas/`
- Schema directory is created automatically if it doesn't exist
- Existing schema files are replaced to ensure consistency with extension updates
- Process is resilient to missing resources directory or permission issues

### Testing
- All existing tests continue to pass
- New functionality verified through integration tests
- Manual testing confirms proper schema management in real projects

## [2.7.7] - Previous Release
- (Previous features and changes...)

## [Unreleased]
- Planning for future enhancements to context orchestration
- Investigating advanced schema validation features