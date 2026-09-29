import type {
	MigrationListActivityKind,
	MigrationListItemCounts,
	MigrationListSummary,
	MigrationRunStatus,
	MigrationStatus,
} from "@autumn/shared";
import type { StatusTone } from "@autumn/ui";
import { format, formatDistanceStrict } from "date-fns";
import type { ChipView } from "./chipView";

export type SegmentKind =
	| "migrated"
	| "up_to_date"
	| "skipped"
	| "failed"
	| "in_flight"
	| "not_reached"
	| "would_change"
	| "would_fail"
	| "sampled"
	| "untouched";

export const SEGMENTS: Record<
	SegmentKind,
	{ className: string; label: string | null }
> = {
	migrated: { className: "bg-[#30A46C]", label: "Migrated" },
	up_to_date: {
		className: "bg-[#c4c4c4] dark:bg-[#5a5a5a]",
		label: "Already up to date",
	},
	skipped: { className: "bg-[#E5A21F]", label: "Skipped" },
	failed: { className: "bg-[#E5484D]", label: "Failed" },
	in_flight: { className: "bg-[#30A46C]/45", label: "In progress" },
	not_reached: {
		className: "bg-black/[0.07] dark:bg-[#262626]",
		label: "Not reached",
	},
	would_change: { className: "bg-[#3E8BD9]/55", label: "Would change" },
	would_fail: { className: "bg-[#E8742C]/70", label: "Would fail" },
	sampled: { className: "bg-[#30A46C]", label: "Migrated in sample" },
	untouched: { className: "bg-transparent", label: null },
};

export const BAR_TRACKS = {
	run: SEGMENTS.not_reached.className,
	preview: "bg-black/[0.05] dark:bg-[#1f1f1f]",
} as const;

export type Segment = { kind: SegmentKind; value: number };

export type StatusView = {
	ring: { tone: StatusTone; fraction: number };
	chip: ChipView;
	bar: { track: keyof typeof BAR_TRACKS; segments: Segment[] };
	card: {
		status: MigrationStatus;
		label: string;
		when: string;
		error: string | null;
		legend: Segment[];
	};
};

type RunProgress = {
	counts: MigrationListItemCounts;
	fraction: number;
	percent: string;
	segments: Segment[];
};

const EMPTY_COUNTS: MigrationListItemCounts = {
	total: 0,
	running: 0,
	succeeded: 0,
	no_updates_needed: 0,
	ineligible: 0,
	failed: 0,
};

/** Claims land page by page, so the filter count keeps the bar from reading
 * complete against the customers claimed so far. */
const runProgress = (summary: MigrationListSummary): RunProgress => {
	const counts = summary.latest_run?.counts ?? EMPTY_COUNTS;
	const completed =
		counts.succeeded +
		counts.no_updates_needed +
		counts.ineligible +
		counts.failed;
	const denominator = Math.max(counts.total, summary.customer_count ?? 0);
	const fraction = denominator > 0 ? Math.min(completed / denominator, 1) : 0;
	return {
		counts,
		fraction,
		percent: `${Math.round(fraction * 100)}%`,
		segments: [
			{ kind: "migrated", value: counts.succeeded },
			{ kind: "up_to_date", value: counts.no_updates_needed },
			{ kind: "skipped", value: counts.ineligible },
			{ kind: "failed", value: counts.failed },
			{ kind: "in_flight", value: counts.running },
			{
				kind: "not_reached",
				value: Math.max(denominator - completed - counts.running, 0),
			},
		],
	};
};

const draftSegments = (summary: MigrationListSummary): Segment[] => {
	const { latest_dry_run: dryRun, latest_sample: sample } = summary;
	if (dryRun)
		return [
			{ kind: "would_change", value: dryRun.would_change },
			{ kind: "would_fail", value: dryRun.would_fail },
			{
				kind: "untouched",
				value: Math.max(
					dryRun.previewed - dryRun.would_change - dryRun.would_fail,
					0,
				),
			},
		];
	if (sample)
		return [
			{ kind: "sampled", value: sample.size },
			{
				kind: "untouched",
				value: Math.max((summary.customer_count ?? 0) - sample.size, 0),
			},
		];
	return [];
};

