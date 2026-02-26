import type { AppColors } from "./colors"
import { defaultColors } from "./colors"

function mergeAppColors(base: AppColors, override: Partial<AppColors>): AppColors {
  return {
    ...base,
    ...override,
    logger: {
      ...base.logger,
      ...(override.logger ?? {}),
    },
  }
}

export function resolveProviderColors(providerColors?: Partial<AppColors> | null): AppColors {
  if (!providerColors) {
    return defaultColors
  }

  return mergeAppColors(defaultColors, providerColors)
}

type ProviderColorsModule = {
  providerColors?: Partial<AppColors>
}

export async function loadProviderColors(providerId?: string | null): Promise<Partial<AppColors> | null> {
  if (!providerId) {
    return null
  }

  try {
    const modulePath = `./providers/${providerId}/colors`
    const imported = (await import(modulePath)) as ProviderColorsModule
    return imported.providerColors ?? null
  } catch {
    return null
  }
}
