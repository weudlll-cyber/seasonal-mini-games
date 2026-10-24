/**
 * @file   apps/admin/src/index.ts
 * @module admin
 * @brief  Public entry point of @smg/admin.
 *
 * Responsibility: admin client with its own bundle and CSP.
 *                 Shell only until its work package fills it (Bingo 15).
 * Depends on:     nothing yet
 * Used by:        src/index.test.ts, ./index.test
 * Spec:           Bingo 02 §3
 */

// Package identity, so the shell is importable and the test runner has something to check.
export const PACKAGE_NAME = '@smg/admin';
