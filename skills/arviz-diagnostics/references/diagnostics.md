# Diagnostics and predictive checks

Examples use the modern ArviZ package family and DataTree APIs. Interval labels
and plotting details below describe ArviZ 1.3; check version-matched documentation
rather than mixing legacy InferenceData or matplotlib-Axes recipes.

## Preserve dimensions and identify the target

Save inference before postprocessing. Keep original chains and draw order; do
not thin or discard unfavorable chains to improve a diagnostic. Know whether
draws represent MCMC, independent simulation or an approximation. An observation-
free model samples a prior target even if its output group is called `posterior`.

```python
import arviz as az
import arviz_stats  # registers xarray .azstats accessors

idata = az.from_netcdf("posterior.nc")
posterior = idata["posterior"].to_dataset()
summary = az.summary(idata, var_names=["mu"], ci_prob=0.89,
                     ci_kind="eti", round_to="none")
print(summary[["mean", "sd", "eti89_lb", "eti89_ub",
               "ess_bulk", "ess_tail", "r_hat", "mcse_mean", "mcse_sd"]])
```

`eti89_lb`/`eti89_ub` are the 5.5th/94.5th posterior percentiles, not MCSE bounds.
Request `ci_kind="hdi"` explicitly for a highest-density interval; ETI and HDI can
differ substantially for skewed or multimodal targets. Keep full precision for
decisions. `fmt="xarray"` returns a Dataset rather than the default DataFrame.

Summary tail ESS need not use the interval's endpoint probabilities. For a
scalar variable, calculate the relevant endpoints explicitly:

```python
values = posterior["mu"].transpose("chain", "draw").values
rank_rhat = az.rhat(values, method="rank")
bulk = az.ess(values, method="bulk")
tail = az.ess(values, method="tail", prob=(0.055, 0.945))
mean_mcse = az.mcse(values, method="mean")
endpoint_mcse = [az.mcse(values, method="quantile", prob=q)
                 for q in (0.055, 0.945)]
```

Never collapse chains before R-hat/ESS. Preserve labels with xarray-aware
functions for vector parameters and monitor relevant latent coordinates, not
just a convenient population mean. Accessors such as `data.azstats.rhat(...)`
are an alternative to `az.rhat(data)`; do not instantiate accessor classes.
PyMC's `pm.stats`/`pm.plots` expose ArviZ facades; prefer one consistent namespace
rather than deprecated PyMC root aliases.

## Interpret health and precision separately

| Diagnostic | Investigate | Does not establish |
|---|---|---|
| HMC divergences by chain/location | Integration, gradients, scaling, constraints and difficult geometry | A small nonzero fraction is harmless, or a particular likelihood is wrong |
| Rank-normalized split R-hat | Between/split-chain location and scale disagreement | Near-one values found every mode |
| Bulk ESS | Effective information for central behavior | Stored draw count equals effective information |
| Tail ESS | Exploration at the stated tail probabilities | Good bulk ESS implies precise extreme quantiles |
| Mean/SD/quantile MCSE | Precision for the actual estimand in meaningful units | Posterior uncertainty equals Monte Carlo error |
| Trace/rank graphics | Drifting, sticking, scale separation and rank imbalance | Producing a plot means it passed inspection |
| Energy/BFMI | Chain-specific HMC energy exploration | One universal threshold diagnoses all samplers/models |

R-hat below 1.01 and bulk/tail ESS above 400 are useful screens, not sufficiency
proofs. Choose mean, quantile or event-probability MCSE requirements from the
scientific decision. Missing/nonfinite diagnostics or degenerate monitored
variables are unresolved. HMC energy/divergence statistics can be inapplicable
to another sampler: do not invent zeros or infer NUTS semantics for Metropolis.

Apply accuracy requirements to the claim being made. An explicitly exploratory
fit may have short chains and unresolved diagnostics yet reveal what to debug or
which model assumption to investigate next. Do not label it converged or use its
summaries as reliable final inference. Refit to the required accuracy before
reporting conclusions; rough exploration is not permission to hide failed checks.

