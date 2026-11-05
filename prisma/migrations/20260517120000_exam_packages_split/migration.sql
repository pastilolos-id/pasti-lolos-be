-- CreateTable exam_packages
CREATE TABLE "exam_packages" (
    "id" SERIAL NOT NULL,
    "exam_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject_id" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ(6),
    "end_time" TIMESTAMPTZ(6),
    "total_questions" INTEGER DEFAULT 0,
    "exam_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'draft',
    "price" DECIMAL(10,2) DEFAULT 0.00,
    "available_until" TIMESTAMPTZ(6),
    "created_by_user_id" INTEGER NOT NULL,
    "show_results_immediately" BOOLEAN DEFAULT false,
    "feedback_level" VARCHAR(50),
    "certification_on_pass" BOOLEAN DEFAULT false,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_packages_pkey" PRIMARY KEY ("id")
);

-- Migrate parent exams to exam_packages (preserve IDs)
INSERT INTO "exam_packages" (
    "id",
    "exam_name",
    "description",
    "subject_id",
    "duration_minutes",
    "start_time",
    "end_time",
    "total_questions",
    "exam_type",
    "status",
    "price",
    "available_until",
    "created_by_user_id",
    "show_results_immediately",
    "feedback_level",
    "certification_on_pass",
    "metadata_json",
    "internal_notes",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "exam_name",
    "description",
    "subject_id",
    "duration_minutes",
    "start_time",
    "end_time",
    "total_questions",
    "exam_type",
    "status",
    "price",
    "available_until",
    "created_by_user_id",
    "show_results_immediately",
    "feedback_level",
    "certification_on_pass",
    "metadata_json",
    "internal_notes",
    "created_at",
    "updated_at"
FROM "exams"
WHERE "package_id" IS NULL;

-- Reset sequence for exam_packages
SELECT setval(
    pg_get_serial_sequence('exam_packages', 'id'),
    COALESCE((SELECT MAX("id") FROM "exam_packages"), 1)
);

-- CreateTable user_exam_packages
CREATE TABLE "user_exam_packages" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exam_package_id" INTEGER NOT NULL,
    "status" VARCHAR(50) DEFAULT 'not_started',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exam_packages_pkey" PRIMARY KEY ("id")
);

-- Migrate parent user_exams enrollments to user_exam_packages
INSERT INTO "user_exam_packages" ("user_id", "exam_package_id", "status", "created_at", "updated_at")
SELECT DISTINCT ON (ue."user_id", ue."exam_id")
    ue."user_id",
    ue."exam_id",
    COALESCE(ue."status", 'not_started'),
    ue."created_at",
    ue."updated_at"
FROM "user_exams" ue
INNER JOIN "exams" e ON e."id" = ue."exam_id"
WHERE e."package_id" IS NULL
ORDER BY ue."user_id", ue."exam_id", ue."created_at" DESC;

-- Add exam_package_id to exams (nullable during migration)
ALTER TABLE "exams" ADD COLUMN "exam_package_id" INTEGER;

-- Link existing child exams to packages
UPDATE "exams"
SET "exam_package_id" = "package_id"
WHERE "package_id" IS NOT NULL;

-- Standalone parents: create one child per package and migrate questions/attempts
DO $$
DECLARE
    parent_rec RECORD;
    new_child_id INTEGER;
BEGIN
    FOR parent_rec IN
        SELECT e.*
        FROM "exams" e
        WHERE e."package_id" IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM "exams" c WHERE c."package_id" = e."id"
          )
    LOOP
        INSERT INTO "exams" (
            "exam_name",
            "description",
            "subject_id",
            "exam_package_id",
            "duration_minutes",
            "start_time",
            "end_time",
            "total_questions",
            "passing_score",
            "attempts_allowed",
            "exam_type",
            "status",
            "available_until",
            "created_by_user_id",
            "randomize_questions",
            "randomize_answers",
            "show_results_immediately",
            "feedback_level",
            "certification_on_pass",
            "external_exam_id",
            "metadata_json",
            "internal_notes",
            "created_at",
            "updated_at"
        ) VALUES (
            parent_rec."exam_name",
            parent_rec."description",
            parent_rec."subject_id",
            parent_rec."id",
            parent_rec."duration_minutes",
            parent_rec."start_time",
            parent_rec."end_time",
            parent_rec."total_questions",
            parent_rec."passing_score",
            parent_rec."attempts_allowed",
            parent_rec."exam_type",
            parent_rec."status",
            parent_rec."available_until",
            parent_rec."created_by_user_id",
            parent_rec."randomize_questions",
            parent_rec."randomize_answers",
            parent_rec."show_results_immediately",
            parent_rec."feedback_level",
            parent_rec."certification_on_pass",
            parent_rec."external_exam_id",
            parent_rec."metadata_json",
            parent_rec."internal_notes",
            parent_rec."created_at",
            parent_rec."updated_at"
        )
        RETURNING "id" INTO new_child_id;

        UPDATE "exam_questions"
        SET "exam_id" = new_child_id
        WHERE "exam_id" = parent_rec."id";

        UPDATE "user_exams"
        SET "exam_id" = new_child_id
        WHERE "exam_id" = parent_rec."id";

        UPDATE "certificates"
        SET "exam_id" = new_child_id
        WHERE "exam_id" = parent_rec."id";
    END LOOP;
END $$;

-- Remove parent rows from exams (already in exam_packages)
DELETE FROM "exams" WHERE "package_id" IS NULL;

-- Drop self-referential package_id
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_package_id_fkey";
ALTER TABLE "exams" DROP COLUMN "package_id";

-- Drop price from exams (moved to packages) if column exists
ALTER TABLE "exams" DROP COLUMN IF EXISTS "price";

-- Enforce exam_package_id on child exams
ALTER TABLE "exams" ALTER COLUMN "exam_package_id" SET NOT NULL;

-- AddForeignKeys
ALTER TABLE "exam_packages" ADD CONSTRAINT "exam_packages_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_packages" ADD CONSTRAINT "exam_packages_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_exam_packages" ADD CONSTRAINT "user_exam_packages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_exam_packages" ADD CONSTRAINT "user_exam_packages_exam_package_id_fkey" FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exams" ADD CONSTRAINT "exams_exam_package_id_fkey" FOREIGN KEY ("exam_package_id") REFERENCES "exam_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "user_exam_packages_user_id_exam_package_id_key" ON "user_exam_packages"("user_id", "exam_package_id");
