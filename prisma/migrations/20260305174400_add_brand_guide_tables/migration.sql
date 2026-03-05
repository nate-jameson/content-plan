-- CreateTable
CREATE TABLE "practices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title_prefix" TEXT NOT NULL,
    "website" TEXT,
    "brand_voice_notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_doctors" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "preferred_format" TEXT NOT NULL,
    "role" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "practice_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_services" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "is_offered" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "practice_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_phrases" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "suggested_alt" TEXT,
    "reason" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',

    CONSTRAINT "banned_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_rules" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',

    CONSTRAINT "style_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_issues" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "original_text" TEXT NOT NULL,
    "char_start" INTEGER,
    "char_end" INTEGER,
    "suggested_fix" TEXT,
    "explanation" TEXT,
    "editor_action" TEXT,
    "editor_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "pushed_to_doc" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practices_name_key" ON "practices"("name");

-- CreateIndex
CREATE UNIQUE INDEX "practices_title_prefix_key" ON "practices"("title_prefix");

-- CreateIndex
CREATE INDEX "practice_doctors_practice_id_idx" ON "practice_doctors"("practice_id");

-- CreateIndex
CREATE INDEX "practice_services_practice_id_idx" ON "practice_services"("practice_id");

-- CreateIndex
CREATE INDEX "banned_phrases_practice_id_idx" ON "banned_phrases"("practice_id");

-- CreateIndex
CREATE INDEX "style_rules_practice_id_idx" ON "style_rules"("practice_id");

-- CreateIndex
CREATE INDEX "editorial_issues_article_id_idx" ON "editorial_issues"("article_id");

-- CreateIndex
CREATE INDEX "editorial_issues_practice_id_idx" ON "editorial_issues"("practice_id");

-- AddForeignKey
ALTER TABLE "practice_doctors" ADD CONSTRAINT "practice_doctors_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_services" ADD CONSTRAINT "practice_services_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banned_phrases" ADD CONSTRAINT "banned_phrases_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_rules" ADD CONSTRAINT "style_rules_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_issues" ADD CONSTRAINT "editorial_issues_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
