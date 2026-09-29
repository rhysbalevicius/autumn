import {
	ACTIVE_MIGRATION_RUN_STATUSES,
	type MigrationRun,
	migrationRuns,
} from "@autumn/shared";
import {
	and,
	desc,
	eq,
	getTableColumns,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import type { RepoContext } from "@/db/repoContext.js";

export type MigrationRunKind = "run_all" | "dry_run" | "sample";

export type MigrationRunWithKind = MigrationRun & { kind: MigrationRunKind };

const runKind = sql<MigrationRunKind>`CASE
	WHEN ${migrationRuns.dry_run} THEN 'dry_run'
	WHEN ${migrationRuns.only_ids} IS NULL AND ${migrationRuns.target_limit} IS NULL THEN 'run_all'
	ELSE 'sample'
END`;

const isActive = inArray(migrationRuns.status, ACTIVE_MIGRATION_RUN_STATUSES);

const isUnscopedLive = and(
	eq(migrationRuns.dry_run, false),
	isNull(migrationRuns.only_ids),
	isNull(migrationRuns.target_limit),
);

/**
 * One run per (migration, kind): the active or latest started Run All, and
 * the latest finished dry run and scoped live run, whatever their outcome.
 */
export const listLatestRunsByKind = async ({
	ctx,
	migrationInternalIds,
}: {
	ctx: RepoContext;
	migrationInternalIds: string[];
}): Promise<MigrationRunWithKind[]> => {
	if (migrationInternalIds.length === 0) return [];

	return ctx.db
		.selectDistinctOn([migrationRuns.migration_internal_id, runKind], {
			...getTableColumns(migrationRuns),
			kind: runKind,
		})
		.from(migrationRuns)
		.where(
			and(
				eq(migrationRuns.org_id, ctx.org.id),
				eq(migrationRuns.env, ctx.env),
				inArray(migrationRuns.migration_internal_id, migrationInternalIds),
				or(
					and(
						isUnscopedLive,
						or(isNotNull(migrationRuns.started_at), isActive),
					),
					and(
						isNotNull(migrationRuns.finished_at),
						sql`${runKind} <> 'run_all'`,
					),
				),
			),
		)
		.orderBy(
			migrationRuns.migration_internal_id,
			runKind,
			desc(isActive),
			desc(migrationRuns.created_at),
		);
};
