# DAVYLAB Radar — 2026-11-02 production recovery trigger

This file is a non-content production trigger for the existing `.github/workflows/pages.yml` pipeline. It intentionally contains no news data and does not replace any live report or poster.

The pipeline must rebuild today's report from current sources and historical archives, run the configured P0 checks, generate the ISO-week-selected website poster and six-image WeChat pack, and deploy only if every blocking gate passes.

This marker is not evidence of a successful build or deployment. Record the actual workflow, QA, HTTP/redirect, and live-asset results in the generated verification artifacts.
