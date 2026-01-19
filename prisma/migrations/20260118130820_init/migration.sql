-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "google_id" TEXT,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "phone_number" VARCHAR(20),
    "address" TEXT,
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(10),
    "date_of_birth" DATE,
    "gender" VARCHAR(10),
    "profile_picture_url" TEXT,
    "user_role_id" INTEGER NOT NULL,
    "status" VARCHAR(50) DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "permissions_json" JSONB,
    "can_manage_users" BOOLEAN DEFAULT false,
    "can_create_content" BOOLEAN DEFAULT false,
    "can_view_reports" BOOLEAN DEFAULT false,
    "can_access_admin_panel" BOOLEAN DEFAULT false,
    "hierarchy_level" INTEGER DEFAULT 1,
    "is_system_role" BOOLEAN DEFAULT false,
    "default_dashboard_url" TEXT,
    "api_access_level" VARCHAR(50),
    "related_module_access" JSONB,
    "audit_log_json" JSONB,
    "internal_comments" TEXT,
    "external_reference_id" VARCHAR(100),
    "version_control" VARCHAR(50),
    "last_modified_by" INTEGER,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "total_questions_count" INTEGER DEFAULT 0,
    "total_courses_count" INTEGER DEFAULT 0,
    "average_difficulty" DECIMAL(3,2),
    "related_field_of_study" VARCHAR(255),
    "syllabus_outline" TEXT,
    "external_resource_links" JSONB,
    "suggested_grade_levels" VARCHAR(100),
    "common_misconceptions" TEXT,
    "key_concepts" TEXT,
    "learning_objectives" TEXT,
    "assessment_methods" TEXT,
    "last_reviewed_by" INTEGER,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "topic_name" VARCHAR(255) NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "description" TEXT,
    "total_questions_count" INTEGER DEFAULT 0,
    "total_lessons_count" INTEGER DEFAULT 0,
    "average_score" DECIMAL(5,2),
    "prerequisite_topics" JSONB,
    "related_keywords" TEXT,
    "learning_materials_suggested" TEXT,
    "common_errors" TEXT,
    "historical_context" TEXT,
    "real_world_applications" TEXT,
    "learning_tips" TEXT,
    "quiz_average_score" DECIMAL(5,2),
    "revision_frequency" INTEGER DEFAULT 0,
    "is_advanced" BOOLEAN DEFAULT false,
    "external_reference_id" VARCHAR(100),
    "last_updated_by" INTEGER,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_banks" (
    "id" SERIAL NOT NULL,
    "bank_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject_id" INTEGER NOT NULL,
    "topic_id" INTEGER,
    "price" DECIMAL(10,2) DEFAULT 0.00,
    "status" VARCHAR(50) DEFAULT 'draft',
    "total_questions" INTEGER DEFAULT 0,
    "access_duration_days" INTEGER,
    "last_reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_user_id" INTEGER,
    "version_number" VARCHAR(50),
    "language" VARCHAR(50) DEFAULT 'id',
    "target_audience" TEXT,
    "usage_guidelines" TEXT,
    "licensing_details" TEXT,
    "is_premium" BOOLEAN DEFAULT false,
    "tags" JSONB,
    "average_completion_time_minutes" INTEGER,
    "external_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "question_bank_id" INTEGER,
    "subject_id" INTEGER NOT NULL,
    "topic_id" INTEGER,
    "question_text" TEXT NOT NULL,
    "question_type" VARCHAR(50) NOT NULL,
    "difficulty_level" VARCHAR(50) DEFAULT 'medium',
    "image_url" TEXT,
    "audio_url" TEXT,
    "video_url" TEXT,
    "explanation_text" TEXT,
    "correct_answer_id" INTEGER,
    "points" INTEGER DEFAULT 1,
    "time_limit_per_question" INTEGER,
    "tags" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_by_user_id" INTEGER NOT NULL,
    "reviewed_by_user_id" INTEGER,
    "last_review_date" TIMESTAMPTZ(6),
    "source_reference" TEXT,
    "common_mistakes" TEXT,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer_text" TEXT NOT NULL,
    "is_correct" BOOLEAN DEFAULT false,
    "feedback_text" TEXT,
    "image_url" TEXT,
    "order_number" INTEGER,
    "points_if_selected" INTEGER DEFAULT 0,
    "justification_for_correct" TEXT,
    "alternative_answer_forms" TEXT,
    "source_reference" TEXT,
    "version_id" VARCHAR(50),
    "external_id" VARCHAR(100),
    "last_modified_by" INTEGER,
    "is_active" BOOLEAN DEFAULT true,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_items" (
    "id" SERIAL NOT NULL,
    "question_bank_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "order_in_bank" INTEGER,
    "difficulty_override" VARCHAR(50),
    "is_required" BOOLEAN DEFAULT false,
    "points_override" INTEGER,
    "time_limit_override_seconds" INTEGER,
    "notes_for_this_item" TEXT,
    "category_in_bank" VARCHAR(100),
    "added_by_user_id" INTEGER,
    "status_in_bank" VARCHAR(50),
    "last_modified_date" TIMESTAMPTZ(6),
    "version_control" VARCHAR(50),
    "external_reference_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_comments" TEXT,
    "related_tags" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_status" VARCHAR(50) DEFAULT 'pending',
    "shipping_address" TEXT,
    "coupon_code" VARCHAR(50),
    "discount_amount" DECIMAL(10,2) DEFAULT 0.00,
    "tax_amount" DECIMAL(10,2) DEFAULT 0.00,
    "grand_total" DECIMAL(10,2) NOT NULL,
    "payment_method" VARCHAR(100),
    "transaction_id" VARCHAR(255),
    "order_status" VARCHAR(50) DEFAULT 'created',
    "notes" TEXT,
    "billing_address" TEXT,
    "ip_address" TEXT,
    "device_info" TEXT,
    "currency" VARCHAR(10) DEFAULT 'IDR',
    "delivery_status" VARCHAR(50) DEFAULT 'N/A',
    "tracking_number" VARCHAR(100),
    "internal_remarks" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "item_type" VARCHAR(50) NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "price_per_item" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "access_granted" BOOLEAN DEFAULT false,
    "access_start_date" TIMESTAMPTZ(6),
    "access_end_date" TIMESTAMPTZ(6),
    "license_key" VARCHAR(255),
    "download_link" TEXT,
    "refund_status" VARCHAR(50) DEFAULT 'none',
    "refund_amount" DECIMAL(10,2) DEFAULT 0.00,
    "metadata_json" JSONB,
    "internal_comments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" VARCHAR(100) NOT NULL,
    "transaction_id" VARCHAR(255) NOT NULL,
    "payment_status" VARCHAR(50) DEFAULT 'pending',
    "payment_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" VARCHAR(10) DEFAULT 'IDR',
    "gateway_response" TEXT,
    "fees" DECIMAL(10,2) DEFAULT 0.00,
    "refund_status" VARCHAR(50) DEFAULT 'none',
    "refund_date" TIMESTAMPTZ(6),
    "receipt_url" TEXT,
    "notes" TEXT,
    "captured_at" TIMESTAMPTZ(6),
    "authorization_code" VARCHAR(100),
    "payment_gateway_name" VARCHAR(100),
    "error_code" VARCHAR(50),
    "error_message" TEXT,
    "internal_reference" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "course_title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject_id" INTEGER NOT NULL,
    "difficulty_level" VARCHAR(50) DEFAULT 'beginner',
    "price" DECIMAL(10,2) DEFAULT 0.00,
    "duration_hours" INTEGER,
    "instructor_id" INTEGER,
    "status" VARCHAR(50) DEFAULT 'draft',
    "thumbnail_url" TEXT,
    "introduction_video_url" TEXT,
    "prerequisites" TEXT,
    "learning_outcomes" TEXT,
    "enrollment_count" INTEGER DEFAULT 0,
    "rating" DECIMAL(3,2) DEFAULT 0.00,
    "review_count" INTEGER DEFAULT 0,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syllabus_pdf_url" TEXT,
    "certification_available" BOOLEAN DEFAULT false,
    "external_course_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "module_order" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "is_free_preview" BOOLEAN DEFAULT false,
    "status" VARCHAR(50) DEFAULT 'draft',
    "total_lessons" INTEGER DEFAULT 0,
    "quiz_id" INTEGER,
    "learning_objectives" TEXT,
    "resources_links" JSONB,
    "estimated_completion_time_minutes" INTEGER,
    "module_dependency" JSONB,
    "version_number" VARCHAR(50),
    "external_reference_id" VARCHAR(100),
    "last_modified_by" INTEGER,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "lesson_title" VARCHAR(255) NOT NULL,
    "lesson_type" VARCHAR(50) NOT NULL,
    "content_url" TEXT,
    "content_text" TEXT,
    "duration_minutes" INTEGER,
    "is_completed" BOOLEAN DEFAULT false,
    "is_preview" BOOLEAN DEFAULT false,
    "order_in_module" INTEGER NOT NULL,
    "quiz_id" INTEGER,
    "discussion_forum_link" TEXT,
    "attachments_json" JSONB,
    "notes_for_lesson" TEXT,
    "resource_links_json" JSONB,
    "status" VARCHAR(50) DEFAULT 'draft',
    "estimated_reading_time_minutes" INTEGER,
    "transcription_text" TEXT,
    "tags" JSONB,
    "version_id" VARCHAR(50),
    "external_asset_id" VARCHAR(100),
    "last_updated_by" INTEGER,
    "metadata_json" JSONB,
    "internal_comments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_courses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "enrollment_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completion_date" TIMESTAMPTZ(6),
    "progress_percentage" DECIMAL(5,2) DEFAULT 0.00,
    "status" VARCHAR(50) DEFAULT 'in_progress',
    "last_accessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certificate_url" TEXT,
    "score" DECIMAL(5,2),
    "review_given" BOOLEAN DEFAULT false,
    "rating_given" INTEGER,
    "payment_id" INTEGER,
    "access_source" VARCHAR(100),
    "enrollment_method" VARCHAR(100),
    "time_spent_total_minutes" INTEGER,
    "feedback_notes" TEXT,
    "internal_tracking_id" VARCHAR(100),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_tracking" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "is_completed" BOOLEAN DEFAULT false,
    "completion_timestamp" TIMESTAMPTZ(6),
    "time_spent_seconds" INTEGER DEFAULT 0,
    "last_accessed_timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "score" DECIMAL(5,2),
    "attempts_count" INTEGER DEFAULT 0,
    "watched_percentage" DECIMAL(5,2),
    "read_progress_percentage" DECIMAL(5,2),
    "last_interaction_type" VARCHAR(50),
    "device_used" VARCHAR(100),
    "ip_address" TEXT,
    "browser_info" TEXT,
    "session_id" VARCHAR(255),
    "internal_debug_info" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" SERIAL NOT NULL,
    "exam_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject_id" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ(6),
    "end_time" TIMESTAMPTZ(6),
    "total_questions" INTEGER DEFAULT 0,
    "passing_score" DECIMAL(5,2),
    "attempts_allowed" INTEGER DEFAULT 1,
    "exam_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'draft',
    "price" DECIMAL(10,2) DEFAULT 0.00,
    "available_until" TIMESTAMPTZ(6),
    "created_by_user_id" INTEGER NOT NULL,
    "randomize_questions" BOOLEAN DEFAULT true,
    "randomize_answers" BOOLEAN DEFAULT true,
    "show_results_immediately" BOOLEAN DEFAULT false,
    "feedback_level" VARCHAR(50),
    "certification_on_pass" BOOLEAN DEFAULT false,
    "external_exam_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" SERIAL NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "order_in_exam" INTEGER,
    "points_for_question" DECIMAL(5,2) DEFAULT 1.0,
    "section_name" VARCHAR(100),
    "is_bonus_question" BOOLEAN DEFAULT false,
    "time_limit_override_seconds" INTEGER,
    "difficulty_override" VARCHAR(50),
    "notes_for_examiner" TEXT,
    "internal_category" VARCHAR(100),
    "version_id" VARCHAR(50),
    "added_by_user_id" INTEGER,
    "last_modified_date" TIMESTAMPTZ(6),
    "external_reference_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_comments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_exams" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMPTZ(6),
    "score" DECIMAL(5,2),
    "is_completed" BOOLEAN DEFAULT false,
    "submission_time" TIMESTAMPTZ(6),
    "attempts_count" INTEGER DEFAULT 1,
    "status" VARCHAR(50) DEFAULT 'started',
    "notes" TEXT,
    "ip_address" TEXT,
    "device_info" TEXT,
    "time_taken_seconds" INTEGER,
    "passing_status" BOOLEAN,
    "certificate_issued" BOOLEAN DEFAULT false,
    "proctoring_status" VARCHAR(50),
    "final_grade" VARCHAR(10),
    "exam_version_taken" VARCHAR(50),
    "external_session_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_exam_answers" (
    "id" SERIAL NOT NULL,
    "user_exam_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "user_answer" TEXT,
    "selected_answer_id" INTEGER,
    "is_correct" BOOLEAN,
    "points_earned" DECIMAL(5,2),
    "time_taken_seconds" INTEGER,
    "feedback_given" TEXT,
    "review_status" VARCHAR(50) DEFAULT 'pending',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "user_input_hash" VARCHAR(255),
    "submission_timestamp" TIMESTAMPTZ(6),
    "raw_response_json" JSONB,
    "scoring_logic_version" VARCHAR(50),
    "ai_grading_result" JSONB,
    "grader_user_id" INTEGER,
    "last_modified_by" INTEGER,
    "metadata_json" JSONB,
    "internal_comments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "notification_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN DEFAULT false,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),
    "target_url" TEXT,
    "priority" VARCHAR(50) DEFAULT 'normal',
    "icon_url" TEXT,
    "sender_type" VARCHAR(50),
    "sender_id" INTEGER,
    "related_entity_type" VARCHAR(100),
    "related_entity_id" INTEGER,
    "push_sent" BOOLEAN DEFAULT false,
    "email_sent" BOOLEAN DEFAULT false,
    "sms_sent" BOOLEAN DEFAULT false,
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "review_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_approved" BOOLEAN DEFAULT false,
    "approved_by" INTEGER,
    "approval_date" TIMESTAMPTZ(6),
    "helpful_votes" INTEGER DEFAULT 0,
    "unhelpful_votes" INTEGER DEFAULT 0,
    "reported_count" INTEGER DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'pending',
    "moderation_notes" TEXT,
    "response_from_entity_owner" TEXT,
    "response_date" TIMESTAMPTZ(6),
    "external_review_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "coupon_code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "discount_type" VARCHAR(50) NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "max_uses" INTEGER,
    "uses_count" INTEGER DEFAULT 0,
    "min_order_amount" DECIMAL(10,2),
    "applies_to_entity_type" VARCHAR(50),
    "applies_to_entity_ids" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_by_user_id" INTEGER,
    "last_modified_by" INTEGER,
    "usage_per_user_limit" INTEGER DEFAULT 1,
    "can_be_combined" BOOLEAN DEFAULT false,
    "campaign_name" VARCHAR(255),
    "internal_tag" VARCHAR(100),
    "external_promo_id" VARCHAR(100),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "exam_id" INTEGER,
    "certificate_url" TEXT NOT NULL,
    "issue_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" TIMESTAMPTZ(6),
    "certificate_code" VARCHAR(255) NOT NULL,
    "grade_achieved" VARCHAR(50),
    "issued_by_org" VARCHAR(255),
    "template_used" VARCHAR(100),
    "validation_status" VARCHAR(50) DEFAULT 'valid',
    "revocation_reason" TEXT,
    "qr_code_url" TEXT,
    "blockchain_hash" TEXT,
    "digital_signature" TEXT,
    "external_verification_link" TEXT,
    "last_emailed" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "asset_name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" VARCHAR(100),
    "file_size_bytes" BIGINT,
    "uploaded_by_user_id" INTEGER,
    "upload_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "usage_count" INTEGER DEFAULT 0,
    "is_public" BOOLEAN DEFAULT false,
    "storage_provider" VARCHAR(100),
    "checksum" VARCHAR(255),
    "duration_seconds" INTEGER,
    "resolution" VARCHAR(50),
    "thumbnail_path" TEXT,
    "cdn_url" TEXT,
    "tags" JSONB,
    "version_id" VARCHAR(50),
    "metadata_json" JSONB,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_role_name_key" ON "user_roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_subject_name_key" ON "subjects"("subject_name");

