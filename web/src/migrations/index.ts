import * as migration_20260627_055816_baseline from './20260627_055816_baseline';
import * as migration_20260627_140438_dedup_unique_indexes from './20260627_140438_dedup_unique_indexes';
import * as migration_20260710_052545_radar_sso_identity from './20260710_052545_radar_sso_identity';
import * as migration_20260711_123550_matches from './20260711_123550_matches';

export const migrations = [
  {
    up: migration_20260627_055816_baseline.up,
    down: migration_20260627_055816_baseline.down,
    name: '20260627_055816_baseline',
  },
  {
    up: migration_20260627_140438_dedup_unique_indexes.up,
    down: migration_20260627_140438_dedup_unique_indexes.down,
    name: '20260627_140438_dedup_unique_indexes',
  },
  {
    up: migration_20260710_052545_radar_sso_identity.up,
    down: migration_20260710_052545_radar_sso_identity.down,
    name: '20260710_052545_radar_sso_identity',
  },
  {
    up: migration_20260711_123550_matches.up,
    down: migration_20260711_123550_matches.down,
    name: '20260711_123550_matches'
  },
];
