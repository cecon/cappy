# Capybara Instructions Version Control

## Overview

The Capybara extension now supports version-controlled instructions in the `copilot-instructions.md` file. This allows for better management and future updates of the Capybara-specific instructions without affecting other content in the file.

## How it Works

### Version Markers

All Capybara instructions are wrapped with version-specific markers:

```
=====================START CAPYBARA MEMORY v1.0.0=====================
# Capybara instructions content here
======================END CAPYBARA MEMORY v1.0.0======================
```

### Features

1. **Version Control**: Each instruction block has a version number
2. **Safe Updates**: Old versions are automatically replaced when updating
3. **Content Preservation**: Other content in `copilot-instructions.md` is preserved
4. **English Language**: All instructions are now in English for consistency

## Available Commands

### `Capybara: Update Capybara Instructions`

This command updates the Capybara instructions to the latest version while preserving any other content in the file.

**Features:**
- Detects current version (if any)
- Replaces old version with new one
- Preserves existing user content
- Shows version change information

## File Management

### FileManager Methods

The `FileManager` class now includes these methods:

- `updateCapybaraInstructions(content, version)`: Update instructions with version control
- `getCurrentCapybaraVersion()`: Get the current version from the file
- `removeExistingCapybaraSection(content)`: Clean utility for removing old sections

### TaskWorkflowManager Integration

The `TaskWorkflowManager` includes an `updateCapybaraInstructions()` method that can be called from other parts of the extension to update instructions when the project state changes.

## Version History

### v1.0.0
- Initial version with English translation
- Added XML task structure documentation
- Included comprehensive command list
- Added workflow recommendations

## Future Enhancements

1. **Automatic Updates**: Instructions could be updated automatically when:
   - New commands are implemented
   - Project configuration changes
   - Extension capabilities are expanded

2. **Custom Versioning**: Allow users to specify custom version numbers

3. **Migration Warnings**: Notify users about breaking changes between versions

4. **Backup System**: Keep backup of previous versions before updating

## Implementation Details

### Marker Pattern

The version markers use this specific pattern:
- Minimum 20 equal signs for clear visibility
- Consistent "START/END CAPYBARA MEMORY" text
- Version number in semantic versioning format
- Easy to parse with regex patterns

### Content Management

The system ensures:
- No duplicate sections
- Clean replacement of old versions
- Preservation of whitespace and formatting
- Proper line ending handling

## Usage Examples

### Initial Creation
When initializing Capybara, instructions are created with version markers.

### Manual Updates
Users can run `Capybara: Update Capybara Instructions` to get the latest version.

### Programmatic Updates
Other commands can trigger instruction updates when project state changes significantly.