-- CreateIndex
CREATE UNIQUE INDEX "question_bank_items_question_bank_id_question_id_key" ON "question_bank_items"("question_bank_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_transaction_id_key" ON "orders"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_courses_user_id_course_id_key" ON "user_courses"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "progress_tracking_user_id_lesson_id_key" ON "progress_tracking"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_exam_id_question_id_key" ON "exam_questions"("exam_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_exams_user_id_exam_id_attempts_count_key" ON "user_exams"("user_id", "exam_id", "attempts_count");

-- CreateIndex
CREATE UNIQUE INDEX "user_exam_answers_user_exam_id_question_id_attempt_number_key" ON "user_exam_answers"("user_exam_id", "question_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_coupon_code_key" ON "coupons"("coupon_code");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_code_key" ON "certificates"("certificate_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "user_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_last_reviewed_by_fkey" FOREIGN KEY ("last_reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_question_bank_id_fkey" FOREIGN KEY ("question_bank_id") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_items" ADD CONSTRAINT "question_bank_items_question_bank_id_fkey" FOREIGN KEY ("question_bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_items" ADD CONSTRAINT "question_bank_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_items" ADD CONSTRAINT "question_bank_items_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_courses" ADD CONSTRAINT "user_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_courses" ADD CONSTRAINT "user_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_courses" ADD CONSTRAINT "user_courses_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_tracking" ADD CONSTRAINT "progress_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_tracking" ADD CONSTRAINT "progress_tracking_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_tracking" ADD CONSTRAINT "progress_tracking_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_tracking" ADD CONSTRAINT "progress_tracking_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exams" ADD CONSTRAINT "user_exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exams" ADD CONSTRAINT "user_exams_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_user_exam_id_fkey" FOREIGN KEY ("user_exam_id") REFERENCES "user_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_selected_answer_id_fkey" FOREIGN KEY ("selected_answer_id") REFERENCES "answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_grader_user_id_fkey" FOREIGN KEY ("grader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
