# Vercel dependency-install fix

This patch removes environment-specific dependency URLs from package-lock.json, pins the frontend dependencies, and forces Node.js 20.x for Vercel deployments.

## Why
The previous lock file contained dependency download URLs from a private build environment. Those URLs are not valid on Vercel. Vercel currently defaults new projects to Node.js 24.x; package.json now requests Node.js 20.x to avoid an npm install failure seen with newer Node/npm combinations.

## Deploy
Commit the complete contents of this folder to the repository root and redeploy on Vercel.
