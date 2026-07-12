"""
Junkyard CLI - Serves salvaged static tools locally.
"""

import os
import sys
from pathlib import Path

try:
    import uvicorn
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.staticfiles import StaticFiles
except ImportError:
    print("Error: Missing dependencies. Run: uv add junkyard")
    sys.exit(1)


def get_static_path() -> Path:
    """Get the path to the bundled static files."""
    # When installed as a package, static files are in the package directory
    package_dir = Path(__file__).parent
    static_dir = package_dir / "static"
    
    if not static_dir.exists():
        # Fallback for development (if running from source)
        fallback = Path(__file__).parent.parent / "static"
        if fallback.exists():
            return fallback
        raise FileNotFoundError(
            f"Static files not found. Expected at {static_dir} or {fallback}"
        )
    
    return static_dir


def create_app():
    """Create the Starlette application."""
    static_dir = get_static_path()
    
    async def homepage(request):
        # Redirect to index.html
        from starlette.responses import RedirectResponse
        return RedirectResponse(url="/index.html")
    
    routes = [
        Route("/", homepage),
        Route("/{full_path:path}", StaticFiles(directory=str(static_dir), html=True)),
    ]
    
    return Starlette(routes=routes)


def main():
    """Main entry point for the CLI."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Serve junkyard static tools locally")
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=8000,
        help="Port to serve on (default: 8000)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development"
    )
    
    args = parser.parse_args()
    
    static_dir = get_static_path()
    print(f"🗑️  Serving junkyard tools from: {static_dir}")
    print(f"🌐 Opening http://{args.host}:{args.port} in your browser...")
    print(f"💡 Press Ctrl+C to stop")
    
    app = create_app()
    
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="warning"
    )


if __name__ == "__main__":
    main()