`az.diagnose` offers an overview, not a substitute for estimand-specific checks.
More draws reduce MCSE only after trustworthy exploration. Funnels, missing
modes and non-identifiability need investigation first. Non-centering often
helps weakly informed scales; centering or partial parameterization may suit
strong data. Preserve the original result when assessing a revised fit.

## Inspect actual chain and geometry plots

```python
trace = az.plot_trace_dist(idata, var_names=["mu"], backend="matplotlib")
trace.savefig("trace.png", bbox_inches="tight")
rank = az.plot_rank(idata, var_names=["mu"], backend="matplotlib")
rank.savefig("rank.png", bbox_inches="tight")
```

Modern plotting returns `PlotCollection`/`PlotMatrix`, not an array of matplotlib
Axes. `plot_trace_dist` combines marginal distributions and traces; `plot_trace`
is trace-only. ArviZ 1.3 `plot_rank` uses rank ECDF diagnostics. Its `mtc_c` method
accounts for autocorrelation without thinning; rank highlighting is not an
automated convergence pass. `plot_rank_dist` also includes marginals.

For a hierarchical model with `v` and vector `x`, mark divergences explicitly:

```python
pair = az.plot_pair(idata, var_names=["v", "x"], coords={"component": [0]},
                    visuals={"divergence": True}, backend="matplotlib")
pair.savefig("pair.png", bbox_inches="tight")
```

Use `visuals={"divergence": True}`, not legacy `divergences=True`.
A neck-shaped divergence cluster is consistent with difficult geometry, not
proof of one remedy. `plot_autocorr`, `plot_ess`, `plot_ess_evolution` and
`plot_mcse` address dependence/precision; `plot_energy` needs recorded energy.

Distribution, forest, ridge, pair and parallel plots describe distributions,
not convergence. KDE can conceal modes. `mean`, `median`, `mode`, `std`, `var`,
`mad` (median absolute deviation), `iqr`, `eti` and `hdi` summarize different
features. `ecdf`, `histogram`, `kde`, `kde2d` and `qds` have reduction/smoothing
choices that must match the target. Plot composition uses `visuals`,
`aes_by_visuals`, `add_lines`, `add_bands` and `combine_plots` in the modern API.

## Posterior predictive criticism

Given a fitted PyMC model with observed response `y`:

```python
import pymc as pm

pp = pm.sample_posterior_predictive(idata, model=model, var_names=["y"])
idata["posterior_predictive"] = pp["posterior_predictive"]
az.plot_ppc_dist(idata, var_names=["y"], kind="ecdf")
```

Check task-relevant discrepancies: location, spread, tails, zeros, residual
patterns, dependence and group variation. `plot_ppc_dist`, `plot_ppc_dist_pit`,
`plot_ppc_pit`, `plot_ppc_interval` and `plot_ppc_tstat` provide distribution,
PIT, interval and statistic views. These reuse fitted outcomes: PPC tail
probabilities are not uniformly calibrated p-values, and good in-sample fit is
not external validation. A uniform-looking marginal PIT does not establish
conditional calibration. Use LOO or independent validation for that target.

`plot_dgof`/`plot_dgof_dist` check the fitted one-dimensional **density
representation**, not the observation model. Do not substitute them for PPCs.
For independent future-outcome PIT values, keep an honestly named Dataset and
use `plot_ecdf_pit` with the actual observation sample dimension (and `group=None`
for an ungrouped Dataset); do not label those values as simulation-based
calibration ranks. Finite predictive simulation and shared parameter uncertainty
limit uniformity interpretations.

SBC instead repeatedly draws parameters from a proper joint prior, simulates data,
refits the same model and checks ranks of generating test quantities among posterior
draws. It assesses computation under that model, not real-data adequacy. Its ranks
need tie handling, attention to MCMC dependence and finite-replication uncertainty;
do not turn a uniform-looking histogram into a universal correctness claim.

