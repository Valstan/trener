import * as migration_20260627_055816_baseline from './20260627_055816_baseline';
import * as migration_20260627_140438_dedup_unique_indexes from './20260627_140438_dedup_unique_indexes';
import * as migration_20260710_052545_radar_sso_identity from './20260710_052545_radar_sso_identity';
import * as migration_20260711_123550_matches from './20260711_123550_matches';
import * as migration_20260716_112725_m4_chat_messages from './20260716_112725_m4_chat_messages';
import * as migration_20260726_134752_m5_branches_roles from './20260726_134752_m5_branches_roles';
import * as migration_20260726_143618_m5_announcement_scopes from './20260726_143618_m5_announcement_scopes';

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
    name: '20260711_123550_matches',
  },
  {
    up: migration_20260716_112725_m4_chat_messages.up,
    down: migration_20260716_112725_m4_chat_messages.down,
    name: '20260716_112725_m4_chat_messages',
  },
  {
    up: migration_20260726_134752_m5_branches_roles.up,
    down: migration_20260726_134752_m5_branches_roles.down,
    name: '20260726_134752_m5_branches_roles',
  },
  {
    up: migration_20260726_143618_m5_announcement_scopes.up,
    down: migration_20260726_143618_m5_announcement_scopes.down,
    name: '20260726_143618_m5_announcement_scopes'
  },
];
