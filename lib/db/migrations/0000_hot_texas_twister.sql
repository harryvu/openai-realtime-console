CREATE TABLE "civics_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "civics_questions_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"user_id" text,
	"results_count" integer NOT NULL,
	"avg_similarity" real,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"correct" integer DEFAULT 0,
	"incorrect" integer DEFAULT 0,
	"last_attempt" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
