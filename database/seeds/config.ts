import crypto from 'node:crypto';

export type SeedProfile = 'test' | 'small' | 'medium' | 'large' | 'xl';

export const PROFILE_COUNTS: Record<SeedProfile, number> = {
  test: 500,
  small: 10_000,
  medium: 75_000,
  large: 250_000,
  xl: 500_000,
};

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function pickWeighted<T>(items: ReadonlyArray<{ value: T; weight: number }>, rng: Rng): T {
  const total = items.reduce((acc, item) => acc + item.weight, 0);
  let threshold = rng() * total;
  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.value;
    }
  }
  return items[items.length - 1]!.value;
}

export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function parseSeedArgs(): { profile: SeedProfile; ticketCount: number; seed: number } {
  const args = process.argv.slice(2);
  let profile = (process.env.SEED_PROFILE as SeedProfile) || 'small';
  let customCount: number | undefined;
  let seed = Number(process.env.SEED_RANDOM || 42);

  for (const arg of args) {
    if (arg.startsWith('--profile=')) {
      const val = arg.split('=')[1] as SeedProfile;
      if (val in PROFILE_COUNTS) {
        profile = val;
      }
    } else if (arg.startsWith('--tickets=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        customCount = Math.floor(parsed);
      }
    } else if (arg.startsWith('--seed=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed)) {
        seed = parsed;
      }
    }
  }

  return {
    profile,
    ticketCount: customCount ?? PROFILE_COUNTS[profile] ?? PROFILE_COUNTS.small,
    seed,
  };
}
