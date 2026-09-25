// Bundles netlify/entry.mjs (which imports the compiled Nest app from dist/) into a single
// file at netlify/functions/api.mjs for Netlify to package. Run after `nest build`.
import { build } from 'esbuild';

// Nest core references these optional packages but only uses them for microservices/websockets,
// which this API doesn't use. Replace them with an empty module so bundling succeeds.
const optionalNestPackages = {
  name: 'optional-nest-packages',
  setup(b) {
    b.onResolve(
      { filter: /^@nestjs\/(microservices|websockets|platform-socket\.io|platform-fastify)(\/|$)/ },
      (args) => ({ path: args.path, namespace: 'optional-stub' }),
    );
    b.onLoad({ filter: /.*/, namespace: 'optional-stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};

await build({
  entryPoints: ['netlify/entry.mjs'],
  outfile: 'netlify/functions/api.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Prisma loads a native engine file at runtime, so it must stay a real node_modules import.
  external: ['@prisma/client', '.prisma/client'],
  plugins: [optionalNestPackages],
  // Some bundled CommonJS dependencies call require(); give ESM output a global one.
  // Assigned (not declared) so it can't clash with anything the platform injects.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; globalThis.require ??= __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
