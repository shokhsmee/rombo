# ADR 0004 — Loyiha (project/order) is the hub

- Status: accepted
- Date: 2026-10-28

## Decision
Every operational document (purchase request/order, MRP run, production job, delivery, payment)
carries a FK to `projects.Project`. `projects` never imports those apps; they import it.
Header fields lock after `confirmed` so plans computed downstream stay valid; changes after that
go through explicit change documents (future ADR).

## Why
Rombo works make-to-order. The first question in every department is "which order is this for?".
