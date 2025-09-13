# Publishing to npm

This document explains how to publish ccstat to npm so users can install it with `npm install -g ccstat`.

## Prerequisites

1. **npm account**: Create an account at [npmjs.com](https://npmjs.com)
2. **npm CLI access**: Login with `npm login`
3. **Unique package name**: The name "ccstat" must be available on npm

## Pre-Publishing Steps

### 1. Update package.json

Update author information in `package.json`:

```json
{
  "author": "Your Name <your.email@example.com>"
}
```

Note: Repository URLs are already configured for https://github.com/PeteHalsted/ccstat

### 2. Check Package Name Availability

```bash
npm view ccstat
```

If the package doesn't exist, you're good to go. If it exists, choose a different name.

### 3. Verify Build Process

```bash
npm run prepublishOnly
```

This will:
- Clean the dist directory
- Compile TypeScript
- Run linting and formatting checks

## Publishing Process

### 1. Login to npm

```bash
npm login
```

Enter your npm username, password, and email.

### 2. Version the Package

For first release:
```bash
npm version 1.0.0
```

For subsequent releases:
```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0  
npm version major  # 1.0.0 -> 2.0.0
```

### 3. Publish to npm

```bash
npm publish
```

The `prepublishOnly` script will automatically run, ensuring the package is built and tested before publishing.

### 4. Verify Publication

```bash
npm view ccstat
```

## Installation Testing

Test the published package:

```bash
# Install globally
npm install -g ccstat

# Test the command
ccstat

# Or test without installing
npx ccstat
```

## What Gets Published

The npm package includes only:
- `dist/` - Compiled JavaScript
- `LICENSE` - License file
- `README.md` - User documentation

Excluded files (via `.npmignore`):
- `src/` - TypeScript source
- `CLAUDE.md` - Development documentation
- `tsconfig.json`, `biome.json` - Build configuration
- Development and git files

## Update Process

For future updates:

1. Make your changes
2. Test locally: `npm run dev`
3. Run quality checks: `npm run check:fix`
4. Update version: `npm version patch`
5. Publish: `npm publish`

## Troubleshooting

**"Package already exists"**: The name is taken, choose a different name in `package.json`

**"Not logged in"**: Run `npm login` first

**"Build failed"**: Fix TypeScript errors and run `npm run build`

**"Permission denied"**: Make sure you own the package or are a collaborator