### Regression and counts

`plot_lm` should show predictors and observations with the intended posterior
mean/interval. A latent mean band omits observation noise and is not a
new-observation band. `bayesian_r2`, `residual_r2` and `metrics` assess different
summaries, not convergence or external accuracy. Match the documented variance
convention (sample variance for the ArviZ R² calculations); a returned
observation-level RMSE SE is not posterior MCSE. Known noise is a deterministic
constant, not an invented sampled parameter.

Use `plot_ppc_rootogram` for actual count predictions, not rounded continuous
draws. Respect exposure: a Gamma(shape `a`, rate `b`) prior and
`count_i ~ Poisson(rate*exposure_i)` imply posterior
`Gamma(a+sum(count), b+sum(exposure))`, a useful analytic check.
`plot_ppc_pava`/`plot_ppc_pava_residuals` address binary, categorical or ordinal
targets, not arbitrary continuous residuals. Transform a derived binary target
(e.g. count positive) identically for observed and every predictive draw,
preserving exposure/observation identities.

### Survival and censoring

Distinguish event time, recorded censored time and event status. In ArviZ's
survival workflow, `kaplan_meier` uses status 1=event, 0=censored stored under
the response name in `constant_data`. `generate_survival_curves` and
`plot_ppc_censored` need the corresponding prediction target; uncensored event-
time draws support survival curves, not an atom at the administrative cutoff.

For independent right censoring, Exponential event times and Gamma(a,b) rate
prior give `Gamma(a+events, b+sum(recorded_time))`. Censored observations contribute
survival probability, not a death at the cap. Informative censoring needs its
own model. In version-specific utility behavior, `extrapolation_factor=None`
avoids filtering/renormalizing long predicted times. Check tie handling: a
unique-time shortcut is not a general tied-event survival estimator. Compare
curves over an interpretable horizon; extrapolated tails can be prior-sensitive.

## Nested chains and model structure

Nested R-hat requires a genuinely nested design: independent superchains with
shared initial states for the chains inside each superchain. Do not relabel
ordinary chains after sampling. The sampler must support the required per-chain
initialization; check the backend rather than assuming it does. Preserve the
superchain mapping and use `rhat_nested` for that design alongside ordinary
precision and exploration checks. It is not an automatic many-short-chains fix.

Inspect model structure when missing observations, wrong plates or unexpected
dependencies could explain suspicious output. `str(model)`/`model.table()`
describe roles; `pm.model_to_mermaid`, `pm.model_to_networkx` and
`pm.model_to_graphviz` expose dependency graphs. NetworkX/Graphviz need their
optional dependencies, and DOT rendering also needs the Graphviz executable.
Graph structure does not calculate convergence. Sampler `stats_dtypes_shapes`
declares possible statistics; actual availability is backend/run-specific.
Do not mutate metadata to make absent diagnostics appear present.

## Primary sources

- [ArviZ summary](https://arviz-stats.readthedocs.io/en/latest/api/generated/arviz_stats.summary.html),
  [R-hat](https://arviz-stats.readthedocs.io/en/latest/api/generated/arviz_stats.rhat.html),
  [ESS](https://arviz-stats.readthedocs.io/en/latest/api/generated/arviz_stats.ess.html)
  and [MCSE](https://arviz-stats.readthedocs.io/en/latest/api/generated/arviz_stats.mcse.html).
- [Rank-normalized R-hat and ESS methodology](https://arxiv.org/abs/1903.08008).
- [ArviZ Stats API](https://python.arviz.org/projects/stats/en/latest/api/index.html)
  and [ArviZ Plots API](https://arviz-plots.readthedocs.io/en/latest/api/index.html)
  for predictive, survival and nested-design signatures.
- [PyMC model graph source](https://github.com/pymc-devs/pymc/blob/v6.3.1/pymc/model_graph.py)
  and [sampler statistics protocol](https://github.com/pymc-devs/pymc/blob/v6.3.1/pymc/step_methods/compound.py).
