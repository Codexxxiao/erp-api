-- CreateEnum
CREATE TYPE "WorkflowDefinitionStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WorkflowNodeType" AS ENUM ('START', 'APPROVAL', 'END');

-- CreateEnum
CREATE TYPE "WorkflowApproverType" AS ENUM ('USER', 'ROLE', 'TENANT_ADMIN');

-- CreateEnum
CREATE TYPE "WorkflowApproveMode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('RUNNING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkflowTaskStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkflowActionType" AS ENUM ('START', 'APPROVE', 'REJECT', 'CANCEL');

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersionId" TEXT,
    "status" "WorkflowDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowNodeType" NOT NULL,
    "approverType" "WorkflowApproverType",
    "approverUserId" TEXT,
    "approverRoleId" TEXT,
    "approveMode" "WorkflowApproveMode" NOT NULL DEFAULT 'ANY',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "condition" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersionId" TEXT,
    "recordId" TEXT NOT NULL,
    "activeKey" TEXT,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'RUNNING',
    "currentNodeId" TEXT,
    "startedById" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "status" "WorkflowTaskStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowActionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "taskId" TEXT,
    "nodeId" TEXT,
    "action" "WorkflowActionType" NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowDefinition_tenantId_idx" ON "WorkflowDefinition"("tenantId");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_formId_idx" ON "WorkflowDefinition"("formId");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_formVersionId_idx" ON "WorkflowDefinition"("formVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_tenantId_code_key" ON "WorkflowDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "WorkflowNode_definitionId_idx" ON "WorkflowNode"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNode_definitionId_code_key" ON "WorkflowNode"("definitionId", "code");

-- CreateIndex
CREATE INDEX "WorkflowTransition_definitionId_idx" ON "WorkflowTransition"("definitionId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_sourceNodeId_idx" ON "WorkflowTransition"("sourceNodeId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_targetNodeId_idx" ON "WorkflowTransition"("targetNodeId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_idx" ON "WorkflowInstance"("tenantId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_definitionId_idx" ON "WorkflowInstance"("definitionId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_recordId_idx" ON "WorkflowInstance"("recordId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_tenantId_activeKey_key" ON "WorkflowInstance"("tenantId", "activeKey");

-- CreateIndex
CREATE INDEX "WorkflowTask_tenantId_idx" ON "WorkflowTask"("tenantId");

-- CreateIndex
CREATE INDEX "WorkflowTask_instanceId_idx" ON "WorkflowTask"("instanceId");

-- CreateIndex
CREATE INDEX "WorkflowTask_nodeId_idx" ON "WorkflowTask"("nodeId");

-- CreateIndex
CREATE INDEX "WorkflowTask_assigneeUserId_idx" ON "WorkflowTask"("assigneeUserId");

-- CreateIndex
CREATE INDEX "WorkflowTask_status_idx" ON "WorkflowTask"("status");

-- CreateIndex
CREATE INDEX "WorkflowActionLog_tenantId_idx" ON "WorkflowActionLog"("tenantId");

-- CreateIndex
CREATE INDEX "WorkflowActionLog_instanceId_idx" ON "WorkflowActionLog"("instanceId");

-- CreateIndex
CREATE INDEX "WorkflowActionLog_taskId_idx" ON "WorkflowActionLog"("taskId");

-- CreateIndex
CREATE INDEX "WorkflowActionLog_userId_idx" ON "WorkflowActionLog"("userId");

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_currentNodeId_fkey" FOREIGN KEY ("currentNodeId") REFERENCES "WorkflowNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "WorkflowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionLog" ADD CONSTRAINT "WorkflowActionLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionLog" ADD CONSTRAINT "WorkflowActionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
