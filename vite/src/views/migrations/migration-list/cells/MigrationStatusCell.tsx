import { StatusChip } from "@autumn/ui";
import { cn } from "@/lib/utils";
import { STATUS_INDICATORS } from "../../migration/shared/MigrationStatusBadge";
import type { MigrationRowView } from "../rowView/deriveMigrationRowView";
import { BAR_TRACKS, SEGMENTS, type StatusView } from "../rowView/statusView";
import { CellHoverCard, PopoverSeparator, ViewChip } from "./ViewChip";

function SegmentedBar({ bar }: { bar: StatusView["bar"] }) {
	return (
		<div
			className={cn(
				"flex h-1.5 w-[120px] shrink-0 gap-px overflow-clip rounded-full",
				BAR_TRACKS[bar.track],
			)}
		>
			{bar.segments.map((segment) => (
				<div
					key={segment.kind}
					className={cn(
						"h-1.5 min-w-0.5 basis-0",
						SEGMENTS[segment.kind].className,
					)}
					style={{ flexGrow: segment.value }}
				/>
			))}
		</div>
	);
}

function StatusCard({ card }: { card: StatusView["card"] }) {
	return (
		<>
			<div className="flex items-center gap-2">
				<StatusChip {...STATUS_INDICATORS[card.status]}>
					{card.label}
				</StatusChip>
				<span className="truncate text-tertiary-foreground">{card.when}</span>
			</div>
			{card.error && (
				<span className="text-[13px] leading-[18px] font-medium text-foreground">
					{card.error}
				</span>
			)}
			{card.legend.length > 0 && <PopoverSeparator />}
			{card.legend.map((segment) => (
				<div
					key={segment.kind}
					className="flex items-center justify-between gap-3"
				>
					<span className="flex items-center gap-1.5 text-muted-foreground">
						<span
							className={cn(
								"size-2 rounded-full",
								SEGMENTS[segment.kind].className,
							)}
						/>
						{SEGMENTS[segment.kind].label}
					</span>
					<span className="font-medium text-foreground tabular-nums">
						{segment.value.toLocaleString("en-US")}
					</span>
				</div>
			))}
		</>
	);
}

export function MigrationStatusCell({ view }: { view: MigrationRowView }) {
	const { status } = view;
	const pill = (
		<div className="flex w-[156px] shrink-0">
			<ViewChip chip={status.chip} ring={status.ring} />
		</div>
	);

	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<CellHoverCard trigger={pill}>
				<StatusCard card={status.card} />
			</CellHoverCard>
			<SegmentedBar bar={status.bar} />
		</div>
	);
}
