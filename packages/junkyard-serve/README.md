# Junkyard Serve

A simple Python package to serve salvaged open-source tools and utilities locally.

## Installation

```bash
uv add junkyard-serve
# or
pip install junkyard-serve
```

## Usage

Once installed, run:

```bash
junkyard-serve
```

This will start a local web server serving the bundled static tools at `http://127.0.0.1:8000`.

### Options

```bash
# Custom port
junkyard-serve --port 3000

# Bind to all interfaces (for Tailscale/remote access)
junkyard-serve --host 0.0.0.0

# Enable auto-reload (development)
junkyard-serve --reload
```

## What's Included

This package bundles various salvaged tools, including:

- **Flight Simulator**: A relaxing 3D flight simulator with endless procedural terrain
- **API Wrappers**: Zero-dependency wrappers for common services
- **CLI Utilities**: Command-line tools for developers

All tools are open source, free forever, and designed to work without accounts or paywalls.

## Adding Your Own Tools

To add new tools to the package:

1. Place your static files (HTML, CSS, JS) in the `static/` directory
2. Update this README to describe your new tool
3. Rebuild and republish the package

## License

MIT License - See [LICENSE](LICENSE) for details.

## Why This Exists

I got tired of "free" tools that are actually account-walled or pay-walled. This package is my way of salvaging useful functionality and giving it new life as something that actually works for people, not just paying customers.

Built with a healthy dose of pettiness and principle.