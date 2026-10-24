/**
 * @file   apps/server/devStub.mjs
 * @module server
 * @brief  Stands in for the development modules in the production server bundle.
 *
 * Responsibility: export every name the server imports from src/dev/* and the dev sign-in route, each throwing when called. The app calls them
 *                 only with SMG_DEV=1, which a production install never sets; a name missing
 *                 here fails the build, not the server.
 * Used by:        ./build.mjs (dev-stub plugin)
 * Spec:           Bingo 09 §1
 */
const missing = () => {
  throw new Error('development code is not part of the production bundle; run without SMG_DEV');
};

export const registerDevSignIn = missing;
