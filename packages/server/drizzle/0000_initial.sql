CREATE TYPE "public"."ledger_reason" AS ENUM('signup_bonus', 'bet', 'backbet', 'payout', 'refund', 'daily_bonus', 'rebuy', 'admin_adjust');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'player');--> statement-breakpoint
CREATE TABLE "auth_tickets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tickets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code_hash" text NOT NULL,
	"title" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invites_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "invites_title_length" CHECK (char_length("invites"."title") between 1 and 100),
	CONSTRAINT "invites_used_at_and_by_together" CHECK (("invites"."used_at" is null) = ("invites"."used_by" is null)),
	CONSTRAINT "invites_not_used_and_revoked" CHECK ("invites"."used_at" is null or "invites"."revoked_at" is null)
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_delta_not_zero" CHECK ("ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"seats" integer NOT NULL,
	"min_bet" bigint NOT NULL,
	"max_bet" bigint NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tables_name_unique" UNIQUE("name"),
	CONSTRAINT "tables_name_length" CHECK (char_length("tables"."name") between 1 and 50),
	CONSTRAINT "tables_seats_range" CHECK ("tables"."seats" between 1 and 7),
	CONSTRAINT "tables_bet_range" CHECK ("tables"."min_bet" >= 1 and "tables"."max_bet" >= "tables"."min_bet")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'player' NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_balance_not_negative" CHECK ("users"."balance" >= 0),
	CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[a-z0-9_]{3,20}$')
);
--> statement-breakpoint
ALTER TABLE "auth_tickets" ADD CONSTRAINT "auth_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tickets_expires_at_idx" ON "auth_tickets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ledger_user_id_created_at_index" ON "ledger" USING btree ("user_id","created_at");