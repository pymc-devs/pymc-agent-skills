"""Inspect an installed PyMC, PyTensor or ArviZ symbol without network requests."""

import argparse
from contextlib import redirect_stdout
import importlib
from importlib import metadata
import inspect
import json
import re
import sys


DOCUMENTATION_URLS = {
    "pymc": "https://www.pymc.io/projects/docs/en/stable/api.html",
    "pytensor": "https://pytensor.readthedocs.io/en/stable/library/index.html",
    "arviz": "https://python.arviz.org/en/stable/api/index.html",
}


def inspect_symbol(symbol):
    """Inspect descriptors without calling properties or constructing instances."""
    root, *parts = symbol.split(".")
    try:
        obj = importlib.import_module(root)
        for part in parts:
            try:
                obj = inspect.getattr_static(obj, part)
            except AttributeError:
                if inspect.ismodule(obj):
                    module_name = f"{obj.__name__}.{part}"
                    try:
                        obj = importlib.import_module(module_name)
                        continue
                    except ModuleNotFoundError as exc:
                        if exc.name != module_name:
                            raise
                return {
                    "availability": "not_resolved_on_installed_object",
                    "detail": (
                        f"Attribute {part!r} did not resolve statically. "
                        "Dynamic or instance-only attributes require source or "
                        "instance inspection; this does not establish API removal."
                    ),
                }
    except Exception as exc:
        return {
            "availability": "import_failed",
            "error_type": type(exc).__name__,
            "error": str(exc),
        }

    target = obj.fget if isinstance(obj, property) else obj
    if isinstance(target, (staticmethod, classmethod)):
        target = target.__func__
    result = {"availability": "available", "kind": type(obj).__name__}
    if callable(target):
        try:
            result["signature"] = str(inspect.signature(target))
            result["signature_status"] = "inspected_installed_object"
        except (TypeError, ValueError) as exc:
            result.update(
                signature=None,
                signature_status="introspection_failed",
                signature_error=str(exc),
            )
    else:
        result.update(signature=None, signature_status="not_callable")
    doc = inspect.getdoc(target)
    result["docstring_excerpt"] = doc[:1800] if doc else None
    return result


def lookup(symbol):
    if not re.fullmatch(r"(?:pymc|pytensor|arviz)(?:\.[A-Za-z][A-Za-z0-9_]*)+", symbol):
        raise ValueError("Use a dotted public pymc, pytensor or arviz symbol")
    root = symbol.split(".")[0]
    try:
        version = metadata.version(root)
    except metadata.PackageNotFoundError:
        version = None
    # Package import messages must not contaminate the JSON result on stdout.
    with redirect_stdout(sys.stderr):
        installed_api = inspect_symbol(symbol)
    return {
        "symbol": symbol,
        "package": root,
        "version": version,
        "installed_api": installed_api,
        "documentation_urls": [DOCUMENTATION_URLS[root]],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("symbol", help="Dotted symbol, for example pymc.Model")
    args = parser.parse_args()
    try:
        result = lookup(args.symbol)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0 if result["installed_api"]["availability"] == "available" else 3


if __name__ == "__main__":
    sys.exit(main())
