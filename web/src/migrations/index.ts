import * as migration_20260627_055816_baseline from './20260627_055816_baseline';
import * as migration_20260627_140438_dedup_unique_indexes from './20260627_140438_dedup_unique_indexes';
import * as migration_20260710_052545_radar_sso_identity from './20260710_052545_radar_sso_identity';
import * as migration_20260711_123550_matches from './20260711_123550_matches';
import * as migration_20260716_112725_m4_chat_messages from './20260716_112725_m4_chat_messages';
import * as migration_20260726_134752_m5_branches_roles from './20260726_134752_m5_branches_roles';
import * as migration_20260726_143618_m5_announcement_scopes from './20260726_143618_m5_announcement_scopes';
import * as migration_20260726_152037_m8_subscriptions from './20260726_152037_m8_subscriptions';
import * as migration_20260730_173921_m9_monthly_fee from './20260730_173921_m9_monthly_fee';
import * as migration_20260730_182709_m9_chat_rooms from './20260730_182709_m9_chat_rooms';
import * as migration_20260730_190934_m9_chat_reads from './20260730_190934_m9_chat_reads';
import * as migration_20260731_080000_branch_operator from './20260731_080000_branch_operator';
import * as migration_20260801_092743_future_matches from './20260801_092743_future_matches';
import * as migration_20260801_162515_login_tokens_email_optional from './20260801_162515_login_tokens_email_optional';

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
    name: '20260726_143618_m5_announcement_scopes',
  },
  {
    up: migration_20260726_152037_m8_subscriptions.up,
    down: migration_20260726_152037_m8_subscriptions.down,
    name: '20260726_152037_m8_subscriptions',
  },
  {
    up: migration_20260730_173921_m9_monthly_fee.up,
    down: migration_20260730_173921_m9_monthly_fee.down,
    name: '20260730_173921_m9_monthly_fee',
  },
  {
    up: migration_20260730_182709_m9_chat_rooms.up,
    down: migration_20260730_182709_m9_chat_rooms.down,
    name: '20260730_182709_m9_chat_rooms',
  },
  {
    up: migration_20260730_190934_m9_chat_reads.up,
    down: migration_20260730_190934_m9_chat_reads.down,
    name: '20260730_190934_m9_chat_reads',
  },
  {
    up: migration_20260731_080000_branch_operator.up,
    down: migration_20260731_080000_branch_operator.down,
    name: '20260731_080000_branch_operator',
  },
  {
    up: migration_20260801_092743_future_matches.up,
    down: migration_20260801_092743_future_matches.down,
    name: '20260801_092743_future_matches',
  },
  {
    up: migration_20260801_162515_login_tokens_email_optional.up,
    down: migration_20260801_162515_login_tokens_email_optional.down,
    name: '20260801_162515_login_tokens_email_optional'
  },
];
