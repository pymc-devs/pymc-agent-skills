# Inspect the API installed in the project

Use the consuming project's Python environment. The optional helper needs only
Python's standard library plus whichever scientific package is being inspected:

```bash
python scripts/lookup_api.py pymc.Model
python scripts/lookup_api.py pymc.sample_posterior_predictive
python scripts/lookup_api.py pytensor.tensor.exp
python scripts/lookup_api.py arviz.summary
```

Run from the skill directory or use an absolute script path. It prints JSON to
stdout with the symbol, root package/version, installed object kind, callable
signature, bounded docstring excerpt and official documentation index URL.
It creates no files, downloads nothing, installs nothing and makes no network
requests. Importing an installed scientific package executes that package's normal
Python initialization; import messages are redirected to stderr.

## Interpret each result narrowly

- `availability="available"`: a local object resolved. It does not prove that all
  its operations work or that its docstring matches its implementation.
- `not_resolved_on_installed_object`: static lookup could not resolve a member.
  Dynamic exports and instance-only attributes need source or appropriate instance
  inspection; this is not proof the feature was removed.
- `import_failed`: package/module import raised an exception. The error type and
  message distinguish a missing package/dependency from other import failures.
- `signature_status="introspection_failed"`: the object exists but its signature
  cannot be inspected, for example a compiled callable. Do not invent one.
- `signature_status="not_callable"`: the object is not callable. Properties are
  inspected through their getter, not executed; no model instances are constructed.
- `version=null`: distribution metadata was unavailable, even if import succeeds.

Exit 0 means local resolution succeeded (signature inspection may still be
unavailable). Exit 3 means resolution/import failed. Invalid CLI syntax or symbol
format exits 2. Symbols must be dotted public paths rooted in pymc, pytensor or
arviz; arbitrary URLs/import roots are not accepted.

The documentation URLs are floating official indexes for discovery, not fetched
pages or version/symbol confirmation. Follow them to the relevant API and select
version-matched documentation or official source when behavior matters. A moved
URL or unavailable web page does not override a present installed object.
ArviZ may delegate implementation to arviz-stats/base/plots; consult the actual
owning package when investigating implementation details. Do not attribute a
wrapper's behavior to an unrelated source module.

Sources: [PyMC](https://www.pymc.io/projects/docs/en/stable/api.html),
[PyTensor](https://pytensor.readthedocs.io/en/stable/library/index.html),
[ArviZ](https://python.arviz.org/en/stable/api/index.html).
