import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { LEGAL_SEED_DOCS } from '../lib/legalSeedTexts'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legal_documents_kind" AS ENUM('processing_agreement', 'parent_consent');
  CREATE TYPE "public"."enum_legal_signatures_kind" AS ENUM('processing_agreement', 'parent_consent');
  CREATE TYPE "public"."enum_legal_signatures_action" AS ENUM('signed', 'withdrawn');
  CREATE TABLE "legal_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_legal_documents_kind" NOT NULL,
  	"version" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_signatures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_legal_signatures_kind" NOT NULL,
  	"action" "enum_legal_signatures_action" DEFAULT 'signed' NOT NULL,
  	"document_id" integer NOT NULL,
  	"content_hash" varchar NOT NULL,
  	"branch_id" integer,
  	"signer_id" integer,
  	"signed_at" timestamp(3) with time zone NOT NULL,
  	"ip" varchar,
  	"user_agent" varchar,
  	"requisites_snapshot" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "legal_signatures_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"players_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legal_signatures_id" integer;
  ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_document_id_legal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_signer_id_users_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_signatures_rels" ADD CONSTRAINT "legal_signatures_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."legal_signatures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_signatures_rels" ADD CONSTRAINT "legal_signatures_rels_players_fk" FOREIGN KEY ("players_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "legal_documents_kind_idx" ON "legal_documents" USING btree ("kind");
  CREATE INDEX "legal_documents_published_at_idx" ON "legal_documents" USING btree ("published_at");
  CREATE INDEX "legal_documents_updated_at_idx" ON "legal_documents" USING btree ("updated_at");
  CREATE INDEX "legal_documents_created_at_idx" ON "legal_documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "kind_version_idx" ON "legal_documents" USING btree ("kind","version");
  CREATE INDEX "legal_signatures_kind_idx" ON "legal_signatures" USING btree ("kind");
  CREATE INDEX "legal_signatures_action_idx" ON "legal_signatures" USING btree ("action");
  CREATE INDEX "legal_signatures_document_idx" ON "legal_signatures" USING btree ("document_id");
  CREATE INDEX "legal_signatures_branch_idx" ON "legal_signatures" USING btree ("branch_id");
  CREATE INDEX "legal_signatures_signer_idx" ON "legal_signatures" USING btree ("signer_id");
  CREATE INDEX "legal_signatures_signed_at_idx" ON "legal_signatures" USING btree ("signed_at");
  CREATE INDEX "legal_signatures_updated_at_idx" ON "legal_signatures" USING btree ("updated_at");
  CREATE INDEX "legal_signatures_created_at_idx" ON "legal_signatures" USING btree ("created_at");
  CREATE INDEX "legal_signatures_rels_order_idx" ON "legal_signatures_rels" USING btree ("order");
  CREATE INDEX "legal_signatures_rels_parent_idx" ON "legal_signatures_rels" USING btree ("parent_id");
  CREATE INDEX "legal_signatures_rels_path_idx" ON "legal_signatures_rels" USING btree ("path");
  CREATE INDEX "legal_signatures_rels_players_id_idx" ON "legal_signatures_rels" USING btree ("players_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_documents_fk" FOREIGN KEY ("legal_documents_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_signatures_fk" FOREIGN KEY ("legal_signatures_id") REFERENCES "public"."legal_signatures"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_legal_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_documents_id");
  CREATE INDEX "payload_locked_documents_rels_legal_signatures_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_signatures_id");`)

  // Data-часть (D-016): первые версии документов. Через payload.create (не сырой
  // INSERT): contentHash посчитает тот же серверный хук, что и в рантайме; req —
  // чтобы вставка шла в транзакции миграции. Прод — runtime-only standalone (без
  // payload-CLI), поэтому сид едет миграцией, а не скриптом; dev сеет скрипт
  // seed-legal-docs.ts из того же LEGAL_SEED_DOCS (идемпотентно там и там).
  for (const doc of LEGAL_SEED_DOCS) {
    const existing = await payload.find({
      collection: 'legal-documents',
      where: { and: [{ kind: { equals: doc.kind } }, { version: { equals: doc.version } }] },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    if (existing.docs.length) continue
    await payload.create({
      collection: 'legal-documents',
      data: { ...doc, publishedAt: new Date().toISOString() },
      overrideAccess: true,
      req,
    })
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_signatures" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "legal_signatures_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legal_documents" CASCADE;
  DROP TABLE "legal_signatures" CASCADE;
  DROP TABLE "legal_signatures_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legal_signatures_fk";
  
  DROP INDEX "payload_locked_documents_rels_legal_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_legal_signatures_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legal_signatures_id";
  DROP TYPE "public"."enum_legal_documents_kind";
  DROP TYPE "public"."enum_legal_signatures_kind";
  DROP TYPE "public"."enum_legal_signatures_action";`)
}
