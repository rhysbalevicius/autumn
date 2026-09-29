import { expect, test } from "bun:test";
import {
	FIXTURE_NOW,
	fixtureMigrations,
} from "../preview/migrationListFixtures";
import { deriveStatusView } from "./statusView";

const statusOf = (id: string) => {
	const migration = fixtureMigrations.find((candidate) => candidate.id === id);
	if (!migration) throw new Error(`fixture ${id} missing`);
	return deriveStatusView({
		status: migration.status,
		summary: migration.summary,
		now: FIXTURE_NOW,
	});
};

const pill = (id: string) => {
	const { ring, chip } = statusOf(id);
	return { ring, label: chip.label, detail: chip.details?.[0] };
};

test("running shows percent of the filter count, with in-flight and not-reached segments", () => {
	const view = statusOf("migration-pro-v3-rollout");
	expect(pill("migration-pro-v3-rollout")).toEqual({
		ring: { tone: "green", fraction: 312 / 1248 },
		label: "Running",
		detail: "25%",
	});
	expect(view.bar).toEqual({
		track: "run",
		segments: [
			{ kind: "migrated", value: 280 },
			{ kind: "up_to_date", value: 20 },
			{ kind: "skipped", value: 4 },
			{ kind: "failed", value: 8 },
			{ kind: "in_flight", value: 24 },
			{ kind: "not_reached", value: 912 },
		],
	});
	expect(view.card?.when).toBe("Started 12 minutes ago");
});

test("waiting shows how many runs are ahead over an unreached bar", () => {
	const view = statusOf("migration-enterprise-seats");
	expect(pill("migration-enterprise-seats")).toEqual({
		ring: { tone: "yellow", fraction: 0 },
		label: "Waiting",
		detail: "· 1 ahead",
	});
	expect(view.bar.segments).toEqual([{ kind: "not_reached", value: 86 }]);
});

test("drafts show dry run, sample, or nothing", () => {
	expect(pill("migration-a7k")).toEqual({
		ring: { tone: "neutral", fraction: 0 },
		label: "Draft",
		detail: undefined,
	});
	expect(statusOf("migration-a7k").bar).toEqual({
		track: "preview",
		segments: [],
	});
	expect(statusOf("migration-a7k").card).toBeNull();
	expect(pill("migration-growth-annual").detail).toBeUndefined();

	const dry = statusOf("migration-starter-dry");
	expect(pill("migration-starter-dry").detail).toBe("· dry run ✓");
	expect(dry.bar.segments).toEqual([
		{ kind: "would_change", value: 57 },
		{ kind: "would_fail", value: 3 },
	]);

	const sample = statusOf("migration-hobby-backfill");
	expect(pill("migration-hobby-backfill").detail).toBe("· sample ✓");
	expect(sample.bar.segments).toEqual([
		{ kind: "sampled", value: 10 },
		{ kind: "untouched", value: 3110 },
	]);
	expect(sample.card?.legend).toEqual([{ kind: "sampled", value: 10 }]);
});

test("completed is blue when clean and amber with the failed count", () => {
	expect(pill("migration-legacy-free-to-hobby")).toEqual({
		ring: { tone: "blue", fraction: 1 },
		label: "Completed",
		detail: undefined,
	});
	expect(pill("migration-seat-licenses")).toEqual({
		ring: { tone: "amber", fraction: 1 },
		label: "Completed",
		detail: "· 2 failed",
	});
});

test("no changes is a full neutral ring over an up-to-date bar", () => {
	const view = statusOf("migration-api-credits-topup");
	expect(pill("migration-api-credits-topup")).toEqual({
		ring: { tone: "neutral", fraction: 1 },
		label: "No changes",
		detail: undefined,
	});
	expect(view.bar.segments).toEqual([{ kind: "up_to_date", value: 540 }]);
});

test("failed and canceled report where they stopped and what was not reached", () => {
	const failed = statusOf("migration-starter-v2");
	expect(pill("migration-starter-v2")).toEqual({
		ring: { tone: "red", fraction: 812 / 1020 },
		label: "Failed",
		detail: "at 80%",
	});
	expect(failed.card).toEqual({
		status: "failed",
		label: "Failed",
		when: "Sep 15, 14:32 · after 18 minutes",
		error: "Stripe rate limit exceeded",
		legend: [
			{ kind: "migrated", value: 798 },
			{ kind: "failed", value: 14 },
			{ kind: "not_reached", value: 208 },
		],
	});

	expect(pill("migration-annual-cleanup")).toEqual({
		ring: { tone: "neutral", fraction: 120 / 900 },
		label: "Canceled",
		detail: "at 13%",
	});
});
