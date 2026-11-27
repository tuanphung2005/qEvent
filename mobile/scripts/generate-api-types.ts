import { $ } from 'bun';

/**
 * Regenerates the mobile contract from the running services' committed specs.
 * Never hand-edit src/api/generated/**.
 */
const services = ['event', 'admission', 'engagement'] as const;

for (const service of services) {
  await $`bunx openapi-typescript ../services/${service}-service/openapi.json -o src/api/generated/${service}.ts`;
}
