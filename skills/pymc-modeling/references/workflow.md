# Bayesian model workflow

## Formulate before computing

State the population, observation unit, estimand or prediction target, units,
support, dependence, missingness and selection assumptions. Preserve original
row identities through transformations. Known measurement noise is appropriate
only when genuinely supplied by the measurement process; estimate unknown noise.
Separate a scientific model assumption from a convenience used for computation.

Use priors in interpretable units. Translate domain statements into parameter
and outcome implications, then run `pm.sample_prior_predictive(draws=...)`.
Inspect tails, impossible outcomes, group variation and decision-relevant
features, not only an aggregate min/max. Proper priors alone do not establish
identifiability; sensitivity to plausible priors matters when data are weak.

## Learn from related models

Start with a useful scaffold or an established subject-matter model. Sometimes
the best route is to simplify a larger target model or explore alternative
scientific explanations, rather than only add complexity. Change components
deliberately so their effects are understandable; do not remove known design,
measurement or dependence structure merely to obtain the smallest model.

Keep a compact model history alongside the analysis: what changed, why, its
computational status, and the effect on important estimands and predictions.
Retain relevant earlier model code/results to understand later variants, even
when predictive scores barely change. Relationships among model variants are
different from the probabilistic dependency graph within one model.

Revising assumptions after seeing data is legitimate model development, not a
pre-specified analysis. Explain the revision and preserve uncertainty across
scientifically viable alternatives. Fix bugs rather than averaging them into a
prediction; do not blindly select the maximum CV score from an adaptive search.

## Inspect the model

Check the registered likelihood, observation alignment and event/batch dimensions.
Use `model.initial_point()`, `model.point_logps()` and `model.debug()` to locate
invalid factors; compile log density and derivatives for precise numerical checks.
An initial finite log density proves neither correct implementation nor convergence.
Independent small-case oracles are especially valuable for custom likelihoods.
Set numeric tolerances from dtype and conditioning, not after seeing errors.
Explicit float64 parameters may still leave lower-precision intermediate constants;
inspect the graph when testing normalization at tight tolerances.

## Fit and preserve the result

Use short preliminary fits or inexpensive approximations to expose construction,
geometry and gross-fit problems before paying for precise inference. Label their
results exploratory: incomplete diagnostics can guide the next investigation,
but do not support reliable posterior summaries or decisions. Do not spend a
final-analysis budget polishing an evidently unsuitable model.

Before a large fit, pilot the intended model size and hardware, including
compilation, sampling and concurrent-chain/predictive-array memory. For reportable
inference, adjust warmup from adaptation and geometry; around 1,000 iterations is
a starting convention, not a requirement or ceiling. Choose retained draws from
estimand-specific ESS and MCSE. Several independently initialized chains support
between-chain checks; many very short chains do not replace within-chain exploration.

```python
# model, tune, draws and chains come from the project's specification and pilot.
with model:
    idata = pm.sample(
        nuts_sampler="nutpie", tune=tune, draws=draws, chains=chains,
        random_seed=42,
    )
idata.to_netcdf("posterior.nc")

pm.compute_log_likelihood(idata, model=model)
with model:
    idata.update(pm.sample_posterior_predictive(idata))
idata.to_netcdf("posterior_with_predictions.nc")
```

Save before downstream calculations can fail, and keep the raw posterior separate
from enriched output. Reopen important saved results to check dimensions and
values. Saving after `pm.sample` returns cannot recover a process interrupted
during sampling; choose suitable incremental storage when that risk matters.

## Separate four questions

1. **Did we implement the intended density?** Compare log densities, gradients,
   identities and small-case analytic results. A sampler cannot fix a wrong graph.
2. **Did inference explore it accurately?** Inspect every divergence, rank R-hat,
   bulk/tail ESS, MCSE, tree depth/energy where applicable, and trace/rank plots.
   R-hat below 1.01 and ESS above 400 are useful screening targets, not guarantees.
   Tail ESS must correspond to the reported interval probabilities; set `prob`
   explicitly where the array-based API requires it. Precision must suit the
   decision. Do not excuse divergences by a small percentage.
3. **Does the model describe relevant data features?** Compare observed and
   replicated discrepancies, such as residual energy, extreme residuals,
   unexplained curvature, group imbalance or temporal dependence. A PPC tail
   probability is not a uniform frequentist p-value. A pointwise predictive
   envelope need not contain every observation.
4. **Does it predict the intended future use?** Use genuinely held-out information
   with appropriate grouped or temporal splits. In-sample fit, numerical agreement
   and healthy chains do not establish external predictive calibration.

Keep failures visible and diagnose their cause before revising the model,
parameterization, budget or decision criteria. More draws do not cure missing
identification, misspecification or approximation-family bias.

These distinctions apply throughout exploration; the required precision depends
on what is being claimed. A preliminary fit can motivate a revision without being
accepted as final inference. Keep its computational uncertainty visible.

## Experiment with simulated data

Probe new models with known-parameter simulations, changing sample size, design,
noise or identification to find where recovery and computation break down.
Repeated simulation-based calibration checks inference under the assumed joint
model, whereas PPCs criticize that model against observed data. Neither replaces
the other. See [simulated-data experiments and scoped SBC](model-testing.md#simulated-data-experiments)
for the procedure and its limits; scale the exercise to novelty, risk and cost.

## A small exact reference

For Gaussian regression `y | beta ~ Normal(X beta, sigma² I)` with genuinely known
sigma and prior `beta ~ Normal(m0, V0)`, define

\[
P=V_0^{-1}+X^TX/\sigma^2,\qquad
V=P^{-1},\qquad m=P^{-1}(V_0^{-1}m_0+X^Ty/\sigma^2).
\]

Compute with linear solves or factorizations rather than unnecessary matrix
inverses. For a new design row z, the latent mean has mean `z m` and variance
`z V z.T`; a new noisy observation adds `sigma²`. Compare MCMC estimates with
allowance for their MCSE. Agreement checks inference conditional on the observed
data; requiring every posterior interval to contain a generating parameter is
not a valid finite-sample correctness test.

## Communicate the result

State interval type and probability, computational limitations, prior sensitivity,
prediction conditioning and extrapolation. Distinguish pointwise intervals from
simultaneous bands. Compare predictive models using differences and uncertainty,
not stacking weights as an equivalence test. Causal interpretation additionally
requires a defensible structural model and identification assumptions.

When an action is requested, identify feasible alternatives, consequences and
constraints, and elicit the decision maker's loss or utility. Propagate posterior
and future-outcome uncertainty into expected loss or utility for each action;
choose according to that stated criterion, not whether an interval excludes zero
or a model tops an ELPD table. Examine sensitivity to plausible models and value
judgments. If costs, benefits or preferences are unavailable, provide interpretable
uncertainty summaries or draws for a decision-maker handoff rather than inventing
them. Not every analysis needs to prescribe an action.

Sources: [Bayesian Workflow](https://users.aalto.fi/~ave/Bayesian-Workflow.pdf)
(2026 corrected edition, §§5.1, 7.3, 9.2–9.5, 11.4, 12.1 and Chapter 14),
[modern MCMC diagnostics](https://doi.org/10.1214/20-BA1221),
[PyMC sampling](https://www.pymc.io/projects/docs/en/stable/api/generated/pymc.sample.html),
[explicit log likelihood](https://www.pymc.io/projects/docs/en/stable/api/generated/pymc.compute_log_likelihood.html).
