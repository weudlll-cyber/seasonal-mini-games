/**
 * @file   apps/embed-loader/src/index.ts
 * @module embed-loader
 * @brief  Public entry point of @smg/embed-loader.
 *
 * Responsibility: tiny embed.js for host sites, no dependencies.
 *                 Shell only until its work package fills it (Bingo 15).
 * Depends on:     nothing yet
 * Used by:        src/index.test.ts, ./index.test
 * Spec:           Bingo 07
 */

// Package identity, so the shell is importable and the test runner has something to check.
export const PACKAGE_NAME = '@smg/embed-loader';