const PREVIEW_OUTCOMES: Record<MigrationRunStatus, string> = {
	queued: "✓",
	running: "✓",
	succeeded: "✓",
	no_changes: "✓",
	failed: "failed",
	canceled: "canceled",
};

const draftDetail = (summary: MigrationListSummary): string | undefined => {
	const { latest_dry_run: dryRun, latest_sample: sample } = summary;
	if (dryRun) return `· dry run ${PREVIEW_OUTCOMES[dryRun.status]}`;
	if (sample) return `· sample ${PREVIEW_OUTCOMES[sample.status]}`;
	return undefined;
};

type Pill = Pick<StatusView, "ring" | "chip"> & {
	track: keyof typeof BAR_TRACKS;
};

const chip = (label: string, detail?: string): ChipView => ({
	label,
	details: detail === undefined ? undefined : [detail],
});

const PILLS: Record<
	MigrationStatus,
	(input: { summary: MigrationListSummary; progress: RunProgress }) => Pill
> = {
	draft: ({ summary }) => ({
		ring: { tone: "neutral", fraction: 0 },
		chip: chip("Draft", draftDetail(summary)),
		track: "preview",
	}),
	waiting: ({ summary }) => ({
		ring: { tone: "yellow", fraction: 0 },
		chip: chip(
			"Waiting",
			summary.queue_position === null
				? undefined
				: `· ${summary.queue_position} ahead`,
		),
		track: "run",
	}),
	running: ({ progress }) => ({
		ring: { tone: "green", fraction: progress.fraction },
		chip: chip("Running", progress.percent),
		track: "run",
	}),
	run: ({ progress }) => ({
		ring: { tone: progress.counts.failed > 0 ? "amber" : "blue", fraction: 1 },
		chip: chip(
			"Completed",
			progress.counts.failed > 0
				? `· ${progress.counts.failed.toLocaleString("en-US")} failed`
				: undefined,
		),
		track: "run",
	}),
	no_changes: () => ({
		ring: { tone: "neutral", fraction: 1 },
		chip: chip("No changes"),
		track: "run",
	}),
	failed: ({ progress }) => ({
		ring: { tone: "red", fraction: progress.fraction },
		chip: chip("Failed", `at ${progress.percent}`),
		track: "run",
	}),
	canceled: ({ progress }) => ({
		ring: { tone: "neutral", fraction: progress.fraction },
		chip: chip("Canceled", `at ${progress.percent}`),
		track: "run",
	}),
};

/** Terminal outcomes already read from the status chip, so they carry no verb. */
const ACTIVITY_VERBS: Record<MigrationListActivityKind, string | null> = {
	created: "Created",
	edited: "Edited",
	queued: "Queued",
	started: "Started",
	finished: null,
	failed: null,
	canceled: null,
	dry_run: "Dry run",
	sample: "Sample",
};

const describeWhen = ({
	summary,
	now,
}: {
	summary: MigrationListSummary;
	now: number;
}): string => {
	const { kind, at } = summary.last_activity;
	const verb = ACTIVITY_VERBS[kind];
	if (kind === "queued" || kind === "started")
		return `${verb} ${formatDistanceStrict(at, now)} ago`;
	const run = summary.latest_run;
	const ranFor =
		run?.started_at && run.finished_at === at
			? ` · after ${formatDistanceStrict(run.started_at, at)}`
			: "";
	const date = format(at, "MMM d, HH:mm");
	return `${verb ? `${verb} ${date}` : date}${ranFor}`;
};

export const deriveStatusView = ({
	status,
	summary,
	now,
}: {
	status: MigrationStatus;
	summary: MigrationListSummary;
	now: number;
}): StatusView => {
	const progress = runProgress(summary);
	const { track, ...pill } = PILLS[status]({ summary, progress });
	const segments =
		track === "preview" ? draftSegments(summary) : progress.segments;
	const visibleSegments = segments.filter((segment) => segment.value > 0);
	const legend = visibleSegments.filter(
		(segment) => SEGMENTS[segment.kind].label,
	);

	return {
		...pill,
		bar: {
			track,
			segments: visibleSegments,
		},
		card: {
			status,
			label: pill.chip.label,
			when: describeWhen({ summary, now }),
			error:
				status === "failed"
					? (summary.latest_run?.error_message ?? null)
					: null,
			legend,
		},
	};
};
