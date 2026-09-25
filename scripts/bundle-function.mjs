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
  // Bundled packages read import.meta.url, which Netlify's own re-bundling (to CommonJS) turns into
  // undefined. Point every use at a value that exists in both worlds: __filename under CommonJS,
  // import.meta.url under plain ESM. Also give ESM a global require for bundled CommonJS code.
  define: {
    'import.meta.url': '__importMetaUrl',
    // Lets /api/_diag report which commit is actually deployed (Netlify sets COMMIT_REF at build time).
    'process.env.BUILD_COMMIT': JSON.stringify((process.env.COMMIT_REF ?? 'local').slice(0, 7)),
  },
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { pathToFileURL as __pathToFileURL } from 'node:url';",
      "const __importMetaUrl = typeof __filename !== 'undefined' ? __pathToFileURL(__filename).href : import.meta.url;",
      "if (typeof require === 'undefined') globalThis.require = __createRequire(__importMetaUrl);",
    ].join('\n'),
  },
  logLevel: 'info',
});
