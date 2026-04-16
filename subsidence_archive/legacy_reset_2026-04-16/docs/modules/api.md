# API Module

## Purpose

The `subsidence.api` package is reserved for the backend service layer. It is intended to expose parsing, validation, and calculation endpoints to the Dash frontend or other clients.

## Files

### `main.py`

Defines the FastAPI application instance:

- title: `SUBSIDENCE API`
- version: `0.1.0`
- description aimed at well-log visualization and subsidence calculations

Current endpoint:

- `GET /health` — returns a JSON status response

## Current Status

The package exists as a minimal service skeleton only. No domain endpoints have been implemented yet.

## Planned Responsibility

Expected future endpoint groups:

- file import and validation
- well metadata CRUD
- stratigraphy dictionary access
- burial-history execution
- decompaction and backstripping execution
- export endpoints for result tables and plots

## Current Gaps

- no routers beyond the root application file
- no request or response schemas
- no dependency injection or settings module
- no persistence integration
- no tests for the API layer
